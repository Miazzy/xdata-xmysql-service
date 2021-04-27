#! /usr/bin/env node

const morgan = require("morgan");
const dblite = require('dblite');
const bodyParser = require("body-parser");
const express = require("express");
const { RpcServer } = require('sofa-rpc-node').server;
const { RpcClient } = require('sofa-rpc-node').client;
const { ZookeeperRegistry } = require('sofa-rpc-node').registry;
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
const sqlitePath = `${process.cwd()}/` + config().service.dblitepath;
const sqliteDB = dblite(sqlitePath);
const memoryDB = dblite(':memory:');
const port = config().service.portNumber || 3000;
const logger = console;

console.log(`dblitepath:`, sqlitePath, ` server start port:`, port);

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
const initSqliteDB = async() => {
    const cacheddl = config().memorycache.cacheddl;
    console.log(`cache ddl #init# :`, cacheddl);
    const keys = Object.keys(cacheddl);

    for (tableName of keys) {
        sqliteDB.query(cacheddl[tableName]);
        memoryDB.query(cacheddl[tableName]);
    }

    (async() => { //拉取数据库数据

        for (tableName of keys) { // 根据配置参数选择，增量查询或者全量查询

            /***************** 方案一 增量 *****************/

            //查询本地sqlite数据，获取当前最大值 id , xid

            //查询主数据库数据库大于当前最大值的数据 id 新增 //将多的数据同步新增过来

            //查询主数据库数据等于当前最大值得数据 xid 更新 //将多的数据同步更新过来

            //对小于等于当前最大值的数据，进行检查并更新操作，异步

            /***************** 方案二 全量 *****************/

            //查询主数据库所有数据，全部插入本地数据库中
        }

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

        //通过Nacos注册xdata-xmysql-service的RestAPI微服务
        await client.ready();
        await client.registerInstance(serviceName, { ip: ipAddress, port: serviceConfig.portNumber || port, });

        //通过Zookeeper注册xdata.xmysql.service的rpc微服务
        const rpcregistry = new ZookeeperRegistry({ logger, address: nacosConfig.sofaZookeeperAddress, }); // 1. 创建 zk 注册中心客户端
        const rpcserver = new RpcServer({ logger, registry: rpcregistry, port: nacosConfig.sofaRpcPort, }); // 2. 创建 RPC Server 实例
        const rpcclient = new RpcClient({ logger, });

        return { client, rpcserver, rpcclient, config: nacosConfig, nacosConfig, zookeeperRegistry: rpcregistry, serviceConfig, nacosConfig, ipAddress, serviceName, sofaInterfaceName: nacosConfig.sofaInterfaceName };
    } catch (error) {
        console.log(error);
    }
}

/**
 * Express服务启动函数
 * @param {*} sqlConfig 
 */
const startXmysql = async(sqlConfig) => {

    const protectConfig = config().protect;

    //注册Nacos并发布服务，服务名称：xdata-xmysql-service
    const nacosMiddleware = await middlewareNacos();

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
    /**************** END : setup express ****************/

    /**************** START : setup mysql ****************/
    const mysqlPool = mysql.createPool(sqlConfig);
    /**************** END : setup mysql ****************/

    /**************** START : setup Xapi ****************/
    let moreApis = new Xapi(sqlConfig, mysqlPool, app, sqliteDB, memoryDB);

    moreApis.init((err, results) => {
        app.listen(sqlConfig.portNumber, sqlConfig.ipAddress);
        console.log("          API's base URL    :   localhost:" + sqlConfig.portNumber);
    });
    /**************** END : setup Xapi ****************/

    //启动本地sqlite，创建表，执行同步语句
    initSqliteDB(); //启动Sqlite本地缓存

    //获取 RPC Server
    const rpcserver = nacosMiddleware.rpcserver;

    console.log(`RPC SERVER:`, rpcserver);

    //RPC Server 添加服务
    rpcserver.addService({ interfaceName: nacosMiddleware.sofaInterfaceName }, {
        async parallelExec(tableName = '', query = '', params = [], type = 'nacos', callback = () => {}) {
            moreApis.mysql.parallelExec(tableName, query, params, type, callback);
        },
        async nacosShareExec(tableName = '', query = '', params = [], type = 'nacos', callback = () => {}) {
            moreApis.mysql.nacosShareExec(tableName, query, params, type, callback);
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

        console.log(nacosConfig.serviceName, ` targets: `, hosts);

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
    rpcConsumeMap.set('local.ipaddress', getIpAddress());
    moreApis.mysql.setRpcConsumeMap(rpcConsumeMap);
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