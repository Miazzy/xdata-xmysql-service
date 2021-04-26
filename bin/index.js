#! /usr/bin/env node

const morgan = require("morgan");
const dblite = require('dblite');
const bodyParser = require("body-parser");
const express = require("express");
const protect = require('@risingstack/protect');
const sqlConfig = require("commander");
const mysql = require("mysql");
const cors = require("cors");
const dataHelp = require("../lib/util/data.js");
const Xapi = require("../lib/xapi.js");
const cmdargs = require("../lib/util/cmd.js");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const requestIp = require('request-ip');
const nacos = require('nacos');
const os = require('os');
const config = require('./config/config');
const port = 3000;

const sqlitePath = `${process.cwd()}/` + config().service.dblitepath;
const sqliteDB = dblite(sqlitePath);
const memoryDB = dblite(':memory:');

console.log(`dblitepath:`, sqlitePath);

/**
 * 获取本地服务内网IP地址，注册服务时需使用
 * @returns 
 */
function getIpAddress() {
    try {
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
    } catch (error) {
        console.log(error);
    }
}

/**
 * 初始化sqliteDB
 */
function initSqliteDB() {
    const cacheddl = config().memorycache.cacheddl;
    console.log(`cache ddl #init# :`, cacheddl);
    const keys = Object.keys(cacheddl);
    for (tableName of keys) {
        sqliteDB.query(cacheddl[tableName]);
        memoryDB.query(cacheddl[tableName]);
    }

    (async() => { //拉取数据库数据

    })();
}

/**
 * Nacos配置注册服务中间件（注册微服务）
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
const middlewareNacos = async(req, res, next) => {
    try {
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
    } catch (error) {
        console.log(error);
    }
}

/**
 * Express服务启动函数
 * @param {*} sqlConfig 
 */
function startXmysql(sqlConfig) {

    const protectConfig = config().protect;

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

    // 新增防止SQL注入检测
    if (protectConfig.sqlInjection) {
        app.use(protect.express.sqlInjection({
            body: true,
            loggerFunction: console.error
        }));
    }
    // 新增防止XSS跨站攻击
    if (protectConfig.xss) {
        app.use(protect.express.xss({
            body: true,
            loggerFunction: console.error
        }));
    }

    /** pretect限流功能 ， client是redis client
     const redis = require('redis')
     const client = redis.createClient();
     app.use(protect.express.rateLimiter({
         db: client,
         id: (request) => request.connection.remoteAddress
     }));
     app.get('/', (request, response) => {
         response.send('hello protect!')
     });
     app.post('/login', protect.express.rateLimiter({
         db: client,
         id: (request) => request.body.email,
         // max 10 tries per 2 minutes
         max: 10,
         duration: 120000
     }), (request, response) => {
         response.send('wuut logged in')
     });
     */
    /**************** END : setup express ****************/

    /**************** START : setup mysql ****************/
    let mysqlPool = mysql.createPool(sqlConfig);
    /**************** END : setup mysql ****************/

    /**************** START : setup Xapi ****************/
    let t = process.hrtime();
    let moreApis = new Xapi(sqlConfig, mysqlPool, app, sqliteDB, memoryDB);

    moreApis.init((err, results) => {
        app.listen(sqlConfig.portNumber, sqlConfig.ipAddress);
        console.log("          API's base URL    :   localhost:" + sqlConfig.portNumber);
    });
    /**************** END : setup Xapi ****************/

    //启动本地sqlite，创建表，执行同步语句
    initSqliteDB(); //启动Sqlite本地缓存

}

/**
 * 获取命令行参数，并根据参数启动服务(Cluster模式)函数
 * @param {*} sqlConfig 
 */
function start(sqlConfig) {
    try {

        //handle cmd line arguments
        cmdargs.handle(sqlConfig);

        if (cluster.isMaster && sqlConfig.useCpuCores > 1) {

            console.log(`Master ${process.pid} is running`);

            for (let i = 0; i < numCPUs && i < sqlConfig.useCpuCores; i++) {
                console.log(`Forking process number ${i}...`);
                cluster.fork();
            }

            cluster.on("exit", function(worker, code, signal) {
                console.log(`Worker ${worker.process.pid} died with code: ${code} , and signal: ${signal} `);
                console.log("Starting a new worker");
                cluster.fork();
            });

        } else {
            startXmysql(sqlConfig);
        }

    } catch (error) {
        console.log(error);
    }
}

// 启动HTTP服务
start(sqlConfig);