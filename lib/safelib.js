(function() {
  /*
   *
   * Extended functions
   * (see https://lemonldap-ng.org/documentation/latest/extendedfunctions)
   *
   */
  var ExtdFunc, Iconv;

  Iconv = null;

  ExtdFunc = (function() {
    var cipher, date, encrypt, unicode2iso;

    class ExtdFunc {
      constructor(c) {
        var e;
        cipher = c;
        try {
          Iconv = require('iconv').Iconv;
        } catch (error) {
          e = error;
          console.log("iconv module not available");
        }
      }

      hostname(req) {
        return req.headers.host;
      }

      remote_ip(req) {
        if (req.ip != null) {
          return req.ip;
        } else {
          return req.cgiParams.REMOTE_ADDR;
        }
      }

      basic(login, pwd) {
        return "Basic " + unicode2iso(`${login}:${pwd}`).toString('base64');
      }

      groupMatch(groups, attr, value) {
        var group, i, len, match, re, ref, s, v;
        match = 0;
        re = new RegExp(value);
        for (group in groups) {
          v = groups[group];
          if (v[attr] != null) {
            if (typeof v[attr] === 'object') {
              ref = v[attr];
              for (i = 0, len = ref.length; i < len; i++) {
                s = ref[i];
                if (s.match(re)) {
                  match++;
                }
              }
            } else {
              if (v[attr].match(re)) {
                match++;
              }
            }
          }
        }
        return match;
      }

      isInNet6(ip, net) {
        var bits, test;
        test = require('ipaddr.js');
        ip = test.parse(ip);
        net = net.replace(/^(.*)\/(.*)/, "$1");
        bits = RegExp.$2;
        net = test.parse(net);
        return ip.match(net, bits);
      }

      checkLogonHours(logonHours, syntax = 'hexadecimal', timeCorrection, defaultAccess = 0) {
        var d, div, hourPos, pos, v1, v2;
        timeCorrection = parseInt(timeCorrection);
        d = new Date();
        hourPos = d.getDay() * 24 + d.getHours() + timeCorrection;
        div = syntax === 'octetstring' ? 3 : 4;
        pos = Math.trunc(hourPos / div);
        v1 = Math.pow(2, hourPos % div);
        v2 = logonHours.substr(pos, 1);
        if (v2.match(/\d/)) {
          v2 = parseInt(v2); // Cast as int
        } else {
          v2 = v2.charCodeAt(0);
          v2 = v2 > 70 ? v2 - 87 : v2 - 55;
        }
        return v1 & v2;
      }

      checkDate(start = 0, end, defaultAccess = 0) {
        var d;
        start = start + '';
        start = start.substring(0, 14);
        end = end + '';
        end = end.substring(0, 14);
        if (!(start || end)) {
          return defaultAccess;
        }
        end || (end = 999999999999999);
        d = date();
        if (d >= start && d <= end) {
          return true;
        } else {
          return false;
        }
      }

      unicode2iso(s) {
        return unicode2iso(s);
      }

      iso2unicode(s) {
        var iconv;
        iconv = new Iconv('ISO-8859-1', 'UTF-8');
        return iconv.convert(s);
      }

      encrypt(s) {
        return encrypt(s);
      }

      token() {
        var args, time;
        time = Math.trunc(Date.now() / 1000); // Perl time
        args = Array.from(arguments);
        return encrypt(`${time}:${args.join(':')}`);
      }

      encode_base64(s) {
        var r;
        return r = new Buffer(s).toString('base64');
      }

    };

    cipher = null;

    ExtdFunc.prototype.date = date;

    unicode2iso = function(s) {
      var iconv;
      iconv = new Iconv('UTF-8', 'ISO-8859-1');
      return iconv.convert(s);
    };

    date = function() {
      var a, d, i, len, s, x;
      d = new Date();
      s = '';
      a = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
      for (i = 0, len = a.length; i < len; i++) {
        x = a[i];
        s += x < 10 ? `0${x}` : `${x}`;
      }
      return s;
    };

    encrypt = function(s) {
      return cipher.encrypt(s);
    };

    return ExtdFunc;

  }).call(this);

  module.exports = ExtdFunc;

}).call(this);
