###
#
# LemonLDAP::NG syslog logger (log to console)
#
###

Severity =
	error:  3
	warn:   4
	notice: 5
	info:   6
	debug:  7

Facility =
        kernel: 0,
        user:   1,
        system: 3,
        daemon: 3,
        auth:   4,
        syslog: 5,
        lpr:    6,
        news:   7,
        uucp:   8,
        cron:   9,
        authpriv: 10,
        ftp:    11,
        audit:  13,
        alert:  14,
        local0: 16,
        local1: 17,
        local2: 18,
        local3: 19,
        local4: 20,
        local5: 21,
        local6: 22,
        local7: 23

class Syslog
	constructor: (conf, type) ->
		syslog = require 'syslog-client'
		cli = syslog.createClient "localhost"
		if type
			fac = Facility[conf.userSyslogFacility] or Facility.auth
		else
			fac = Facility[conf.syslogFacility] or Facility.daemon
		for l in ['error','warn','notice','info','debug']
			opt =
				facility: fac
				severity: Severity[l]
			if i
				@[l] = (txt) ->
					cli.log txt, opt
			else
				@[l] = (txt) ->
			i = 0 if conf.logLevel == l

module.exports = Syslog
