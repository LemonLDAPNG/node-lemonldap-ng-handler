###
#
# LemonLDAP::NG syslog logger (log to console)
#
###
syslog = require 'modern-syslog'
o = syslog.option
f = syslog.facility

class Syslog
	constructor: (conf, type) ->
		if type
			fac = conf.userSyslogFacility or 'auth'
		else
			fac = conf.syslogFacility or 'daemon'
		fac = f["LOG_#{fac.toUpperCase()}"]
		syslog.open 'LLNG', o.LOG_CONS + o.LOG_PID + o.LOG_NDELAY, fac
		i = 1
		for l in ['error','warn','notice','info','debug']
			if i
				p = if l == 'warn' then 'warning' else if l == 'error' then 'err' else l
				p = syslog.level["LOG_#{p.toUpperCase()}"] + fac
				@[l] = (txt) ->
					syslog.log p, txt
			else
				@[l] = (txt) ->
			i = 0 if conf.logLevel == l

module.exports = Syslog
