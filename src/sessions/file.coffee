class FileSession
	q: require 'Q'
	fs: require 'fs'
	datas: {}
	filename: ''

	constructor: (id, opts) ->
		opts.Directory = '/tmp' unless opts.Directory
		d = @q.defer()
		if id
			try
				@fs.readFile "#{opts.Directory}/#{id}", (data) ->
					@datas = JSON.parse data
					d.resolve()
			catch error
				d.reject()
		else
			id = @generate()
			try @fs.writeFile "#{opts.Directory}/#{id}", ->
				d.resolve()
			catch error
				d.reject()
		return d


