
var config = require("./config");

module.exports = function (grunt) {

    grunt.initConfig({

        projectDir: grunt.option("projectDir"),
        scriptsDir: config.scriptsDir,
        layoutDir: config.layoutDir,
        layoutEntry: config.layoutEntry,

        browserify: {
            // bundles layout JS
            default: {
                src: ["<%= layoutDir %>/<%= layoutEntry %>"],
                dest: "<%= layoutDir %>/bundle/dev.js"
            },
        },

        uglify: {
            // uglifys dev.js -> prod.js
            default: {
                src: ["<%= layoutDir %>/bundle/dev.js"],
                dest: "<%= layoutDir %>/bundle/prod.js"
            }
        },

        shell: {
            options: {
                stdout: true,
                failOnError: true,
            },
            // cd to project dir, install JS dependencies, run project's prod task
            prod: {
                command: "cd <%= projectDir %> && npm install && grunt prod",
            },
            // copy bundled layout JS to project
            copy_dev: {
                command: "xcopy /f /y \"<%= layoutDir %>/bundle/dev.js\" \"<%= projectDir %>/<%= scriptsDir %>/Shared/Layout/bundle/*\""
            },
            // copy production layout JS to project
            copy_prod: {
                command: "xcopy /f /y \"<%= layoutDir %>/bundle/prod.js\" \"<%= projectDir %>/<%= scriptsDir %>/Shared/Layout/bundle/*\""
            }
        },
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-shell");

    // bundle layout JS
    // copy bundled JS to each project
    grunt.registerTask("bundle", function () {
        grunt.task.run("browserify:default");
        config.projects.forEach(function (projectDir) {
            grunt.task.run("copy_dev:" + projectDir);
        });
    });

    // copy bundled layout JS to specified project
    grunt.registerTask("copy_dev", function (dir) {
        grunt.config.set("projectDir", dir);
        grunt.task.run("shell:copy_dev");
    });

    // iterate through all projects, run project-specific task
    grunt.registerTask("prod", function (arg) {
        grunt.task.run("browserify:default", "uglify:default");
        config.projects.forEach(function (projectDir) {
            grunt.task.run("prod-project:" + projectDir);
        });
    });

    // run shell task for specified project
    // copy production layout JS to project
    grunt.registerTask("prod-project", function (dir) {
        grunt.config.set("projectDir", dir);
        grunt.task.run("shell:prod", "shell:copy_prod");
    });
};

/*
Grunt queues all tasks before executing. The config variables (folder, subfolder)
are passed in as arguments to the prod-folder task in order to maintain the scope of that queued task.

see: http://gruntjs.com/api/grunt.task#grunt.task.run
*/
