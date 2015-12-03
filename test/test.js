var ChiasmCrossfilter = require("../index")
    expect = require("chai").expect,
    Chiasm = require("chiasm"),
    ChiasmDataset = require("chiasm-dataset"),
    fs = require("fs"),
    csv = require("d3-dsv").csv;

// This does custom data preprocessing for the flight data.
// Modified from Crossfilter example code: https://github.com/square/crossfilter/blob/gh-pages/index.html#L231
function loadFlightsDataset(){
  var rawData = csv.parse(fs.readFileSync("test/flights-3m.csv", "utf8"));
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
    ChiasmDataset.validate(flightsDataset).then(done);
  });

  it("should compute histogram", function(done) {

    var chiasm = initChiasm();

    chiasm.setConfig({
      "cf": {
        "plugin": "crossfilter",
        "state": {
          "groups": {
            //"dates": {
            //  "dimension": "date",
            //  "aggregation": "day"
            //},
            //"hours": {
            //  "dimension": "hour",
            //  "aggregation": "floor 1"
            //},
            //"delays": {
            //  "dimension": "delay",
            //  "aggregation": "floor 10"
            //},
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
        cf.when("distances", function(distances){
          expect(distances.length).to.equal(37);
          expect(distances[3].key).to.equal(250);
          expect(distances[3].value).to.equal(94);
          done();
        });
      });
    }, console.log);
  });
});
