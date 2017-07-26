//import express package
var express = require("express");

var cors = require('cors');

//import mongodb package
var mongodb = require("mongodb");
var mongoose = require('mongoose');
var DateOnly = require('mongoose-dateonly')(mongoose);

//MongoDB connection URL - mongodb://host:port/dbName
//var dbHost = "mongodb://localhost:27017/mileage_history";

//DB Object
var dbObject;

//get instance of MongoClient to establish connection
var MongoClient = mongodb.MongoClient;

var Schema = mongoose.Schema;
var collection_name = 'mileage_history';
var schemaName = new Schema({
  date: DateOnly,
  mileage: Number
}, {
    collection: collection_name
  });

var Model = mongoose.model('Model', schemaName);
mongoose.connect(process.env.MONGODB_URI);

var initialDate = new Date();
initialDate.setFullYear(2017);
initialDate.setMonth(6);
initialDate.setDate(8);

var endDate = new Date();
endDate.setFullYear(2020);
endDate.setMonth(6);
endDate.setDate(7);

var initialMileage = 50;
var limitMileage = 36050;
var idealMileagePerDay = 36050 / (365 * 3);

Model.findOne({ 'date': initialDate }, function (err, data) {
  if (err) return handleError(err);
  else {
    if (data == null) {
      var initialData = new Model({
        'date': initialDate,
        'mileage': initialMileage
      }).save(function (err, result) {
        if (err) throw err;

        if (result) {
          console.log("initial data successfully inserted...");
        }
      })
    } else {
      console.log("initial data is already inserted...");
    }
  }
})

//Connecting to the Mongodb instance.
//Make sure your mongodb daemon mongod is running on port 27017 on localhost
MongoClient.connect(process.env.MONGODB_URI, function (err, db) {
  if (err) throw err;
  dbObject = db;
});

function convertToDate(date_in_number) {
  var year = Math.trunc(date_in_number / 10000);
  var month_day = date_in_number % 10000;
  var month = Math.trunc(month_day / 100);
  var day = month_day % 100;
  var date_object = new Date(year, month, day);
  return date_object;
}

function dateToLabel(date_object) {
  var month = date_object.getMonth();
  month++;
  var day = date_object.getDate();
  var label = month.toString() + "/" + day.toString();
  return label;
}

function getDiffDays(date1, date2) {
  var timeDiff = Math.abs(date2.getTime() - date1.getTime());
  var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return diffDays;
}

function getData(responseObj) {
  //use the find() API and pass an empty query object to retrieve all records
  dbObject.collection(collection_name).find({}).toArray(function (err, docs) {
    if (err) throw err;
    var dateArray = [];
    var mileageArray = [];
    var idealMileageArray = [];

    var dateArrayBeforeInter = [];
    var mileageArrayBeforeInter = [];

    for (index in docs) {
      var doc = docs[index];
      var date = doc['date']; // ex) 20170622
      var date_object = convertToDate(date);
      var mileage = doc['mileage'];
      dateArrayBeforeInter.push(date_object);
      mileageArrayBeforeInter.push(mileage);
    }

    // interpolation
    for (var i = 0; i < dateArrayBeforeInter.length - 1; i++) {
      var currentDate = dateArrayBeforeInter[i];
      var nextDate = dateArrayBeforeInter[i + 1];
      var diffDays = getDiffDays(currentDate, nextDate);
      var currentMileage = mileageArrayBeforeInter[i];
      var nextMileage = mileageArrayBeforeInter[i + 1];
      dateArray.push({ "label": dateToLabel(currentDate) });
      mileageArray.push({ "value": currentMileage });
      if (diffDays != 1) {
        var diffMileage = nextMileage - currentMileage;
        var internalMileage = diffMileage / diffDays;
        for (var step = 0; step < diffDays - 1; step++) {
          var newDate = new Date(currentDate);
          newDate.setDate(currentDate.getDate() + step + 1);
          dateArray.push({ "label": dateToLabel(newDate) });

          var newMileage = Math.trunc(currentMileage + internalMileage * (step + 1));
          mileageArray.push({ "value": newMileage });
        }
      }
    }

    dateArray.push({ "label": dateToLabel(dateArrayBeforeInter[dateArrayBeforeInter.length - 1]) });
    mileageArray.push({ "value": mileageArrayBeforeInter[mileageArrayBeforeInter.length - 1] });

    // create idealMileageArray
    for (var i = 0; i < dateArray.length; i++) {
      idealMileageArray.push({ "value": Math.trunc(initialMileage + idealMileagePerDay*i) });
    }

    var dataset = [
      {
        "seriesname": "Current Mileage",
        "data": mileageArray
      },
      {
        "seriesname": "Ideal Mileage",
        "data": idealMileageArray
      }
    ];

    var response = {
      "dataset": dataset,
      "categories": dateArray,
      "size": Math.round(dateArray.length/4)
    };
    responseObj.json(response);
  });
}

//create express app
var app = express();

//NPM Module to integrate Handlerbars UI template engine with Express
var exphbs = require('express-handlebars');

//Declaring Express to use Handlerbars template engine with main.handlebars as
//the default layout
app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

//Defining middleware to serve static files
app.use('/public', express.static('public'));
app.get("/mileage", function (req, res) {
  getData(res);
});
app.get("/", function (req, res) {
  res.render("chart");
});

app.get('/save/:query', cors(), function (req, res) {

  var date = new Date();
  date.setDate(date.getDate() + 3);
  var mileage = parseInt(req.query.mileage);

  Model.findOne({ 'date': date }, function (err, data) {
    if (err) return handleError(err);
    else {
      if (data == null) {
        var savedata = new Model({
          'date': date,
          'mileage': mileage
        }).save(function (err, result) {
          if (err) throw err;

          if (result) {
            res.json(result);
          }
        })
      } else {
        data.mileage = mileage;
        data.save();
        res.json(data);
      }
    }
  })
});

app.listen(process.env.PORT || 3300, function () {
  console.log('Server up:');
});
