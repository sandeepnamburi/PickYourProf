var abhinav = require('./catalystFull.js')
var express = require('express')
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();

const app = express()

var PORT = process.env.PORT || 3000;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.post('/home', upload.array(), function (req, res) {

  //app.use(express.bodyParser());
  var ret = "";

  var txt = JSON.stringify(req.body);

  var numb = txt.replace("{\"course\":\"", "")
  var numb2 = numb.replace("\"}", "");
  numb2 = numb2.toUpperCase();

  console.log('req.body', numb2);

  // Do some stuff
  abhinav(numb2)
  .then(function(resp) {
    var x = "Professors listed from best to worst: ";
    for (var i = 0; i < resp.length; i++) {
      x += (resp[i]);
      if (i < resp.length - 1)
        x += ", ";
    }
    res.send(x);
  });

  // Return a response to the browser

});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/rithvik.html');
});

app.listen(PORT, function () {
  console.log('Example app listening on http://localhost:' + PORT)
})
