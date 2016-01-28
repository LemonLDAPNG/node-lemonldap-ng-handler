class llngConf
	constructor: (args) ->
		this[k] = args[k] for k of args
	
	@getLocalConf = (section,file,loadDefault=true) ->
		file = file ? (process.env.LLNG_DEFAULTCONFFILE ? '/etc/lemonldap-ng/lemoldap-ng.ini')
		iniparser = require('inireader').IniReader()
		localConf = iniparser.load file
		res = {}
		if loadDefaut
			for k of localConf.param 'all'
				res[k] = localConf.param 'all.' + k
		return res if section == 'all'

		for k of localConf.param section
			res[k] = localConf.param section + '.' + k
		res
