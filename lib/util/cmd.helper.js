"use strict";

const program = require("commander");
const colors = require("colors");
const maxCpus = require("os").cpus().length;
const config = require('../../bin/config/config.default');
const serviceConfig = config().service;

/**
 * @description 命令行解析工具类
 * @classdesc 命令行解析工具类，用于解析启动时输入的命令字符串
 * @author xmysql
 */
program.on("--help", () => {
    console.log("");
    console.log("  Examples:".blue);
    console.log("");
    console.log("    $ xmysql -u username -p password -d databaseSchema".blue);
    console.log("");
});

program
    .version(module.exports.version)
    .option("-h, --host <n>", "hostname of database / localhost by default")
    .option("-u, --user <n>", "username of database / root by default")
    .option("-p, --password <n>", "password of database / empty by default")
    .option("-d, --database <n>", "database schema name")
    .option("-r, --ipAddress <n>", "IP interface of your server / localhost by default")
    .option("-n, --portNumber <n>", "port number for app / 3000 by default")
    .option("-o, --port <n>", "port number for mysql / 3306 by default")
    .option("-S, --socketPath <n>", "unix socket path / not used by default")
    .option("-s, --storageFolder <n>", "storage folder / current working dir by default / available only with local")
    .option("-i, --ignoreTables <n>", "comma separated table names to ignore")
    .option("-a, --apiPrefix <n>", 'api url prefix / "/api/" by default')
    .option("-y, --readOnly", "readonly apis / false by default")
    .option("-c, --useCpuCores <n>", "use number of CPU cores (using cluster) / 1 by default")
    .parse(process.argv);

function paintHelp(txt) {
    return colors.magenta(txt); //display the help text in a color
}

function processInvalidArguments(program) {
    let err = "";

    if (!program.password) {
        err += "Error: password for database is missing\n";
    }

    if (!program.database) {
        err += "Error: database name is missing\n";
    }

    if (err !== "") {
        program.outputHelp(paintHelp);
        console.log(err.red);
    }
}

exports.handle = program => {

    /**************** START : default values ****************/

    program.ipAddress = program.ipAddress || serviceConfig.ipAddress || "localhost";
    program.portNumber = program.portNumber || serviceConfig.portNumber || 3000;
    program.port = program.port || serviceConfig.port || 3306;
    program.user = program.user || serviceConfig.user || "root";
    program.password = program.password || serviceConfig.password || "";
    program.host = program.host || serviceConfig.host || "localhost";
    program.socketPath = program.socketPath || serviceConfig.socketPath || "";
    program.storageFolder = program.storageFolder || serviceConfig.storageFolder || process.cwd();
    program.apiPrefix = program.apiPrefix || serviceConfig.apiPrefix || "/api/";
    program.readOnly = program.readOnly || serviceConfig.readOnly || false;
    program.useCpuCores = program.useCpuCores || serviceConfig.useCpuCores || 1;

    if (program.useCpuCores === "0") {
        program.useCpuCores = maxCpus;
    }

    if (program.ignoreTables) {
        let ignoreTables = program.ignoreTables.split(",");
        program.ignoreTables = {};
        for (var i = 0; i < ignoreTables.length; ++i) {
            program.ignoreTables[ignoreTables[i]] = ignoreTables[i];
        }
    } else {
        program.ignoreTables = {};
    }

    program.connectionLimit = 10;

    if (program.host === "localhost" || program.host === "127.0.0.1" || program.host === "::1") {
        program.dynamic = 1;
    }

    console.log(`String server by program config :`, JSON.stringify(program));

    /**************** END : default values ****************/

    if (program.database && program.host && program.user) {
        console.log('Starting server at:', 'http://' + program.host + ':' + program.portNumber)
    } else {
        processInvalidArguments(program);
        process.exit(1);
    }

};