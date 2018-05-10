/**
 *  algorithm.js
 *  Takes in the name of a course and ranks professors that teach the course
 */
const fetch = require('node-fetch');
const Cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();

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
        let promises = profs.map(prof => {
          return getProfInfo(prof);
        });
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
  // Gets professor ratings from response objects
  let ratings = [];
  responses.forEach(res => ratings.push(res.rating));

  // Gets average rating of professors that have ratings on Rate My Professors
  let numProfs = 0;
  let sum = 0.0;
  ratings.forEach(rating => {
    // Only adds to sum if professor has a rating
    if (rating) {
      sum += parseFloat(rating);
      numProfs++;
    }
  });
  let avg = sum / numProfs;

  let scores = [];
  for (let i = 0; i < profs.length; i++) {
    // Sets Rate My Professor rating to average if professor has no rating
    if (ratings[i] === '-1.0') {
      ratings[i] = avg;
    } else {
      // Converts ratings in array from strings to floats
      ratings[i] = parseFloat(ratings[i]);
    }

    // GPA that a student gets for getting between an A+ and an F
    const gpa = [4, 4, 3.67, 3.33, 3, 2.67, 2.33, 2, 1.67, 1.33, 1, 0.67, 0];
    // Calculates average GPA of students in the course
    let avgGpa = 0;
    percentages[i].forEach((percent, j) => avgGpa += percent * gpa[j]);
    // Normalize average GPA to be out of 5 instead of 4
    avgGpa *= (5.0 / 4.0);

    // Score is normalized average GPA + Rate My Professors rating
    // If none of the professors are on RMP, score is avg GPA scaled out of 10
    // Max score is 10
    let score = (numProfs === 0) ? avgGpa + ratings[i] : avgGpa * 2;
    scores.push(score);
  }
  return scores;
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
const responseKeys = ['rating'];

// Scrapes info of professor on Rate My Professors
function scrapeProfInfo(link) {
  return new Promise((resolve, reject) => {
    fetch(link)
      .then(resp => resp.text())
      .then(html => {
        // Queries the link to the professor's page
        let $ = Cheerio.load(html);
        let response = {};
        let rating = $('[class=\'breakdown-container quality\'] .grade').html();
        if (rating) {
          rating = rating.replace(/\s+/g, '');
          // Overall rating found for professor
          response.rating = rating;
        }
        // Reject if response is empty
        if (response == {}) {
          reject(response);
        }
        resolve(response);
      });
  });
}
