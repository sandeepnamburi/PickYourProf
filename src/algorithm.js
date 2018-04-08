/**
 *
 */
const fetch = require("node-fetch");
const Cheerio = require("cheerio");
const sqlite3 = require('sqlite3').verbose();

module.exports = courseNumber => {
  return new Promise((resolve, reject) => {
    let db = new sqlite3.Database("./grades.db", sqlite3.OPEN_READONLY, err => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Connected to the grades database.");
      }
    });
    
    var rts = courseNumber.split(" ");
    db.serialize(() => {
      // SQL query for getting professors and their grade data for a course
      let sql = `SELECT prof AS name, a1, a2, a3, b1, b2, b3, c1, c2, c3, d1, d2, d3, f
                FROM agg
                WHERE dept = ? AND course_nbr = ?
                ORDER BY name`;

      var profs = [];
      // 2D array storing percentage of class that got each grade for each prof
      var percentages = [];
      // Gets information on each professor teaching the given course
      db.each(sql, rts, (err, row) => {
        if (err) {
          throw err;
        }
        // Reorders full name into first name, last name
        var splitName = row.name.split(/ +/);
        var finalName = splitName[1] + " " + splitName[0];
        profs.push(finalName);
        delete row.name;
        // Stores info of the percentage of each class that got each grade
        var numStudents = Object.values(row).reduce((a, b) => a + b, 0);
        var currPercentages = [];
        var letters = ["a", "b", "c", "d"];
        var numbers = ["1", "2", "3"];
        letters.forEach(letter => {
          numbers.forEach(number => {
            currPercentages.push(row[letter + number] / numStudents * 100);
          });
        });
        currPercentages.push(row.f / numStudents * 100);
        percentages.push(currPercentages);
      }, () => {
        var promises = profs.map(prof => {
          return getProfRating(prof);
        });
        // Gets the Rate My Professors rating for each professor
        Promise.all(promises)
          .then(ratings => {
            var scores = getScores(profs, ratings, percentages);
            // Zip up the profs and scores into an object
            var profData = {};
            profs.forEach((prof, i) => profData[prof] = scores[i]);
            console.log(profData);
            // Sort professors by their scores in descending order
            var sortedProfs = Object.keys(profData).sort((a, b) => {
              return profData[b] - profData[a];
            });

            // FINAL OUTPUT
            resolve(sortedProfs);
          });
      });
      
      db.close();
    });

  });
}

// Gets the PickYourProf score for each professor
function getScores(profs, ratings, percentages) {
  // Gets average rating of professors that have ratings on Rate My Professors
  var numProfs = 0;
  var sum = 0.0;
  ratings.forEach(rating => {
    // Only adds to sum if professor has a rating
    if (rating !== '-1.0') {
      sum += parseFloat(rating);
      numProfs++;
    }
  });
  var avg = sum / numProfs;

  var scores = [];
  for (var i = 0; i < profs.length; i++) {
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
    var avgGpa = 0;
    percentages[i].forEach((percent, j) => avgGpa += percent * gpa[j]);
    avgGpa /= 100.0;
    // Normalize average GPA to be out of 5 instead of 4
    avgGpa *= (5.0 / 4.0);

    // Score is normalized average GPA + Rate My Professors rating
    // Max score is 10
    var score = avgGpa + ratings[i];
    scores.push(score);
  }
  return scores;
}

// Base URL for HTTP request
const baseURL = "http://www.ratemyprofessors.com/search.jsp?queryoption=HEADER" + 
  "&queryBy=teacherName&schoolName=University+of+Texas+at+Austin&schoolID=1255&query=";

// Gets the rating for a professor
function getProfRating(name) {
  return new Promise((resolve, reject) => {
    // Goes through list of professors
    name = name.replace(" ", "+");
    // Link to query Rate My Professors
    var link = baseURL + name;
    // Searches for the professor on Rate My Professors
    // If professor found, then gets the professor's rating
    fetchProfLink(link)
      .then(endLink => {
        return fetchProfRating("http://www.ratemyprofessors.com" + endLink);
      })
      .then(rating => resolve(rating))
      .catch(err => resolve(err));
  });
}

// Gets link of professor on Rate My Professors
function fetchProfLink(link) {
  return new Promise((resolve, reject) => {
    fetch(link)
      .then(res => res.text())
      .then(body => {
        var $ = Cheerio.load(body);
        // Checks if any results are found
        var htmas = $("div.not-found-box").next().html();
        if (!htmas.includes("Your search")) {
          // Gets the link for the first result
          $(".listings").filter(function() {
            var endLink = $($(this)[0].children[3].children[1]).attr("href");
            resolve(endLink);
          });
        } else {
          // No results found in Rate My Professors for the professor
          reject('-1.0');
        }
      })
      .catch(err => reject('-1.0'));
  });
  
}

// Gets rating of professor on Rate My Professors
function fetchProfRating(link) {
  return fetch(link)
    .then(resp => resp.text())
    .then(html => {
      // Queries the link to the professor's page
      var $ = Cheerio.load(html);
      var overallQuality = $("[class='breakdown-container quality'] .grade").html();
      if (overallQuality != null) {
        overallQuality = overallQuality.replace(/\s+/g, "");
        // Overall rating found for professor
        return overallQuality;
      } else {
        // No overall rating found for professor
        throw new Error('-1.0');
      }
    });
}