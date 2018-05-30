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
    .then(data => {
      if (data.list.length == 0)
        res.send('Not found in database. Ensure spelling.');
      else {
        // HTML tags for output formatting
        const tag = '<td style="font-size:18px;font-family:Roboto;color:black;">';
        let output = '<table style="width:40%;margin-left:26%;margin-right:20%;">';
        output += `<tr>${tag}<b>Professor</b></td>${tag}<b>Score</b></td></tr>`;
        for (let prof of data.list) {
          // Formats the name correctly
          let name = formatFullName(prof);
          output += '<tr>';
          output += (tag + name + '</td>');
          output += (tag + (Math.round(data.scores[prof] * 100) / 100) + '</td>');
          output += '</tr>';
        }
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

function formatFullName(name) {
  // Capitalize only the first letter of first and last name and account for hyphens
  let tokens = name.split(' ');
  let first = formatToken(tokens[0]);
  let last = formatToken(tokens[1]);
  return first + ' ' + last;

  function formatToken(token) {
    token = token.substring(0, 1) + token.substring(1).toLowerCase();
    let arr = token.split('-');
    return arr.length < 2 ? token : `${arr[0]}-${arr[1].substr(0, 1).toUpperCase()}${arr[1].substr(1)}`;
  }
}
