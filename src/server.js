const getProfData = require('./algorithm');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');

const app = express();
const upload = multer();

var PORT = process.env.PORT || 3000;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/home', upload.any(), (req, res) => {
  var course = req.body.course;
  console.log('Course:', course);

  // Get the sorted list of professors and their scores
  getProfData(course)
    .then(function(data) {
      if (data.list.length == 0)
        res.send('Not found in database. Ensure spelling.');
      else {
        const leftTag = '<td style="font-size:18px;font-family:Roboto;color:black;">';
        const rightTag = '<td style="font-size:18px;font-family:Roboto;color:black;">';
        var output = '<table style="width:40%;margin-left:26%;margin-right:20%;">';
        output += `<tr>${leftTag}<b>Professor</b></td>${rightTag}<b>Score</b></td></tr>`;
        data.list.forEach(prof => {
          var arr = prof.split(' ');
          var name = arr[0].substring(0, 1) + arr[0].substring(1).toLowerCase() + ' ';
          name += (arr[1].substring(0, 1) + arr[1].substring(1).toLowerCase());
          output += '<tr>';
          output += (leftTag + name + '</td>');
          output += (rightTag + (Math.round(data.scores[prof] * 100) / 100) + '</td>');
          output += '</tr>';
        });
        output += '</table>';
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
