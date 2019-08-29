module.exports = function(grunt) {
  grunt.initConfig({
    coffee: {
      other: {
        expand: true,
        flatten: false,
        cwd: 'src/',
        src: ['**/*.coffee'],
        dest: 'lib/',
        ext: '.js'
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-coffee');

  grunt.registerTask('default', ['coffee']);
};
