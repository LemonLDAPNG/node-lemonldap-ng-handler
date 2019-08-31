fs= require('fs')
packages = fs.readdirSync('src/packages')
np = "#{__dirname}/packages"
process.env.NODE_PATH = if process.env.NODE_PATH? then ":#{np}" else np
require("module").Module._initPaths();

module.exports = (grunt) ->
	grunt.initConfig
		coffee:
			main:
				expand: true
				flatten: false
				cwd: 'src/lib'
				src: ['**/*.coffee']
				dest: 'lib/'
				ext: '.js'
			packages:
				expand: true
				flatten: false
				cwd: 'src/packages'
				src: ['**/*.coffee']
				dest: 'packages/'
				ext: '.js'
		mochaTest:
			test:
				options:
					reporter: "spec"
				src: ['test/**/*.js','src/packages/*/test/**/*.js']
		clean:
			packages: 'packages'
			lib: 'lib'
	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-mocha-test'
	grunt.loadNpmTasks 'grunt-contrib-clean'

	# Build package.json files
	main = grunt.file.readJSON "package.json"
	grunt.registerTask 'conf', 'Build other files', () ->
		depsError = 0
		for p,v of main.dependencies
			if p in packages and main.dependencies[p] != main.version
				main.dependencies[p] = main.version
				depsError++
		if depsError
			grunt.file.write 'package.json', JSON.stringify main, null, 2
		packages.forEach (pack) ->
			j = grunt.file.read "./src/packages/#{pack}/package.json"
			j = j.replace /\$version/g, main.version
			j = JSON.parse j
			for k,v of main
				j[k] = v unless j[k]? or k.match /dependencies/i
			j.name = pack
			grunt.file.write "packages/#{pack}/package.json", JSON.stringify j, null, 2
		grunt.log.ok "#{packages.length} package.json files written"
		packages.forEach (pack) ->
			readme = ''
			try
				fs.accessSync "src/packages/#{pack}/README.md"
				readme = grunt.file.read "src/packages/#{pack}/README.md"
			catch err
				readme = grunt.file.read "_README.tmpl"
			readme = readme.replace /\$package/g, pack
			grunt.file.write "packages/#{pack}/README.md", readme
		grunt.log.ok "#{packages.length} README.md files written"
	grunt.registerTask 'default', ['clean', 'coffee', 'conf']
	grunt.registerTask 'test', 'mochaTest'
