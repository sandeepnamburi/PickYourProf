var google = require('google')

google.resultsPerPage = 25
var nextCounter = 0

var prompt = require('prompt');
var casper = require('casper').create();
var opn = require('opn');


prompt.get(['firstName2', 'lastName2'], function (err, result) {
    if (err) { return onErr(err); }
    console.log('Command-line input received:');
    console.log('  First Name: ' + result.firstName2);
    console.log('  Last Name: ' + result.lastName2);

    var URL = "http://www.ratemyprofessors.com/search.jsp?queryoption=HEADER&queryBy=teacherName&schoolName=University+of+Texas+at+Austin&schoolID=1255&query="+result.firstName+"+"+result.lastName;

    google(result.firstName2 + result.lastName2 + 'university of texas rate my professor', function (err, res)  {
      if (err) console.error(err)

        var link = res.links[0];
        console.log(link.href)

        var request = require("request"),
          cheerio = require("cheerio"),
          url = link.href;

        request(url, function (error, response, body) {
          if (!error) {
            var $ = cheerio.load(body),
              firstName = $("[class='pfname']").html();
              lastName = $("[class='plname']").html();
              difficulty = $("[class='breakdown-section difficulty'] .grade").html();
              overallQuality = $("[class='breakdown-container quality'] .grade").html();
              var firstName = firstName.replace(/\s+/g, "");
              var lastName = lastName.replace(/\s+/g, "");
              var difficulty = difficulty.replace(/\s+/g, "");
              var overallQuality = overallQuality.replace(/\s+/g, "");

            console.log(firstName + " " + lastName + "'s overall difficulty is " + difficulty + ".");
            console.log(firstName + " " + lastName + "'s overall quality is " + overallQuality + ".");

          } else {
            console.log("Sorry we messed up somewhere: " + error);
          }
        });

    })

  });

  function onErr(err) {
    console.log(err);
    return 1;
  }

  $('.btn').click(function() {

    $('.text').text('loading . . .');

    $.ajax({

      type:"GET",
      url:"https://api.meetup.com/2/cities",
      success: function(data) {
        $('.text').text(JSON.stringify(data));
      },
      dataType: 'jsonp',
      error: function() {
        console.log("Something went wrong, data could not be fetched");
      }
    });
    console.log('hello', hello);
    //console.log($("#city").text());
  });
