/**
 *
 */
const Request = require("request");
const Cheerio = require("cheerio");
const sqlite3 = require('sqlite3').verbose();

module.exports = function myFunc(courseNumber) {
  return new Promise(function(resolve, reject) {
    let db = new sqlite3.Database("./grades.db", sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error(err.message);
      }
      console.log("Connected to the grades database.");
    });
    
    var rts = courseNumber.split(" ");
    db.serialize(() => {
      let sql = `SELECT prof AS name, a1, a2, a3, b1, b2, b3, c1, c2, c3, d1, d2, d3, f
                FROM agg
                WHERE dept = ? AND course_nbr = ?
                ORDER BY name`;

      var profs = [];
      var percentages = [];
      db.each(sql, [rts[0], rts[1]], (err, row) => {
        if (err) {
          throw err;
        }
        var splitName = row.name.split(/ +/);
        var finalName = splitName[1] + " " + splitName[0];
        profs.push(finalName);

        var totalStudents = row.a1 + row.a2 + row.a3 + row.b1 + row.b2 + row.b3
                          + row.c1 + row.c2 + row.c3 + row.d1 + row.d2 + row.d3
                          + row.f;
        var currPercentages = [];
        currPercentages.push((row.a1 + row.a2) / totalStudents * 100);
        currPercentages.push(row.a3 / totalStudents * 100);
        var letters = ["b", "c", "d"];
        var numbers = ["1", "2", "3"];
        letters.forEach((letter) => {
          numbers.forEach((number) => {
            currPercentages.push(row[letter + number] / totalStudents * 100);
          });
        });
        currPercentages.push(row.f / totalStudents * 100);
        percentages.push(currPercentages);
      }, () => {
        // console.log(profs);
        // console.log(percentages);

        ratings(profs, percentages, function(res) {
          var resCopy = res.concat([]);
          console.log(resCopy);
          resCopy.sort();
          var profsCopy = [];
          for (var i = resCopy.length - 1; i > -1; i--) {
            var index = res.indexOf(resCopy[i]);
            profsCopy.push(profs[index]);
          }
          console.log(profsCopy);
          // FINAL OUTPUT
          resolve(profsCopy);
        });
      });
      
      db.close();
    });

    function ratings(array, percentages, callback) {
      overallRating(array, function(res) {
        var sum = 0.0;
        for (var i = 0; i < res.length; i++) {
          if (res[i] != -1)
            sum += res[i];
        }
        var avg = sum / res.length;

        var scores = [];

        var index = -1;
        var best = -0.1;
        for (var i = 0; i < array.length; i++) {
          if (res[i] === -1) {
            res[i] = avg;
          }
          var gpa = [4, 3.67, 3.33, 3, 2.67, 2.33, 2, 1.67, 1.33, 1, 0.67, 0];
          var avgGpa = 0;
          for (var j = 0; j < percentages[i].length; j++) {
            avgGpa += percentages[i][j] * gpa[j];
          }
          avgGpa /= 100.0;
          avgGpa = avgGpa * 5.0 / 4.0;

          var score = avgGpa + res[i];
          scores.push(score);
        }

        callback(scores);

      });
    }

    //Gets an array of ratings
    function overallRating(array, callback) {
      var json = {};
      // Goes through list of professors
      for (var i = 0; i < array.length; i++) {
        var name = array[i];
        name = name.replace(" ", "+");
        // Link to query Rate My Professors
        var link = "http://www.ratemyprofessors.com/search.jsp?queryoption=HEADER&queryBy=teacherName" +
          "&schoolName=University+of+Texas+at+Austin&schoolID=1255&query=" + name;

        // Queries the link to the professor search results
        Request(link, function(err, resp, body) {
          if (!err && resp.statusCode == 200) {
            var $ = Cheerio.load(body);

            // Checks if any results are found
            var htmas = $("div.not-found-box").next().html();
            if (!htmas.includes("Your search")) {
              // Gets the link for the first result
              $(".listings").filter(function() {
                var endLink = $($(this)[0].children[3].children[1]).attr("href");
                var link2 = "http://www.ratemyprofessors.com" + endLink;

                // Queries the link to the professor's page
                Request(link2, function(error, response, html) {
                  if (!error && response.statusCode == 200) {
                    var $ = Cheerio.load(html),
                    overallQuality = $("[class='breakdown-container quality'] .grade").html();
                    if (overallQuality != null) {
                      var overallQuality = overallQuality.replace(/\s+/g, "");
                      firstName = $(".pfname").html();
                      lastName = $(".plname").html();
                      var firstName = firstName.replace(/\s+/g, "");
                      var lastName = lastName.replace(/\s+/g, "");
                      //console.log(firstName + " " + lastName + " " + overallQuality);
                      json[lastName.toUpperCase()] = overallQuality;
                    } else {
                      var overallQuality = -1.0;
                      name = $("div.name").html();
                      //console.log(name + " " + overallQuality);
                      var i = name.indexOf(" ");
                      json[name.substring(i + 1).toUpperCase()] = overallQuality;
                    }
                  }
                });
              });
            } else {
              // No results found in Rate My Professors
              //console.log("Doesn't matter" + " " + -1.0);
            }
          }
        });
      }

      // Converts json to array after 2.5 seconds
      setTimeout(function() {
        var arr = [];
        for (var i = 0; i < array.length; i++) {
          var index = array[i].indexOf(" ");
          if (json[array[i].substring(index + 1)] == null)
            arr[i] = -1;
          else
            arr[i] = parseFloat(json[array[i].substring(index + 1)]);
        }
        callback(arr);
      }, 2500);
    }
  });
}
