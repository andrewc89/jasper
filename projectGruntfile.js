
var fs = require("fs");
var path = require("path");
var pathmodify = require("pathmodify");
var config = require("./config");

module.exports = function (grunt) {

    function browserifyConfigure(b) {
        // alias dir for global modules location outside project scope
        b.plugin(pathmodify(), { mods: [pathmodify.mod.dir("assets", path.resolve(__dirname, config.globalModulesDir))] });
    }

    grunt.initConfig({

        // config level instances
        scriptsDir: config.scriptsDir,
        folder: grunt.option("folder") || grunt.option("fl"),
        subfolder: grunt.option("subfolder") || grunt.option("sf"),

        browserify: {
            options: {
                configure: browserifyConfigure
            },
            // bundles all JS files in dir, ignoring those in bundle dir
            default: {
                src: ["<%= scriptsDir %>/<%= folder %>/<%= subfolder %>/app.js"],
                dest: "<%= scriptsDir %>/<%= folder %>/<%= subfolder %>/bundle/dev.js"
            },
        },

        uglify: {
            // uglifys dev.js -> prod.js
            default: {
                src: ["<%= scriptsDir %>/<%= folder %>/<%= subfolder %>/bundle/dev.js"],
                dest: "<%= scriptsDir %>/<%= folder %>/<%= subfolder %>/bundle/prod.js"
            }
        },

        shell: {
            options: {
                stdout: true,
                failOnError: true,
            },
            // run jsx via node because Windows is stupid
            // compile all JSX files in folder/subfolder dir
            // output to compiled-jsx/
            jsx: {
                command: "node node_modules/react-tools/bin/jsx -x jsx --no-cache-dir <%= scriptsDir %>/<%= folder %>/<%= subfolder %>/ <%= scriptsDir %>/<%= folder %>/<%= subfolder %>/compiled-jsx",
            }
        },

        watch: {
            options: {
                livereload: true,
                // disabled to maintain config values set in grunt.event.on
                spawn: false
            },
            // perform page reload if any views or CSS are updated
            // or if project is re-built
            default: {
                files: ["Views/**/*.cshtml", "Content/**/*.css", "bin/**/*.dll"],
            },
            // compile JSX then bundle if any JSX file is updated
            jsx: {
                files: ["<%= scriptsDir %>/**/**/**/*.jsx"],
                tasks: ["shell:jsx", "browserify:default"]
            },
            // bundle JS if any JS files are updated, excluding compiled-jsx and bundle dirs
            js: {
                files: ["<%= scriptsDir %>/**/**/**/*.js", "!<%= scriptsDir %>/**/**/compiled-jsx/**/*.js", "!<%= scriptsDir %>/**/**/bundle/*.js"],
                tasks: ["browserify:default"]
            }
        },

        replace: {
            // replace all references to dev.js files with prod.js
            // for production only
            prod: {
                src: ["Views/**/*.cshtml"],
                overwrite: true,
                replacements: [{
                    from: "bundle/dev.js",
                    to: "bundle/prod.js"
                }]
            }
        },
    });

    // when JS file changes, set folder and subfolder config values from filepath of changed file
    grunt.event.on("watch", function (action, filepath, target) {
        if (target === "js" || target === "jsx") {
            var split = filepath.split('\\');
            grunt.config.set("folder", split[1]);
            grunt.config.set("subfolder", split[2]);
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-shell");
    grunt.loadNpmTasks("grunt-text-replace");
    grunt.loadNpmTasks("grunt-contrib-uglify");

    // are a folder and subfolder specified?
    function dirSpecified() {
        return (grunt.option("folder") || grunt.option("fl")) && (grunt.option("subfolder") || grunt.option("sf"));
    }

    // throw Error if folder and subfolder are not specified
    function requireArgs() {
        if (!dirSpecified()) {
            throw Error("You need to provide a folder and subfolder.");
        }
    }

    function enableWatchSpawn() {
        grunt.config.set("watch.options.spawn", true);
    }

    // gets all the folders in a given directory
    function getFolders(dir) {
        return fs.readdirSync(dir)
            .filter(function (file) {
                return fs.statSync(path.join(dir, file)).isDirectory();
            });
    }

    // checks a given directory recursively for any jsx files
    function containsJSXFiles(dir) {
        return fs.readdirSync(dir).some(function (file) {
            if (fs.statSync(path.join(dir, file)).isDirectory()) {
                return containsJSXFiles(path.join(dir, file));
            }
            else {
                return file.slice(-4) === ".jsx";
            }
        });
    }

    // bundles all JS found in given folder/subfolder dir
    // ex: grunt bundle --fl=Class --sf=Admin
    grunt.registerTask("bundle", function (arg) {
        requireArgs();
        if (containsJSXFiles(config.scriptsDir + "/" + grunt.config("folder") + "/" + grunt.config("subfolder"))) {
            grunt.task.run("shell:jsx");
        }
        grunt.task.run("browserify:default");
    });

    // for local development
    // starts watch task for livereload
    // ex: grunt dev
    grunt.registerTask("dev", function (arg) {
        if (dirSpecified()) {
            enableWatchSpawn();
            grunt.task.run("bundle", "watch");
        }
        else {
            grunt.task.run("watch");
        }
    });

    // builds all JS for production
    // foreach folder/subfolder dir in Javascript:
    //     checks for JSX files
    //     passes args to separate task to queue the task for each specific dir (see footnote)
    // replaces all references to "dev.js" with "prod.js"
    grunt.registerTask("prod", function (arg) {
        getFolders(config.scriptsDir).forEach(function (folder) {
            getFolders(config.scriptsDir + "/" + folder).forEach(function (subfolder) {
                var dir = config.scriptsDir + "/" + folder + "/" + subfolder;
                var jsx = containsJSXFiles(dir);
                grunt.task.run("prod-folder:" + folder + ":" + subfolder + ":" + jsx);
            });
        });
        grunt.task.run("replace");
    });

    // creates task to build production JS for each folder/subfolder dir in Javascript
    // sets folder and subfolder values in config
    // adds appropriate tasks to array then queues task to run
    grunt.registerTask("prod-folder", function (fl, sf, jsx) {
        grunt.config.set("folder", fl);
        grunt.config.set("subfolder", sf);
        var tasks = [];
        if (jsx === "true") {
            tasks.push("shell:jsx");
        }
        tasks.push("browserify:default", "uglify:default");
        grunt.task.run(tasks);
    });
};

/*
Grunt queues all tasks before executing. The config variables (folder, subfolder)
are passed in as arguments to the prod-folder task in order to maintain the scope of that queued task.

see: http://gruntjs.com/api/grunt.task#grunt.task.run
*/
