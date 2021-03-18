#! /usr/bin/env node

const morgan = require("morgan");
const bodyParser = require("body-parser");
const express = require("express");
const sqlConfig = require("commander");
const mysql = require("mysql");
const cors = require("cors");
const dataHelp = require("../lib/util/data.helper.js");
const Xapi = require("../lib/xapi.js");
const cmdargs = require("../lib/util/cmd.helper.js");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const requestIp = require('request-ip');
const nacos = require('nacos');
const os = require('os');
const config = require('./config/config.default');
const port = 3000;

function getIpAddress() {
    var ifaces = os.networkInterfaces()
    for (var dev in ifaces) {
        let iface = ifaces[dev]
        for (let i = 0; i < iface.length; i++) {
            let { family, address, internal } = iface[i]
            if (family === 'IPv4' && address !== '127.0.0.1' && !internal) {
                return address
            }
        }
    }
}

const middlewareNacos = async(req, res, next) => {
    const nacosConfig = config().nacos;
    const serviceConfig = config().service;
    const ipAddress = getIpAddress();
    const client = new nacos.NacosNamingClient(nacosConfig);
    const serviceName = serviceConfig.debug ? nacosConfig.debugServiceName : (serviceConfig.readOnly ? nacosConfig.readOnlyServiceName : nacosConfig.serviceName);
    await client.ready();
    await client.registerInstance(serviceName, {
        ip: ipAddress,
        port: port || 3000,
    });
}

function startXmysql(sqlConfig) {

    //注册Nacos并发布服务，服务名称：xdata-xmysql-service
    middlewareNacos();

    /**************** START : setup express ****************/
    let app = express();
    app.use(morgan("tiny"));
    app.use(cors());
    app.use(bodyParser.json());
    app.use(
        bodyParser.urlencoded({
            extended: true
        })
    );
    /**************** END : setup express ****************/

    /**************** START : setup mysql ****************/
    let mysqlPool = mysql.createPool(sqlConfig);
    /**************** END : setup mysql ****************/

    /**************** START : setup Xapi ****************/
    console.log("Generating REST APIs at the speed of your thought...");

    let t = process.hrtime();
    let moreApis = new Xapi(sqlConfig, mysqlPool, app);

    moreApis.init((err, results) => {
        app.listen(sqlConfig.portNumber, sqlConfig.ipAddress);
        var t1 = process.hrtime(t);
        var t2 = t1[0] + t1[1] / 1000000000;
        console.log("       API's base URL    :   localhost:" + sqlConfig.portNumber);
        console.log("                                                            ");
        console.log(" - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ");
    });
    /**************** END : setup Xapi ****************/
}

function start(sqlConfig) {
    //handle cmd line arguments
    cmdargs.handle(sqlConfig);

    if (cluster.isMaster && sqlConfig.useCpuCores > 1) {
        console.log(`Master ${process.pid} is running`);

        for (let i = 0; i < numCPUs && i < sqlConfig.useCpuCores; i++) {
            console.log(`Forking process number ${i}...`);
            cluster.fork();
        }

        cluster.on("exit", function(worker, code, signal) {
            console.log(
                "Worker " +
                worker.process.pid +
                " died with code: " +
                code +
                ", and signal: " +
                signal
            );
            console.log("Starting a new worker");
            cluster.fork();
        });
    } else {
        startXmysql(sqlConfig);
    }
}

start(sqlConfig);