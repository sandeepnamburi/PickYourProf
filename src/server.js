const getProfData = require('./algorithm');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');

const app = express();
const upload = multer();

let PORT = process.env.PORT || 3000;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/home', upload.any(), (req, res) => {
  let course = req.body.course;
  console.log('Course:', course);

  // Get the sorted list of professors and their scores
  getProfData(course)
    .then(function(data) {
      if (data.list.length == 0)
        res.send('Not found in database. Ensure spelling.');
      else {
        // HTML tags for output formatting
        const leftTag = '<td style="font-size:18px;font-family:Roboto;color:black;">';
        const rightTag = '<td style="font-size:18px;font-family:Roboto;color:black;">';
        let output = '<table style="width:40%;margin-left:26%;margin-right:20%;">';
        output += `<tr>${leftTag}<b>Professor</b></td>${rightTag}<b>Score</b></td></tr>`;
        data.list.forEach(prof => {
          // Formats the name correctly
          let name = formatName(prof);
          output += '<tr>';
          output += (leftTag + name + '</td>');
          output += (rightTag + (Math.round(data.scores[prof] * 100) / 100) + '</td>');
          output += '</tr>';
        });
        output += '</table>';
        // Sends output to HTML file to be printed on the webpage
        res.send(output);
      }
    });

});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Example app listening on http://localhost:' + PORT);
});

function formatName(name) {
  // Capitalize only the first letter of first and last name
  let arr = name.split(' ');
  let first = arr[0].substring(0, 1) + arr[0].substring(1).toLowerCase();
  let last = (arr[1].substring(0, 1) + arr[1].substring(1).toLowerCase());
  // Fix the cases where there is a hyphen in the person's name
  arr = first.split('-');
  if (arr.length > 1)
    first = arr[0] + '-' + arr[1].substring(0, 1).toUpperCase() + arr[1].substring(1);
  arr = last.split('-');
  if (arr.length > 1)
    last = arr[0] + '-' + arr[1].substring(0, 1).toUpperCase() + arr[1].substring(1);
  return first + ' ' + last;
}