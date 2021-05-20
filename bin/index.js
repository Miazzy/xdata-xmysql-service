#! /usr/bin/env node

const morgan = require("morgan");
const dblite = require('dblite');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bodyParser = require("body-parser");
const express = require("express");
const sqlstring = require('sqlstring');
const { RpcServer } = require('sofa-rpc-node').server;
const { RpcClient } = require('sofa-rpc-node').client;
const { ZookeeperRegistry } = require('sofa-rpc-node').registry;
const protect = require('@risingstack/protect');
const sqlConfig = require("commander");
const mysql = require("mysql");
const cors = require("cors");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const requestIp = require('request-ip');
const nacos = require('nacos');
const schedule = require('node-schedule');
const os = require('os');
const fs = require('fs');
// const xprofiler = require('xprofiler');
const config = require('./config/config');
const Xapi = require("../lib/xapi.js");
const cmdargs = require("../lib/util/cmd.js");
const tools = require('../lib/tools/tools').tools;
const cache = require('../lib/cache/cache');
const lock = require('../lib/lock/redisLock');
const middlewareNacos = require('../lib/middleware/nacos');
const filesystem = require('../lib/filesystem/filesystem');
const sqlitetask = require('../lib/database/sqlite/sqlitetask');
const sqlitePath = `${process.cwd()}/` + config().service.dblitepath;
const sqliteFile = `${process.cwd()}/` + config().service.sqlitepath;
const sqliteDB = dblite(sqlitePath);
const memoryDB = dblite(':memory:');
const port = config().service.portNumber || 3000;
const databaseMap = new Map();
const logger = console;
// xprofiler.start();

/**
 * Express服务启动函数
 * @param {*} sqlConfig 
 */
const startXmysql = async(sqlConfig) => {

    const ipaddress = tools.getIpAddress(); //获取IP地址
    const protectConfig = config().protect; //获取安全配置信息
    const nacosConfig = config().nacos; //获取Nacos配置信息
    const memorycacheConfig = config().memorycache; //获取分布式数据库信息
    const version = config().memorycache.version;
    const schedule_task_time = config().memorycache.schedule_task_time;
    const schedule_hour_time = config().memorycache.schedule_hour_time;
    const schedule_task_flag = config().memorycache.schedule_task_flag;
    const nacosMiddleware = await middlewareNacos.register(); //注册Nacos并发布服务，服务名称：xdata-xmysql-service
    const rpcserver = nacosMiddleware.rpcserver; //获取 RPC Server
    const sqliteDBMap = await sqlitetask.openSQLiteDB(new Map()); //获取sqliteDB实例
    const init_wait_milisecond = memorycacheConfig.init_wait_milisecond;
    const sync_wait_milisecond = memorycacheConfig.sync_wait_milisecond;

    //设置express 
    const app = express();
    app.use(morgan("tiny"));
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // 新增防止SQL注入检测
    if (protectConfig.sqlInjection) {
        app.use(protect.express.sqlInjection({ body: true, loggerFunction: console.error }));
    }
    // 新增防止XSS跨站攻击
    if (protectConfig.xss) {
        app.use(protect.express.xss({ body: true, loggerFunction: console.error }));
    }

    //设置mysql连接池 
    const mysqlPool = mysql.createPool(sqlConfig);
    databaseMap.set('mysql_pool_info', mysqlPool);

    //设置服务器RestAPI Xapi 
    const moreApis = new Xapi(sqlConfig, mysqlPool, app, sqliteDB, memoryDB, sqliteDBMap);

    moreApis.init((err, results) => {
        // 启动express监听
        app.listen(sqlConfig.portNumber, sqlConfig.ipAddress);
        // 启动本地sqlite，创建表，执行同步语句
        lock.lockExec(`app:start_sqlite_db:${ipaddress}:${version}:lock`, async() => {
            await (async() => {
                try {
                    await tools.sleep(init_wait_milisecond || 100); //等待Nms
                    const metaDB = moreApis.getXSQL().getMetaDB(); // console.info(`app:start_sqlite_db:${ipaddress}:${version}:lock pool:`, mysqlPool, ` metaDB:`, metaDB, ` sqliteDBMap:`, sqliteDBMap);
                    await sqlitetask.initSqliteDB(mysqlPool, metaDB, sqliteDBMap); //启动Sqlite本地缓存 进行两次建表初始化操作，避免写入操作时出现表不存在的异常
                    await tools.sleep((sync_wait_milisecond || 3000)); //等待Nms
                    await sqlitetask.syncSqliteDB(mysqlPool, metaDB, sqliteDBMap); //同步主数据库数据到sqlite
                } catch (error) {
                    console.error(`app:start_sqlite_db:${ipaddress}:${version}:lock error`, error);
                }
            })();
            await tools.sleep((sync_wait_milisecond || 3000)); //等待Nms
        });
        const minTask = schedule.scheduleJob(schedule_task_time, function() {
            if (!schedule_task_flag) { //未启动定时同步
                console.log(`schedule task not start and flag is `, schedule_task_flag);
                return false;
            } // console.log(`start exec schedule task ... `);
            lock.lockExec(`app:start_sqlite_inc_schedule_db:${ipaddress}:${version}:lock`, async() => {
                if (schedule_task_flag) { //未启动定时同步
                    await (async() => {
                        try {
                            const mysqlPool = databaseMap.get('mysql_pool_info');
                            const metaDB = moreApis.getXSQL().getMetaDB();
                            const sqliteDBMap = moreApis.getXSQL().getSQLiteDBMap(); // console.info(`app:start_sqlite_db:${ipaddress}:${version}:lock pool:`, mysqlPool, ` metaDB:`, metaDB, ` sqliteDBMap:`, sqliteDBMap);
                            await sqlitetask.syncSqliteDB(mysqlPool, metaDB, sqliteDBMap, false); //同步主数据库数据到sqlite
                        } catch (error) {
                            console.error(`app:start_sqlite_inc_schedule_db:${ipaddress}:${version}:lock error`, error);
                        }
                    })();
                }
                console.log(`app:start_sqlite_inc_schedule_db:${ipaddress}:${version}:lock exec over ... `);
            });
        });
        const maxTask = schedule.scheduleJob(schedule_hour_time, function() {
            if (!schedule_task_flag) { //未启动定时同步
                console.log(`schedule task not start and flag is `, schedule_task_flag);
                return false;
            } // console.log(`start exec schedule task ... `);
            lock.lockExec(`app:start_sqlite_inc_schedule_db:${ipaddress}:${version}:lock`, async() => {
                if (schedule_task_flag) { //未启动定时同步
                    await (async() => {
                        try {
                            const mysqlPool = databaseMap.get('mysql_pool_info');
                            const metaDB = moreApis.getXSQL().getMetaDB();
                            const sqliteDBMap = moreApis.getXSQL().getSQLiteDBMap(); // console.info(`app:start_sqlite_db:${ipaddress}:${version}:lock pool:`, mysqlPool, ` metaDB:`, metaDB, ` sqliteDBMap:`, sqliteDBMap);
                            await sqlitetask.syncSqliteDB(mysqlPool, metaDB, sqliteDBMap, true); //同步主数据库数据到sqlite
                        } catch (error) {
                            console.error(`app:start_sqlite_inc_schedule_db:${ipaddress}:${version}:lock error`, error);
                        }
                    })();
                }
                console.log(`app:start_sqlite_inc_schedule_db:${ipaddress}:${version}:lock exec over ... `);
            });
        });
        // 打印启动完毕日志
        console.log("API's base URL: ", nacosMiddleware.ipAddress + ":" + sqlConfig.portNumber);
    });

    //根据Nacos注册信息，添加RPC服务
    if (nacosConfig.registStatus == true) {
        //RPC Server 添加服务
        rpcserver.addService({ interfaceName: nacosMiddleware.sofaInterfaceName }, {
            async parallelExec(tableName = '', query = '', params = [], type = 'local', callback = () => {}) {
                if (type != 'nacos') {
                    moreApis.mysql.parallelExec(tableName, query, params, type, callback);
                }
            },
            async nacosShareExec(tableName = '', query = '', params = [], type = 'local', callback = () => {}) {
                if (type != 'nacos') {
                    moreApis.mysql.nacosShareExec(tableName, query, params, type, callback);
                }
            },
        });

        //启动 RPC Server 并发布服务
        rpcserver.start().then(() => { rpcserver.publish() });

        const nacosClient = nacosMiddleware.client;
        const nacosConfig = nacosMiddleware.nacosConfig;
        const rpcClient = nacosMiddleware.rpcclient;
        const rpcConsumeMap = new Map();

        //获取Nacos注册列表
        nacosClient.subscribe(nacosConfig.serviceName, hosts => {
            // console.log(nacosConfig.serviceName, ` targets: `, hosts);
            for (const target of hosts) { // 选出健康的targets;
                if (!(target.valid && target.healthy && target.enabled)) {
                    continue;
                }
                const consumer = rpcClient.createConsumer({ interfaceName: nacosConfig.sofaInterfaceName, serverHost: target.ip + ':' + nacosConfig.sofaRpcPort, });
                consumer.ready();
                rpcConsumeMap.set(target.ip, consumer);
            }
            rpcConsumeMap.set(nacosConfig.serviceName, hosts);
        });

        rpcConsumeMap.set('nacos.config', nacosConfig);
        rpcConsumeMap.set('local.ipaddress', tools.getIpAddress());
        moreApis.mysql.setRpcConsumeMap(rpcConsumeMap);
    }
}

/**
 * 获取命令行参数，并根据参数启动服务(Cluster模式)函数
 * @param {*} sqlConfig 
 */
const start = async(sqlConfig) => {
    try {
        cmdargs.handle(sqlConfig); //handle cmd line arguments
        if (cluster.isMaster && sqlConfig.useCpuCores > 1) { // console.log(`Master ${process.pid} is running`);
            for (let i = 0; i < numCPUs && i < sqlConfig.useCpuCores; i++) { // console.log(`Forking process number ${i}...`);
                cluster.fork();
            }
            cluster.on("exit", function(worker, code, signal) { // console.log("Starting a new worker", `Cause, Worker ${worker.process.pid} died with code: ${code} , and signal: ${signal} `);
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