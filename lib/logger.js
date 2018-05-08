(function() {
  module.exports = function(conf, type) {
    var cl, m;
    cl = (type ? conf.userLogger || conf.logger : conf.logger) || 'Std';
    cl = 'logger' + cl.replace(/^Lemonldap::NG::Common::Logger::/i, '');
    m = require(`./${cl}`);
    return new m(conf, type);
  };

}).call(this);
