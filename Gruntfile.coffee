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
		packages.forEach (pack) ->
			j = grunt.file.readJSON "./src/packages/#{pack}/package.json"
			for k,v of main
				j[k] = v unless j[k]? or k.match /dependencies/i
			j.name = pack
			grunt.file.write "packages/#{pack}/package.json", JSON.stringify j, null, 2
		grunt.log.ok "#{packages.length} package.json files written"
	grunt.registerTask 'default', ['clean', 'coffee', 'conf']
