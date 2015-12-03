var ChiasmComponent = require("chiasm-component");
var crossfilter = require("crossfilter");
var Model = require("model-js");

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
        if(group.aggregation === "day"){
          aggregate = d3.time.day;
        } else if(group.aggregation.indexOf("floor") === 0){
          var interval = parseInt(group.aggregation.substr(6));
          aggregate = function(d) {
            return Math.floor(d / interval) * interval;
          };
        }

        var cfGroup = cfDimension.group(aggregate);

        var updateMyGroup = function (){
          my[groupName] = cfGroup.all();

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
