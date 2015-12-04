var crossfilter = require("crossfilter");
var time = require("d3-time");
var Model = require("model-js");
var ChiasmComponent = require("chiasm-component");
var ChiasmDataset = require("chiasm-dataset");
var getColumnMetadata = ChiasmDataset.getColumnMetadata;

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
        var aggregate;
        var interval;
        if(group.aggregation in time){
          aggregate = time[group.aggregation];
          interval = group.aggregation;
        } else if(group.aggregation.indexOf("floor") === 0){
          interval = parseInt(group.aggregation.substr(6));
          aggregate = function(d) {
            return Math.floor(d / interval) * interval;
          };
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

          // Transform the data so column names are nicer?
          //.map(function (d){
          //  var row = {};
          //  row[dimension] = d.key;
          //  row.count = d.value;
          //  return row;
          //});
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
