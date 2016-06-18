module.exports = function (grunt) {

    var email = grunt.option('email') || '';
    var password = grunt.option('password') || '';
    var branch = grunt.option('branch') || 'default';

    if (!email.trim() || !password.trim()) {
        grunt.fatal('E-mail and/or password missing');
    }

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: email,
                password: password,
                branch: branch,
                ptr: false
            },
            dist: {
                src: ['src/*.js', 'src/roles/*.js']
            }
        }
    });
};