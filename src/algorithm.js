/**
 *  algorithm.js
 *  Takes in the name of a course and ranks professors that teach the course
 */
const fetch = require('node-fetch');
const Cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const Sentiment = require('sentiment');

module.exports = courseNumber => {
  return new Promise((resolve, reject) => {
    let db = new sqlite3.Database('./grades.db', sqlite3.OPEN_READONLY, err => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Connected to the grades database.');
      }
    });
    
    let rts = courseNumber.split(' ');
    db.serialize(() => {
      // SQL query for getting professors and their grade data for a course
      let sql = `SELECT prof AS name, a1, a2, a3, b1, b2, b3, c1, c2, c3, d1, d2, d3, f
                FROM agg
                WHERE dept = ? AND course_nbr = ?
                ORDER BY name`;

      let profs = [];
      // 2D array storing percentage of class that got each grade for each prof
      let percentages = [];
      // Gets information on each professor teaching the given course
      db.each(sql, rts, (err, row) => {
        if (err) {
          throw err;
        }
        // Reorders full name into first name, last name
        let splitName = row.name.split(/ +/);
        let finalName = splitName[1] + ' ' + splitName[0];
        profs.push(finalName);
        delete row.name;
        // Stores info of the percentage of each class that got each grade
        let totalStu = Object.values(row).reduce((a, b) => a + b, 0);
        let currPerc = [];
        Object.values(row).forEach(numStu => currPerc.push(numStu / totalStu));
        percentages.push(currPerc);
      }, () => {
        let promises = profs.map(prof => getProfInfo(prof));
        // Gets the Rate My Professors info for each professor
        // Calculates the Pick Your Prof score for each professor
        Promise.all(promises)
          .then(responses => {
            let scores = getScores(profs, responses, percentages);
            // Zip up the profs and scores into an object
            let profData = {};
            profs.forEach((prof, i) => profData[prof] = scores[i]);
            console.log(profData);
            // Sort professors by their scores in descending order
            let sortedProfs = Object.keys(profData).sort((a, b) => {
              return profData[b] - profData[a];
            });

            // Wrap sorted professor list and score data into an object
            let finalData = {
              list: sortedProfs,
              scores: profData
            };

            // FINAL OUTPUT
            resolve(finalData);
          });
      });
      
      db.close();
    });

  });
}

// Gets the PickYourProf score for each professor
function getScores(profs, responses, percentages) {
  // Gets the average of all the professor's metric averages
  let numProfs = 0;
  let sum = 0;
  let metricAverages = [];
  let metricAverage;
  for (let resp of responses) {
    if (Object.keys(resp).length === 0) {
      metricAverages.push(-1);
    } else {
      numProfs++;
      normalizeMetrics(resp);
      metricAverage = getMetricAverage(resp);
      metricAverages.push(metricAverage);
      sum += metricAverage;
    }
  }
  let avg = sum / numProfs;

  let scores = [];
  let score, avgGpa;
  for (let i = 0; i < profs.length; i++) {
    // Sets Rate My Professor metric average if professor has no metrics
    if (metricAverages[i] === -1)
      metricAverages[i] = avg;

    // GPA that a student gets for getting between an A+ and an F
    const gpa = [4, 4, 3.67, 3.33, 3, 2.67, 2.33, 2, 1.67, 1.33, 1, 0.67, 0];
    // Calculates average GPA of students in the course
    avgGpa = 0;
    percentages[i].forEach((percent, j) => avgGpa += percent * gpa[j]);
    // Normalize average GPA to be out of 5 instead of 4
    avgGpa *= 5 / 4;

    // Score is normalized average GPA + Rate My Professors metric average
    // If none of the professors are on RMP, score is avg GPA scaled out of 10
    // Max score is 10
    score = numProfs !== 0 ? avgGpa + metricAverages[i] : avgGpa * 2;
    scores.push(score);
  }
  return scores;

  // Calculates average of the three metrics for each professor
  function getMetricAverage(res) {
    let metricSum = 0;
    let numMetrics = 0;
    for (let prop in res) {
      if (res[prop]) {
        metricSum += res[prop];
        numMetrics++;
      }
    }
    return metricSum / numMetrics;
  }

  // Normalize metrics in response to be out of 5.0 and fix types
  function normalizeMetrics(res) {
    res.rating = res.rating ? parseFloat(res.rating) : undefined;
    // 5 - difficulty because we want to make higher difficulty be lower rating
    res.difficulty = res.difficulty ? 5 - parseFloat(res.difficulty) : undefined;
    // Again percentage / 20 to normalize it out of 5
    res.again = res.again ? parseFloat(res.again) / 20 : undefined;
  }
}

// Base URL for HTTP request
const baseURL = 'http://www.ratemyprofessors.com/search.jsp?queryoption=HEADER' + 
  '&queryBy=teacherName&schoolName=University+of+Texas+at+Austin&schoolID=1255&query=';

// Gets the rating for a professor
function getProfInfo(name) {
  return new Promise((resolve, reject) => {
    // Goes through list of professors
    name = name.replace(' ', '+');
    // Link to query Rate My Professors
    let link = baseURL + name;
    // Searches for the professor on Rate My Professors
    // If professor found, then gets the professor's rating
    scrapeProfLink(link)
      .then(endLink => {
        scrapeProfInfo('http://www.ratemyprofessors.com' + endLink)
          .then(rating => resolve(rating))
          .catch(e => resolve(e));
      })
      .catch(err => resolve(err));
  });
}

// Scrapes link of professor on Rate My Professors
function scrapeProfLink(link) {
  return new Promise((resolve, reject) => {
    fetch(link)
      .then(res => res.text())
      .then(body => {
        let $ = Cheerio.load(body);
        // Checks if any results are found
        let htmas = $('div.not-found-box').next().html();
        if (!htmas.includes('Your search')) {
          // Gets the link for the first result
          $('.listings').filter(function() {
            let endLink = $($(this)[0].children[3].children[1]).attr('href');
            resolve(endLink);
          });
        } else {
          // No results found in Rate My Professors for the professor
          reject({});
        }
      })
      .catch(err => reject({}));
  });
}

// Possible keys in the response object when getting professor info
const responseKeys = ['rating', 'difficulty', 'again'];

// Scrapes info of professor on Rate My Professors
function scrapeProfInfo(link) {
  return new Promise((resolve, reject) => {
    fetch(link)
      .then(resp => resp.text())
      .then(html => {
        // Queries the link to the professor's page
        let $ = Cheerio.load(html);
        let response = {};
        let rating = $('div.breakdown-container.quality .grade').html();
        if (rating) {
          rating = rating.replace(/\s+/g, '');
          // Overall rating found for professor
          response.rating = rating === 'N/A' ? undefined : rating;
        }
        let difficulty = $('div.breakdown-section.difficulty .grade').html();
        if (difficulty) {
          difficulty = difficulty.replace(/\s+/g, '');
          // Difficulty found for professor
          response.difficulty = difficulty === 'N/A' ? undefined : difficulty;
        }
        let again = $('div.breakdown-section.takeAgain .grade').html();
        if (again) {
          again = again.replace(/[\s%]+/g, '');
          // Take again percentage found for professor
          response.again = again === 'N/A' ? undefined : again;
        }
        // Reject if response has undefined values for each 
        if (!(response.rating || response.difficulty || response.again)) {
          reject({});
        }
        resolve(response);
      });
  });
}
