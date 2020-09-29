fs= require('fs')
packages = fs.readdirSync('src/packages')
np = "#{__dirname}/packages"
process.env.NODE_PATH = if process.env.NODE_PATH? then ":#{np}" else np
console.error('path',process.env.NODE_PATH)
require("module").Module._initPaths()

module.exports = (grunt) ->
	grunt.initConfig
		coffee:
			packages:
				expand: true
				flatten: false
				cwd: 'src/packages'
				src: ['**/*.coffee']
				dest: 'packages/'
				ext: '.js'
		copy:
			package:
				files: [
					expand: true
					cwd: 'src/packages',
					src: ['*/package.json', '*/*.md']
					dest: 'packages/'
				]
			test:
				files: [
					expand: true
					cwd: 'src/packages',
					src: ['*/test/**/*.json', '*/test/*.ini', '**/.exists' ]
					dest: 'packages/'
				]
		mochaTest:
			test:
				options:
					reporter: "spec"
				src: ['test/**/*.js','packages/*/test/*.js']
		clean:
			packages: 'packages'
			lib: 'lib'
	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-mocha-test'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.loadNpmTasks 'grunt-contrib-copy'
	grunt.registerTask 'default', ['clean', 'coffee', 'copy']
	grunt.registerTask 'test', 'mochaTest'
