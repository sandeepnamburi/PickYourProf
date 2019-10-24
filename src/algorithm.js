/**
 *  algorithm.js
 *  Takes in the name of a course and ranks professors that teach the course
 */
const fetch = require('node-fetch');
const Cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const moment = require('moment');

// SQL query for getting professors and their grade data for a course
let PROF_QUERY = `SELECT prof AS name, a1, a2, a3, b1, b2, b3, c1, c2, c3, d1, d2,
                  d3, f, rating, difficulty, take_again, sentiment, last_updated
                  FROM agg
                  INNER JOIN rmp_cache
                  ON agg.prof=rmp_cache.professor
                  WHERE dept = ? AND course_nbr = ?
                  ORDER BY name`;

// SQL query for caching new RMP data
let CACHE_QUERY = `UPDATE rmp_cache
                  SET rating = ?, difficulty = ?, take_again = ?, sentiment = ?, last_updated = ?
                  WHERE professor = ?;`

module.exports = courseNumber => {
  return new Promise((resolve, reject) => {
    let db = new sqlite3.Database('./grades.db', sqlite3.OPEN_READWRITE, err => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Connected to the grades database.');
      }
    });

    let rts = courseNumber.split(' ');
    db.serialize(() => {
      // List of professor objects
      let profs = [];
      // Gets information on each professor teaching the given course
      db.each(PROF_QUERY, rts, (err, row) => {
        if (err) {
          throw err;
        }
        // Reorders full name into first name, last name
        let splitName = row.name.split(/,?\s+/);
        let finalName = splitName[1] + ' ' + splitName[0];
        row.oldName = row.name;
        row.name = finalName;
        let currPerc = getGradePercentages(row.a1, row.a2, row.a3, row.b1, row.b2,
          row.b3, row.c1, row.c2, row.c3, row.d1, row.d2, row.d3, row.f);
        row.currPerc = currPerc;
        row.dirty = false;
        profs.push(row);
      }, () => {
        let promises = profs.map(prof => getProfInfo(prof));
        // Gets the Rate My Professors info for each professor
        // Calculates the Pick Your Prof score for each professor
        Promise.all(promises)
          .then(responses => {
            profs.forEach((prof, i) => {
              let resp = responses[i];
              // Cache new RMP data to database if prof object is dirty
              if (prof.dirty) {
                db.run(CACHE_QUERY, resp.rating, resp.difficulty, resp.again, resp.sentimentAvg, prof.last_updated, prof.oldName);
              }
            });

            let scores = getScores(profs, responses);
            // Zip up the profs and scores into an object
            let profData = {};
            profs.forEach((prof, i) => profData[prof.name] = scores[i]);
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
            db.close();
            // FINAL OUTPUT
            resolve(finalData);
          });
      });
    });
  });
}

// Stores info of the percentage of each class that got each grade
function getGradePercentages(...distribution) {
  let totalStu = distribution.reduce((a, b) => a + b, 0);
  distribution.forEach((numStu, i) => distribution[i] = numStu / totalStu);
  return distribution;
}

// Gets the PickYourProf score for each professor
function getScores(profs, responses) {
  // Gets the average of all the professor's metric averages
  let numProfs = 0;
  let sum = 0;
  let metricAverages = [];
  let metricAverage;
  for (let resp of responses) {
    if (!resp.rating && !resp.difficulty && !resp.again && !resp.sentimentAvg) {
      metricAverages.push(-1);
    } else {
      numProfs++;
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
    profs[i].currPerc.forEach((percent, j) => avgGpa += percent * gpa[j]);
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
      // Make rating worth more than sentiment, difficulty and take again
      if (res[prop]) {
        if (prop === 'rating') {
          metricSum += res[prop];
          numMetrics++;
        } else {
          metricSum += res[prop] / 4;
          numMetrics += 1 / 4;
        }
      }
    }
    return metricSum / numMetrics;
  }
}

// Base URL for HTTP request
const baseURL = 'http://www.ratemyprofessors.com/search.jsp?queryoption=HEADER' +
  '&queryBy=teacherName&schoolName=University+of+Texas+at+Austin&schoolID=1255&query=';

// Gets the rating for a professor
function getProfInfo(prof) {
  return new Promise((resolve, reject) => {
    // If the cache entry is empty or old
    if (!prof.last_updated || moment().diff(moment(prof.last_updated), 'days') > 7) {
      // Set dirty to true if need to scrape RateMyProfessors for new data
      prof.dirty = true;
      prof.last_updated = moment().valueOf();
      let name = prof.name.replace(' ', '+');
      let link = baseURL + name;
      // Searches for the professor on Rate My Professors
      // If professor found, then gets the professor's rating
      scrapeProfLink(link)
        .then(endLink => {
          scrapeProfInfo('http://www.ratemyprofessors.com' + endLink)
            .then(resp => {
              normalizeMetrics(resp);
              return resolve(resp);
            })
            .catch(e => resolve(e));
        })
        .catch(err => resolve(err));
    } else {
      // If the cache entry is less than a week old
      resolve({
        rating: prof.rating,
        difficulty: prof.difficulty,
        again: prof.take_again,
        sentimentAvg: prof.sentiment
      });
    }
  });

  // Normalize metrics in response to be out of 5.0 and fix types
  function normalizeMetrics(res) {
    res.rating = res.rating ? parseFloat(res.rating) : undefined;
    // 5 - difficulty because we want to make higher difficulty be lower rating
    res.difficulty = res.difficulty ? 5 - parseFloat(res.difficulty) : undefined;
    // Again percentage / 20 to normalize it out of 5
    res.again = res.again ? parseFloat(res.again) / 20 : undefined;
    // Change sentiment scale from -5 to 5 to 0 to 5
    res.sentimentAvg = res.sentimentAvg ? (res.sentimentAvg + 5) / 2 : undefined;
  }
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
          $('.listings').filter(function () {
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
const responseKeys = ['rating', 'difficulty', 'again', 'sentimentAvg'];

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
        let numComments = 0;
        let sentimentSum = 0;
        let comment, sentimentRes, commentSentiment, id;
        $('tr').each(function (i, elem) {
          id = $(this).attr('id');
          // Checks if id exists, has a nonzero length, and is a number
          if (id && !isNaN(id)) {
            comment = $(this).children()[2].children[3].children[0].data.trim();
            sentimentRes = sentiment.analyze(comment);
            if (sentimentRes.words.length === 0)
              commentSentiment = 0;
            else
              commentSentiment = sentimentRes.score / sentimentRes.words.length;
            sentimentSum += commentSentiment;
            numComments++;
          }
        });
        response.sentimentAvg = numComments === 0 ? undefined : sentimentSum / numComments;
        // Reject if response has undefined values for each 
        if (!(response.rating ||
          response.difficulty ||
          response.again ||
          response.sentimentAvg)) {
          reject({});
        }
        resolve(response);
      });
  });
}
