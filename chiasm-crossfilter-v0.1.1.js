(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ChiasmCrossfilter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
var crossfilter = (typeof window !== "undefined" ? window['crossfilter'] : typeof global !== "undefined" ? global['crossfilter'] : null);
var time = require("d3-time");
var Model = (typeof window !== "undefined" ? window['Model'] : typeof global !== "undefined" ? global['Model'] : null);
var ChiasmComponent = (typeof window !== "undefined" ? window['ChiasmComponent'] : typeof global !== "undefined" ? global['ChiasmComponent'] : null);
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"chiasm-dataset":2,"d3-time":3}],2:[function(require,module,exports){
var strings = {
  data_missing: "The dataset.data property does not exist.",
  data_not_array: "The dataset.data property is not an array, its type is '%type%'.",
  data_not_array_of_objects: [
    "The dataset.data property is not an array of row objects,",
    " it is an array whose elements are of type '%type%'."
  ].join(""),
  metadata_missing: "The dataset.metadata property is missing.",
  metadata_not_object: "The dataset.metadata property is not an object, its type is '%type%'.",
  metadata_missing_columns: "The dataset.metadata.columns property is missing.",
  metadata_columns_not_array: "The dataset.metadata.columns property is not an array, its type is '%type%'.",
  metadata_columns_not_array_of_objects: [
    "The dataset.metadata.columns property is not an array of column descriptor objects,",
    " it is an array whose elements are of type '%type%'."
  ].join(""),
  metadata_columns_name_missing: "The 'name' property is missing from a column descriptor entry in dataset.metadata.columns.",
  metadata_columns_name_not_string: "The 'name' property of a column descriptor entry in dataset.metadata.columns is not a string.",
  metadata_columns_type_missing: "The 'type' property is missing from the '%column%' column descriptor entry in dataset.metadata.columns.",
  metadata_columns_type_not_valid: "The 'type' property for the '%column%' column descriptor is not a valid value.",
  column_in_data_not_metadata: "The column '%column%' is present in the data, but there is no entry for it in dataset.metadata.columns.",
  column_in_metadata_not_data: "The column '%column%' is present in dataset.metadata.columns, but this column is missing from the row objects in dataset.data.",
  column_type_mismatch: "The column '%column%' is present in the data, but its type does not match that declared in dataset.metadata.columns. The type of the data value '%value%' for column '%column' is '%typeInData%', but is declared to be of type '%typeInMetadata%' in dataset.metadata.columns.",
  column_metadata_missing: "There is no metadata present for the column '%column%'"
};

var validTypes = {
  string: true,
  number: true,
  date: true
};

function error(id, params){
  return Error(errorMessage(id, params));
}

function errorMessage(id, params){
  return template(strings[id], params);
}

// Simple templating from http://stackoverflow.com/questions/377961/efficient-javascript-string-replacement
function template(str, params){
  return str.replace(/%(\w*)%/g, function(m, key){
    return params[key];
  });
}

function validate(dataset){
  return new Promise(function (resolve, reject){

    //////////////////
    // dataset.data //
    //////////////////

    // Validate that the `data` property exists.
    if(!dataset.data){
      return reject(error("data_missing"));
    }

    // Validate that the `data` property is an array.
    if(dataset.data.constructor !== Array){
      return reject(error("data_not_array", {
        type: typeof dataset.data
      }));
    }

    // Validate that the `data` property is an array of objects.
    var nonObjectType;
    var allRowsAreObjects = dataset.data.every(function (d){
      var type = typeof d;
      if(type === "object"){
        return true;
      } else {
        nonObjectType = type;
        return false;
      }
    });
    if(!allRowsAreObjects){
      return reject(error("data_not_array_of_objects", {
        type: nonObjectType
      }));
    }


    //////////////////////
    // dataset.metadata //
    //////////////////////

    // Validate that the `metadata` property exists.
    if(!dataset.metadata){
      return reject(error("metadata_missing"));
    }

    // Validate that the `metadata` property is an object.
    if(typeof dataset.metadata !== "object"){
      return reject(error("metadata_not_object", {
        type: typeof dataset.metadata
      }));
    }

    // Validate that the `metadata.columns` property exists.
    if(!dataset.metadata.columns){
      return reject(error("metadata_missing_columns"));
    }

    // Validate that the `metadata.columns` property is an array.
    if(dataset.metadata.columns.constructor !== Array){
      return reject(error("metadata_columns_not_array", {
        type: typeof dataset.metadata.columns
      }));
    }

    // Validate that the `metadata.columns` property is an array of objects.
    var nonObjectType;
    var allColumnsAreObjects = dataset.metadata.columns.every(function (d){
      var type = typeof d;
      if(type === "object"){
        return true;
      } else {
        nonObjectType = type;
        return false;
      }
    });
    if(!allColumnsAreObjects){
      return reject(error("metadata_columns_not_array_of_objects", {
        type: nonObjectType
      }));
    }

    // Validate that the each column descriptor has a "name" field.
    if(!dataset.metadata.columns.every(function (column){
      return column.name;
    })){
      return reject(error("metadata_columns_name_missing"));
    }

    // Validate that the each column descriptor has a "name" field that is a string.
    if(!dataset.metadata.columns.every(function (column){
      return (typeof column.name) === "string";
    })){
      return reject(error("metadata_columns_name_not_string"));
    }

    // Validate that the each column descriptor has a "type" field.
    var columnNameMissingType;
    if(!dataset.metadata.columns.every(function (column){
      if(!column.type){
        columnNameMissingType = column.name;
      }
      return column.type;
    })){
      return reject(error("metadata_columns_type_missing", {
        column: columnNameMissingType
      }));
    }


    // Validate that the each column descriptor has a "type" field that is a valid value.
    var columnNameInvalidType;
    if(!dataset.metadata.columns.every(function (column){
      if(validTypes[column.type]){
        return true;
      } else {
        columnNameInvalidType = column.name;
        return false;
      }
    })){
      return reject(error("metadata_columns_type_not_valid", {
        column: columnNameInvalidType
      }));
    }
    

    //////////////////////
    // dataset.data     //
    //       AND        //
    // dataset.metadata //
    //////////////////////
    
    // Index the columns in the metadata.
    var columnsInMetadata = {};
    dataset.metadata.columns.forEach(function (column){
      //columnsInMetadata[column.name] = true;
      columnsInMetadata[column.name] = column.type;
    });

    //// Index the columns in the data (based on the first row only).
    var columnsInData = {};
    Object.keys(dataset.data[0]).forEach(function (columnName){
      columnsInData[columnName] = true;
    });


    // Validate that all columns present in the data are also present in metadata.
    var columnInDataNotInMetadata;

    // In the same pass over the data, validate that types match.
    var typeMismatchParams;

    var allIsWell = dataset.data.every(function (row){
      return Object.keys(row).every(function (columnInData){
        var typeInMetadata = columnsInMetadata[columnInData];

        // Check that the column is present in metadata.
        if(typeInMetadata){

          // Check that the actual type matches the declared type.
          var value = row[columnInData];
          var typeInData = typeof value;

          // Detect Date types.
          if(typeInData === "object" && value.constructor === Date){
            typeInData = "date";
          }

          if(typeInData !== typeInMetadata){
            typeMismatchParams = {
              column: columnInData,
              value: value,
              typeInData: typeInData,
              typeInMetadata: typeInMetadata
            };
            return false;
          }

          return true;
        } else {
          columnInDataNotInMetadata = columnInData
          return false;
        }
      });
    });
    if(!allIsWell){
      if(columnInDataNotInMetadata){
        return reject(error("column_in_data_not_metadata", {
          column: columnInDataNotInMetadata
        }));
      } else {

        // If we got here, then there was a type mismatch.
        return reject(error("column_type_mismatch", typeMismatchParams));
      }
    }


    // Validate that all columns present in the metadata are also present in the data.
    var columnInMetadataNotInData;
    var allColumnsInMetadataAreInData = dataset.metadata.columns.every(function (column){
      var columnInMetadata = column.name;
      if(columnsInData[columnInMetadata]){
        return true;
      } else {
        columnInMetadataNotInData = columnInMetadata
        return false;
      }
    });
    if(!allColumnsInMetadataAreInData){
      return reject(error("column_in_metadata_not_data", {
        column: columnInMetadataNotInData
      }));
    }

    // If we got here, then all the validation tests passed.
    resolve();
  });
}

function getColumnMetadata(dataset, columnName){

  var matchingColumns = dataset.metadata.columns.filter(function (column){
    return column.name === columnName;
  })

  if(matchingColumns.length === 0){
    throw error("column_metadata_missing", { column: columnName });
  } else {
    return matchingColumns[0];
  }
}

module.exports = {
  errorMessage: errorMessage,
  validate: validate,
  getColumnMetadata: getColumnMetadata
};

},{}],3:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-time', ['exports'], factory) :
  factory((global.d3_time = {}));
}(this, function (exports) { 'use strict';

  var t0 = new Date;
  var t1 = new Date;
  function newInterval(floori, offseti, count, field) {

    function interval(date) {
      return floori(date = new Date(+date)), date;
    }

    interval.floor = interval;

    interval.round = function(date) {
      var d0 = new Date(+date),
          d1 = new Date(date - 1);
      floori(d0), floori(d1), offseti(d1, 1);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), date;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [];
      start = new Date(start - 1);
      stop = new Date(+stop);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      offseti(start, 1), floori(start);
      if (start < stop) range.push(new Date(+start));
      while (offseti(start, step), floori(start), start < stop) range.push(new Date(+start));
      return range;
    };

    interval.filter = function(test) {
      return newInterval(function(date) {
        while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        while (--step >= 0) while (offseti(date, 1), !test(date));
      });
    };

    if (count) {
      interval.count = function(start, end) {
        t0.setTime(+start), t1.setTime(+end);
        floori(t0), floori(t1);
        return Math.floor(count(t0, t1));
      };

      interval.every = function(step) {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null
            : !(step > 1) ? interval
            : interval.filter(field
                ? function(d) { return field(d) % step === 0; }
                : function(d) { return interval.count(0, d) % step === 0; });
      };
    }

    return interval;
  };

  var millisecond = newInterval(function() {
    // noop
  }, function(date, step) {
    date.setTime(+date + step);
  }, function(start, end) {
    return end - start;
  });

  // An optimized implementation for this simple case.
  millisecond.every = function(k) {
    k = Math.floor(k);
    if (!isFinite(k) || !(k > 0)) return null;
    if (!(k > 1)) return millisecond;
    return newInterval(function(date) {
      date.setTime(Math.floor(date / k) * k);
    }, function(date, step) {
      date.setTime(+date + step * k);
    }, function(start, end) {
      return (end - start) / k;
    });
  };

  var second = newInterval(function(date) {
    date.setMilliseconds(0);
  }, function(date, step) {
    date.setTime(+date + step * 1e3);
  }, function(start, end) {
    return (end - start) / 1e3;
  }, function(date) {
    return date.getSeconds();
  });

  var minute = newInterval(function(date) {
    date.setSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 6e4);
  }, function(start, end) {
    return (end - start) / 6e4;
  }, function(date) {
    return date.getMinutes();
  });

  var hour = newInterval(function(date) {
    date.setMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 36e5);
  }, function(start, end) {
    return (end - start) / 36e5;
  }, function(date) {
    return date.getHours();
  });

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 864e5;
  }, function(date) {
    return date.getDate() - 1;
  });

  function weekday(i) {
    return newInterval(function(date) {
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 6048e5;
    });
  }

  var sunday = weekday(0);
  var monday = weekday(1);
  var tuesday = weekday(2);
  var wednesday = weekday(3);
  var thursday = weekday(4);
  var friday = weekday(5);
  var saturday = weekday(6);

  var month = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
  }, function(date, step) {
    date.setMonth(date.getMonth() + step);
  }, function(start, end) {
    return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
  }, function(date) {
    return date.getMonth();
  });

  var year = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
    date.setMonth(0, 1);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  }, function(date) {
    return date.getFullYear();
  });

  var utcSecond = newInterval(function(date) {
    date.setUTCMilliseconds(0);
  }, function(date, step) {
    date.setTime(+date + step * 1e3);
  }, function(start, end) {
    return (end - start) / 1e3;
  }, function(date) {
    return date.getUTCSeconds();
  });

  var utcMinute = newInterval(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 6e4);
  }, function(start, end) {
    return (end - start) / 6e4;
  }, function(date) {
    return date.getUTCMinutes();
  });

  var utcHour = newInterval(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 36e5);
  }, function(start, end) {
    return (end - start) / 36e5;
  }, function(date) {
    return date.getUTCHours();
  });

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / 864e5;
  }, function(date) {
    return date.getUTCDate() - 1;
  });

  function utcWeekday(i) {
    return newInterval(function(date) {
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / 6048e5;
    });
  }

  var utcSunday = utcWeekday(0);
  var utcMonday = utcWeekday(1);
  var utcTuesday = utcWeekday(2);
  var utcWednesday = utcWeekday(3);
  var utcThursday = utcWeekday(4);
  var utcFriday = utcWeekday(5);
  var utcSaturday = utcWeekday(6);

  var utcMonth = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(1);
  }, function(date, step) {
    date.setUTCMonth(date.getUTCMonth() + step);
  }, function(start, end) {
    return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  }, function(date) {
    return date.getUTCMonth();
  });

  var utcYear = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCMonth(0, 1);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  }, function(date) {
    return date.getUTCFullYear();
  });

  var milliseconds = millisecond.range;
  var seconds = second.range;
  var minutes = minute.range;
  var hours = hour.range;
  var days = day.range;
  var sundays = sunday.range;
  var mondays = monday.range;
  var tuesdays = tuesday.range;
  var wednesdays = wednesday.range;
  var thursdays = thursday.range;
  var fridays = friday.range;
  var saturdays = saturday.range;
  var weeks = sunday.range;
  var months = month.range;
  var years = year.range;

  var utcMillisecond = millisecond;
  var utcMilliseconds = milliseconds;
  var utcSeconds = utcSecond.range;
  var utcMinutes = utcMinute.range;
  var utcHours = utcHour.range;
  var utcDays = utcDay.range;
  var utcSundays = utcSunday.range;
  var utcMondays = utcMonday.range;
  var utcTuesdays = utcTuesday.range;
  var utcWednesdays = utcWednesday.range;
  var utcThursdays = utcThursday.range;
  var utcFridays = utcFriday.range;
  var utcSaturdays = utcSaturday.range;
  var utcWeeks = utcSunday.range;
  var utcMonths = utcMonth.range;
  var utcYears = utcYear.range;

  var version = "0.1.0";

  exports.version = version;
  exports.milliseconds = milliseconds;
  exports.seconds = seconds;
  exports.minutes = minutes;
  exports.hours = hours;
  exports.days = days;
  exports.sundays = sundays;
  exports.mondays = mondays;
  exports.tuesdays = tuesdays;
  exports.wednesdays = wednesdays;
  exports.thursdays = thursdays;
  exports.fridays = fridays;
  exports.saturdays = saturdays;
  exports.weeks = weeks;
  exports.months = months;
  exports.years = years;
  exports.utcMillisecond = utcMillisecond;
  exports.utcMilliseconds = utcMilliseconds;
  exports.utcSeconds = utcSeconds;
  exports.utcMinutes = utcMinutes;
  exports.utcHours = utcHours;
  exports.utcDays = utcDays;
  exports.utcSundays = utcSundays;
  exports.utcMondays = utcMondays;
  exports.utcTuesdays = utcTuesdays;
  exports.utcWednesdays = utcWednesdays;
  exports.utcThursdays = utcThursdays;
  exports.utcFridays = utcFridays;
  exports.utcSaturdays = utcSaturdays;
  exports.utcWeeks = utcWeeks;
  exports.utcMonths = utcMonths;
  exports.utcYears = utcYears;
  exports.millisecond = millisecond;
  exports.second = second;
  exports.minute = minute;
  exports.hour = hour;
  exports.day = day;
  exports.sunday = sunday;
  exports.monday = monday;
  exports.tuesday = tuesday;
  exports.wednesday = wednesday;
  exports.thursday = thursday;
  exports.friday = friday;
  exports.saturday = saturday;
  exports.week = sunday;
  exports.month = month;
  exports.year = year;
  exports.utcSecond = utcSecond;
  exports.utcMinute = utcMinute;
  exports.utcHour = utcHour;
  exports.utcDay = utcDay;
  exports.utcSunday = utcSunday;
  exports.utcMonday = utcMonday;
  exports.utcTuesday = utcTuesday;
  exports.utcWednesday = utcWednesday;
  exports.utcThursday = utcThursday;
  exports.utcFriday = utcFriday;
  exports.utcSaturday = utcSaturday;
  exports.utcWeek = utcSunday;
  exports.utcMonth = utcMonth;
  exports.utcYear = utcYear;
  exports.interval = newInterval;

}));
},{}]},{},[1])(1)
});