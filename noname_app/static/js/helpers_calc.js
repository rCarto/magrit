"use strict";

/**
* Function computing the min of an array of values (tking care of empty/null/undefined slot)
*  - no fancy functionnalities here (it doesn't add anything comparing to Math.min.apply()
*    or d3.min() except a little speed-up)
*
* @param {Array} arr
* @return {Number} min
*/
function min_fast(arr){
  let min = arr[0];
  for(let i = 1, len_i = arr.length; i < len_i; ++i){
    let val = +arr[i];
    if(val && val < min)
       min = val;
  }
  return min;
}

/**
* Return the maximum value of an array of numbers
*
* @param {Array} arr - the array of numbers
* @return {Number} max
*/
function max_fast(arr){
  let max = arr[0];
  for(let i = 1, len_i = arr.length; i < len_i; ++i){
    let val = +arr[i];
    if(val > max)
       max = arr[i];
  }
  return max;
}

/**
* Test an array of numbers for negative values
*
* @param {Array} arr - the array of numbers
* @return {Bool} result - True or False, whether it contains negatives values or not
*/
function has_negative(arr){
  for(let i = 0; i < arr.length; ++i)
    if(+arr[i] < 0)
       return true;
  return false;
}

/**
* @param {Array} arr - The array to test
* @return {Boolean} result - True or False, according to whether it contains empty values or not
*/
var contains_empty_val = function(arr){
    for(let i = arr.length - 1; i > -1; --i)
        if(arr[i] == null) return true;
        else if(isNaN(+arr[i])) return true;
    return false;
}

/**
* Round a given value with the given precision
*
* @param {Number} val - The value to be rounded.
* @param {Number} precision - The wanted precision.
* @return {Number} value - The rounded value.
*/
var round_value = function(val, nb){
    if(nb == undefined)
        return val;
    let dec_mult = +["1", Array(Math.abs(nb)).fill("0").join('')].join('');
    return nb >= 0
        ? Math.round(+val * dec_mult) / dec_mult
        : Math.round(+val / dec_mult) * dec_mult;
}

function get_nb_decimals(nb){
    let tmp = nb.toString().split('.');
    return tmp.length < 2 ? 0 : tmp[1].length;
}

function get_nb_left_separator(nb){
    let tmp = nb.toString().split('.');
    return tmp[0].length;
}

/**
* Get the decimal separator in user's locale.
* and compute the number of item in each bin.
*
* @return {String} separator - The decimal separator (dot or comma)
*/
function getDecimalSeparator(){
    return 1.1.toLocaleString().substr(1,1)
}

var PropSizer = function(fixed_value, fixed_size, type_symbol){
  this.fixed_value = fixed_value;
  var sqrt = Math.sqrt,
      abs = Math.abs,
      pi = Math.PI;
  if(type_symbol === "circle"){
    this.smax = fixed_size * fixed_size * pi;
    this.scale = val => sqrt(abs(val) * this.smax / this.fixed_value) / pi;
  } else {
    this.smax = fixed_size * fixed_size
    this.scale = val => sqrt(abs(val) * this.smax / this.fixed_value);
  }
}

function prop_sizer3_e(arr, fixed_value, fixed_size, type_symbol){
    let pi = Math.PI,
        abs = Math.abs,
        sqrt = Math.sqrt,
        arr_len = arr.length,
        res = [];

    if(!fixed_value || fixed_value == 0)
        fixed_value = max_fast(arr);

    if(type_symbol == "circle"){
        let smax = fixed_size * fixed_size * pi;
        for(let i=0; i < arr_len; ++i)
            res.push(sqrt(abs(arr[i]) * smax / fixed_value) / pi);

    } else {
        let smax = fixed_size * fixed_size;
        for(let i=0; i < arr_len; ++i)
            res.push(sqrt(abs(arr[i]) * smax / fixed_value));
    }
    return res;
}

function getOptNbClass(len_serie){
    return Math.floor(1 + 3.3 * Math.log10(len_serie));
}

/**
* Compute breaks according to "Q6" methods
* and compute the number of item in each bin.
*
* @param {Array} serie - An array of ordered values.
* @return {Object} summary - Object containing the breaks and the stock in each class.
*/
function getBreaksQ6(serie){
    var breaks = [], tmp = 0, j = undefined,
        len_serie = serie.length, stock_class = [],
        q6_class = [1, 0.05 * len_serie, 0.275 * len_serie, 0.5 * len_serie, 0.725 * len_serie, 0.95 * len_serie, len_serie];
    for(let i=0; i < 7; ++i){
        j = Math.round(q6_class[i]) - 1
        breaks.push(+serie[j]);
        stock_class.push(j - tmp)
        tmp = j;
    }
    stock_class.shift();
    if(breaks[0] == breaks[1]){
        breaks[1] = (breaks[2] - breaks[1]) / 2
    }
    if(breaks[6] == breaks[5]){
        breaks[5] = (breaks[5] - breaks[4]) / 2
    }
    return {
        breaks: breaks,
        stock_class: stock_class
        };
}

function getBinsCount(_values, bins=16){
    _values = _values.filter(a => a).sort((a,b) => a-b);
    let nb_ft = _values.length,
        mean = undefined,
        stddev = undefined,
        min = _values[0],
        max = _values[nb_ft - 1],
        extend = max - min,
        bin_size = extend / bins,
        counts = new Array(bins),
        break_values = [min],
        sum = 0,
        ix_med = (nb_ft + 1) / 2;

    for(let i = 0; i < bins; i++){
        break_values.push(break_values[i] + bin_size);
    }
    for(let i = 1, j = 0; i<nb_ft; i++){
        let class_max = break_values[i-1];
        counts[i-1] = 0;
        while(_values[j] <= class_max){
            sum += _values[j];
            counts[i-1] += 1;
            j++;
        }
    }
    mean = sum / nb_ft;
    stddev = getStdDev(_values, mean);

    return {
        breaks: break_values,
        counts: counts,
        min: min,
        max: max,
        mean: mean,
        median: (ix_med | 0) == ix_med ? _values[ix_med] : (_values[Math.floor(ix_med)] + _values[Math.ceil(ix_med)]) / 2,
        stddev: stddev
        };
}

function getBreaks_userDefined(serie, breaks_list){
    var separator = has_negative(serie) ? '- ' : '-',
        break_values = breaks_list.split(separator).map(el => +el.trim()),
        len_serie = serie.length,
        j = 0,
        len_break_val = break_values.length,
        stock_class = new Array(len_break_val-1);

    for(let i=1; i<len_break_val; ++i){
        let class_max = break_values[i];
        stock_class[i-1] = 0;
        while(serie[j] <= class_max){
            stock_class[i-1] += 1;
            j++;
        }
    }
    return {
        breaks: break_values,
        stock_class: stock_class
        };
}

/**
* Return the haversine distance in kilometers between two points (lat/long coordinates)
*
* @param {Array} A - Coordinates of the 1st point as [latitude, longitude]
* @param {Array} B - Coordinates of the 2nd point as [latitude, longitude]
* @return {Number} distance - The distance in km between A and B
*/
function haversine_dist(A, B){
    let pi_dr = Math.PI / 180;

    let lat1 = +A[0], lon1 = +A[1],
        lat2 = +B[0], lon2 = +B[1];

    let x1 = lat2 - lat1,
        dLat = x1 * pi_dr,
        x2 = lon2 - lon1,
        dLon = x2 * pi_dr;

    let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * pi_dr) * Math.cos(lat2 * pi_dr) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
* Return the distance in kilometers between two points (lat/long coordinates)
* according to the spherical law of cosines
*
* @param {Array} A - Coordinates of the 1st point as [latitude, longitude]
* @param {Array} B - Coordinates of the 2nd point as [latitude, longitude]
* @return {Number} distance - The distance in km between A and B
*/
function coslaw_dist(A, B){
    let pi_dr = Math.PI / 180;

    let lat1 = +A[0], lon1 = +A[1],
        lat2 = +B[0], lon2 = +B[1];
    let phi1 = lat1 * pi_dr,
        phi2 = lat2 * pi_dr,
        d_lambda = (lon2-lon1) * pi_dr;
    return Math.acos(Math.sin(phi1) * Math.sin(phi2) +
                Math.cos(phi1) * Math.cos(phi2) * Math.cos(d_lambda)
                ) * 6371;
}

/**
* Return the eclidian distance between pt1 and pt2, in the unit provided
*
* @param {Array} pt1 - Coordinates of the 1st point as [x, y].
* @param {Array} pt2 - Coordinates of the 2nd point as [x, y].
* @return {Number} distance - The distance between pt1 and pt2.
*/
function get_distance(pt1, pt2){
    let xs = pt2[0] - pt1[1],
        ys = pt2[1] - pt1[1];
    return Math.sqrt((xs*xs)+(ys*ys));
}

function getStdDev(values, mean_val){
  let nb_val = values.length,
      pow = Math.pow,
      s = 0;
  for(let i=0; i < nb_val; i++){
      s += pow(values[i] - mean_val, 2);
  }
  return Math.sqrt((1/nb_val) * s)
}
