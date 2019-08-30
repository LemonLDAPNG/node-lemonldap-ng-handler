fs= require('fs')
packages = fs.readdirSync('src/packages')
#for pack in packages
#	j = require "./src/packages/#{pack}"

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
		clean:
			packages: 'packages'
			lib: 'lib'
	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.registerTask 'conf', 'Build package.json', () ->
		main = grunt.file.readJSON "package.json"
		depsError = 0
		for p,v of main.dependencies
			if p in packages and main.dependencies[p] != main.version
				main.dependencies[p] = main.version
				depsError++
		if depsError
			grunt.file.write 'package.json', JSON.stringify main, null, 2
		packages.forEach (pack) ->
			j = grunt.file.read "./src/packages/#{pack}/package.json"
			j = j.replace /\$version/, main.version
			j = JSON.parse j
			for k,v of main
				j[k] = v unless j[k]? or k.match /dependencies/i
			j.name = pack
			grunt.file.write "packages/#{pack}/package.json", JSON.stringify j, null, 2
		grunt.log.ok "#{packages.length} package.json files written"
	grunt.registerTask 'default', ['clean', 'coffee', 'conf']
