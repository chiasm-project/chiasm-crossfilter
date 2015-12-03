var ChiasmCrossfilter = require("../index");
var expect = require("chai").expect;
var fs = require("fs");
var csv = require("d3-dsv").csv;
var Chiasm = require("chiasm");
var ChiasmDataset = require("chiasm-dataset");
var getColumnMetadata = ChiasmDataset.getColumnMetadata;

// This does custom data preprocessing for the flight data.
// Modified from Crossfilter example code: https://github.com/square/crossfilter/blob/gh-pages/index.html#L231
function loadFlightsDataset(){
  var rawData = csv.parse(fs.readFileSync("test/flights-3m-sample.csv", "utf8"));
  return {
    data: rawData.map(function (d){
      d.date = parseDate(d.date);
      d.hour = d.date.getHours() + d.date.getMinutes() / 60;
      d.delay = Math.max(-60, Math.min(149, d.delay));
      d.distance = Math.min(1999, +d.distance);
      return d;
    }),
    metadata: {
      "columns": [
        { "name": "date", "type": "date" },
        { "name": "hour", "type": "number" },
        { "name": "delay", "type": "number" },
        { "name": "distance", "type": "number" }
      ]
    }
  };
}
function parseDate(d) {
  return new Date(2001,
    d.substring(0, 2) - 1,
    d.substring(2, 4),
    d.substring(4, 6),
    d.substring(6, 8));
}

var flightsDataset = loadFlightsDataset();

function initChiasm(){
  var chiasm = Chiasm();
  chiasm.plugins.crossfilter = ChiasmCrossfilter = require("../index");
  return chiasm;
}

describe("chiasm-crossfilter", function () {

  it("input dataset should be valid", function(done) {
    ChiasmDataset.validate(flightsDataset).then(done, console.log);
  });

  it("should compute histogram (interval of 50)", function(done) {
    var chiasm = initChiasm();
    chiasm.setConfig({
      "cf": {
        "plugin": "crossfilter",
        "state": {
          "groups": {
            "distances": {
              "dimension": "distance",
              "aggregation": "floor 50"
            }
          }
        }
      }
    }).then(function(){
      chiasm.getComponent("cf").then(function(cf){
        cf.dataset = flightsDataset;
        cf.when("distances", function(dataset){
          expect(dataset.data.length).to.equal(35);
          expect(dataset.data[3].key).to.equal(250);
          expect(dataset.data[3].value).to.equal(111);

          expect(dataset.isCube);
          expect(getColumnMetadata(dataset, "key").interval).to.equal(50);

          ChiasmDataset.validate(dataset).then(done, console.log);
        });
      });
    }, console.log);
  });

  it("should compute histogram (interval of days)", function(done) {
    var chiasm = initChiasm();
    chiasm.setConfig({
      "cf": {
        "plugin": "crossfilter",
        "state": {
          "groups": {
            "dates": {
              "dimension": "date",
              "aggregation": "day"
            }
          }
        }
      }
    }).then(function(){
      chiasm.getComponent("cf").then(function(cf){
        cf.dataset = flightsDataset;
        cf.when("dates", function(dataset){
          expect(dataset.data.length).to.equal(88);
          expect(dataset.data[3].key.getTime()).to.equal(
            new Date("Thu Jan 04 2001 00:00:00 GMT-0800 (PST)").getTime());
          expect(dataset.data[3].value).to.equal(11);

          expect(dataset.isCube);
          expect(getColumnMetadata(dataset, "key").interval).to.equal("day");

          ChiasmDataset.validate(dataset).then(done, console.log);
        });
      });
    }, console.log);
  });
});
