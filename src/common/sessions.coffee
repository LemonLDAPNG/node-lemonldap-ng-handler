###
#
###

newCache = (args={}) ->
	fileCache = require('file-cache-simple')
	# Cache timeout is set to 10 mn
	args.cacheExpire = 600000
	args.cacheDir or= '/tmp/llng'
	args.prefix = 'llng'
	localCache = new fileCache(args)

init = (args={}) ->
	
