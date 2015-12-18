var crossfilter = require("crossfilter");
var time = require("d3-time");
var Model = require("model-js");
var ChiasmComponent = require("chiasm-component");
var ChiasmDataset = require("chiasm-dataset");
var getColumnMetadata = ChiasmDataset.getColumnMetadata;

// These are the supported time intervals for aggregation.
// UTC is used for aggregation intervals because otherwise,
// d3-time would use local times, and different users would 
// get different results (see different visualizations)
// depending on which time zone they are in. 
var timeIntervals = {
  millisecond: "utcMillisecond",
  second: "utcSecond",
  minute: "utcMinute",
  hour: "utcHour",
  day: "utcDay",
  week: "utcWeek",
  month: "utcMonth",
  year: "utcYear"
};

// This function defines a Chiasm component that exposes a Crossfilter instance
// to visualizations via the Chaism configuration.
function ChiasmCrossfilter() {

  var my = new ChiasmComponent({
    groups: Model.None
  });

  var listeners = [];

  my.when(["dataset", "groups"], function (dataset, groups){
    var data = dataset.data;

    if(groups !== Model.None) {
      var cf = crossfilter(data);
      var updateFunctions = [];

      listeners.forEach(my.cancel);

      listeners = Object.keys(groups).map(function (groupName){

        var group = groups[groupName];
        var dimension = group.dimension;
        var cfDimension = cf.dimension(function (d){ return d[dimension]; });

        // Generate an aggregate function by parsing the "aggregation" config option.
        var aggregate = function (d){ return d; };
        var interval;
        if(group.aggregation){
          if(group.aggregation in timeIntervals){
            aggregate = time[timeIntervals[group.aggregation]];
            interval = group.aggregation;
          } else if(group.aggregation.indexOf("floor") === 0){
            interval = parseInt(group.aggregation.substr(6));
            aggregate = function(d) {
              return Math.floor(d / interval) * interval;
            };
          } else {
            throw new Error("Invalid aggregation configuration: " + group.aggregation);
          }
        }

        var cfGroup = cfDimension.group(aggregate);

        var columnMetadata = getColumnMetadata(dataset, dimension);

        var metadata = {
          isCube: true,
          columns: [
            {
              name: "key",
              type: columnMetadata.type,
              label: columnMetadata.label,
              isDimension: true,
              interval: interval
            },
            {
              name: "value",
              type: "number",
              label: "count"
            }
          ]
        };

        var updateMyGroup = function (){
          my[groupName] = {
            data: cfGroup.all(),
            metadata: metadata
          };
        };

        updateFunctions.push(updateMyGroup);
        updateMyGroup();

        return my.when(dimension + "Filter", function (extent){
          if(extent !== Model.None){
            cfDimension.filterRange(extent);
          } else {
            cfDimension.filterAll();
          }
          updateFunctions.forEach(function (updateFunction){
            if(updateFunction !== updateMyGroup){
              updateFunction();
            }
          });
        });
      });
    }
  });
  return my;
}

module.exports = ChiasmCrossfilter;
