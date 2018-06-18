###
#
# LemonLDAP::NG uWSGI logger (usable only under uwsgi V8 plugin)
#
###

class UwsgiLog
	constructor: (conf, type) ->
		i = 1
		for l in ['error','warn','notice','info','debug']
			if i
				@[l] = (txt) ->
					uwsgi.log "[#{l}]", txt
			else
				@[l] = (txt) ->
			i = 0 if conf.logLevel == l

module.exports = UwsgiLog
