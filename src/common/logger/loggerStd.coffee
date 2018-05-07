class LoggerStd
	constructor: (conf) ->
		i = 1
		for l in ['error','warn','notice','info','debug']
			if i
				@[l] = (txt) ->
					console.log "[#{l}]", txt
			else
				@[l] = (txt) ->
			i = 0 if conf.logLevel == l

module.exports = LoggerStd
