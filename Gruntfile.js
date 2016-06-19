module.exports = function(grunt) {
  grunt.initConfig({

    coffee: {
      glob_to_multiple: {
        expand: true,
        flatten: true,
        cwd: 'src/',
        src: ['*.coffee', '*/*.coffee', '*/*/*.coffee'],
        dest: 'lib/',
        ext: '.js'
      }
    }

  });
  grunt.loadNpmTasks('grunt-contrib-coffee');

  grunt.registerTask('default', ['coffee']);
};