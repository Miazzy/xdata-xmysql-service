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
const Xapi = require("../lib/xapi.js");
const cmdargs = require("../lib/util/cmd.js");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const requestIp = require('request-ip');
const nacos = require('nacos');
const os = require('os');
const config = require('./config/config');
const tools = require('../lib/tools/tools').tools;
const cache = require('../lib/cache/cache');
const sqlitePath = `${process.cwd()}/` + config().service.dblitepath;
const sqliteFile = `${process.cwd()}/` + config().service.sqlitepath;
const sqliteDB = dblite(sqlitePath);
const memoryDB = dblite(':memory:');
const port = config().service.portNumber || 3000;
const logger = console;
sqlite3.verbose();
console.log(`dblitepath:`, sqlitePath, ` server start port:`, port);

/**
 * 打开SQLiteDB
 */
const openSQLiteDB = async() => {
    const db = await open({
        filename: sqliteFile,
        driver: sqlite3.cached.Database
    });
    db.on('trace', (data) => {
        console.error(`sqlite trace error:`, data);
    });
    return db;
}

/**
 * 获取本地服务内网IP地址，注册服务时需使用
 */
const getIpAddress = () => {
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
    const version = config().memorycache.version;
    const keys = Object.keys(cacheddl);
    console.log(`cache ddl #init# >>>>>>>>>>>>>> `);

    (async() => {
        for await (tableName of keys) {
            const cacheKey = `init_sqlite_${tableName}_${version}`;
            const flag = await cache.getValue(cacheKey);
            const initSQL = cacheddl[tableName];
            if (flag != `true`) {

                sqliteDB.query(initSQL);
                memoryDB.query(initSQL);
                await sqlite3DB.exec(initSQL);

                cache.setValue(cacheKey, `true`, 3600 * 24 * 365 * 1000);
                console.log(`cache key: ${cacheKey} flag: ${flag} init sql:`, initSQL);
            } else {
                continue;
            }
        }
    })();
}

/**
 * 同步SqliteDB数据库
 * @param {*} pool
 */
const syncSqliteDB = async(pool = { query: () => {} }, metaDB = {}) => {

    //如果没有获取到MetaDB信息，则不能执行
    if (!(metaDB.tables && Object.keys(metaDB.tables).length > 0)) {
        return false;
    }
    console.log(`metaDB: `, ` metaDB.tables:`, JSON.stringify(metaDB.tables).slice(0, 100), ` metaDB.tables length: `, Object.keys(metaDB.tables).length);

    const cacheddl = config().memorycache.cacheddl;
    const version = config().memorycache.version;
    const keys = Object.keys(cacheddl);

    console.log(`cache ddl #sync# start >>>>>>>>>>>>>> : ......`, `cache ddl #sync# keys >>>>>>>>>>>>>> :`, keys);

    (async() => { //拉取数据库数据
        for await (tableName of keys) { // 根据配置参数选择，增量查询或者全量查询

            const cacheKey = `sync_sqlite_${tableName}_${version}`;
            const flag = await cache.getValue(cacheKey);
            console.log(`cache key: ${cacheKey} flag: ${flag} . `);
            if (flag == `true`) { /***************** 方案一 增量 *****************/
                //查询本地sqlite数据，获取当前最大值 id , xid

                //查询主数据库数据库大于当前最大值的数据 id 新增 //将多的数据同步新增过来

                //查询主数据库数据等于当前最大值得数据 xid 更新 //将多的数据同步更新过来

                //对小于等于当前最大值的数据，进行检查并更新操作，异步
            } else { /***************** 方案二 全量 *****************/
                cache.setValue(cacheKey, `true`, 3600 * 24 * 365 * 1000);
                const querySQL = `select * from ${tableName} order by id desc `;
                const qTableName = `${tableName}`;
                console.log(`exec #sync# tablename#${tableName}# >>>>>>>>>>>>>> :`, keys, ` select sql :`, querySQL);
                //查询主数据库所有数据，全部插入本地数据库中
                pool.query(querySQL, [], (error, rows, _fields) => {
                    try {
                        if (error) { //如果执行错误，则直接返回
                            return console.log("mysql sync to sqlite >>>>> ", error);
                        }
                        (async() => {
                            console.log(`database> querySQL: ${querySQL} tablename:`, qTableName, ' rows length:', rows.length);
                            const pageSize = 1; // 10条批量执行
                            let page = 1,
                                maxRow = 0,
                                maxPage = Math.ceil(rows.length / pageSize);
                            while (page <= maxPage) {
                                try {
                                    startPage = pageSize * (page - 1);
                                    maxRow = pageSize * (page - 0);
                                    const curRows = rows.slice(startPage, maxRow);
                                    const statement = tools.parseInsertStatement(qTableName, curRows, metaDB);
                                    execstr = sqlstring.format(statement.query, statement.params);

                                    //执行插入语句前，先查询数据库中是否存在此数据，若存在，则不执行

                                    sqliteDB.query('BEGIN TRANSACTION');
                                    memoryDB.query('BEGIN TRANSACTION');
                                    sqliteDB.query(execstr, [], (err, rows) => {
                                        if (err) {
                                            console.error(`exec error & sql:`, execstr, ` error:`, err, ` rows:`, curRows);
                                        }
                                    });
                                    memoryDB.query(execstr, [], (err, rows) => {
                                        if (err) {
                                            console.error(`exec error & sql:`, execstr, ` error:`, err, ` rows:`, curRows);
                                        }
                                    });
                                    sqliteDB.query('COMMIT');
                                    memoryDB.query('COMMIT');

                                    await sqlite3DB.exec(execstr);

                                    console.log(`cur rows:`, JSON.stringify(curRows).slice(0, 100), ` page :`, page);
                                    console.log(`statement execstr:`, execstr.slice(0, 100), ` exec success... page: `, page);

                                    ++page;
                                    await tools.sleep(2.5);
                                } catch (error) {
                                    console.log(`sqlite db exec error:`, error);
                                    continue;
                                }
                            }
                            console.log(`database> sync tablename:`, qTableName, ` over ... `);
                        })();
                    } catch (error) {
                        console.log(`sql error:`, error);
                    }
                    return true;
                });
            }
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
    let rpcregistry = null;
    try {
        const nacosConfig = config().nacos;
        const serviceConfig = config().service;
        const ipAddress = getIpAddress();
        const client = new nacos.NacosNamingClient(nacosConfig);
        const serviceName = serviceConfig.debug ? nacosConfig.debugServiceName : (serviceConfig.readOnly ? nacosConfig.readOnlyServiceName : nacosConfig.serviceName);
        if (!nacosConfig.registStatus) {
            return { client: null, rpcserver: null, rpcclient: null, config: nacosConfig, nacosConfig, zookeeperRegistry: null, serviceConfig, ipAddress, serviceName, sofaInterfaceName: nacosConfig.sofaInterfaceName };
        } else {
            //通过Nacos注册xdata-xmysql-service的RestAPI微服务
            await client.ready();
            await client.registerInstance(serviceName, { ip: ipAddress, port: serviceConfig.portNumber || port, });
            //通过Zookeeper注册xdata.xmysql.service的rpc微服务 sofaRegistryName为none，不使用zookeeper注册中心
            rpcregistry = nacosConfig.sofaRegistryName == 'none' ? null : new ZookeeperRegistry({ logger, address: nacosConfig.sofaZookeeperAddress, }); // 1. 创建 zk 注册中心客户端
            const rpcserver = new RpcServer({ logger, registry: rpcregistry, port: nacosConfig.sofaRpcPort, }); // 2. 创建 RPC Server 实例
            const rpcclient = new RpcClient({ logger, });
            return { client, rpcserver, rpcclient, config: nacosConfig, nacosConfig, zookeeperRegistry: rpcregistry, serviceConfig, ipAddress, serviceName, sofaInterfaceName: nacosConfig.sofaInterfaceName };
        }
    } catch (error) {
        console.log(error);
    }
}

/**
 * Express服务启动函数
 * @param {*} sqlConfig 
 */
const startXmysql = async(sqlConfig) => {

    //获取安全配置信息
    const protectConfig = config().protect;
    //获取Nacos配置信息
    const nacosConfig = config().nacos;

    //注册Nacos并发布服务，服务名称：xdata-xmysql-service
    const nacosMiddleware = await middlewareNacos();
    //获取 RPC Server
    const rpcserver = nacosMiddleware.rpcserver;
    //获取sqlite3DB实例
    sqlite3DB = await openSQLiteDB();

    //设置express 
    const app = express();
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

    //设置mysql连接池 
    const mysqlPool = mysql.createPool(sqlConfig);

    //设置服务器RestAPI Xapi 
    const moreApis = new Xapi(sqlConfig, mysqlPool, app, sqliteDB, memoryDB, sqlite3DB);

    moreApis.init((err, results) => {
        // 启动express监听
        app.listen(sqlConfig.portNumber, sqlConfig.ipAddress);
        // 启动本地sqlite，创建表，执行同步语句
        (async() => {
            await tools.sleep(1500); //等待Nms
            const metaDB = moreApis.getXSQL().getMetaDB();
            await initSqliteDB(); //启动Sqlite本地缓存
            await tools.sleep(1500); //等待Nms
            await syncSqliteDB(mysqlPool, metaDB); //同步主数据库数据到sqlite
        })();
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

}

/**
 * 获取命令行参数，并根据参数启动服务(Cluster模式)函数
 * @param {*} sqlConfig 
 */
const start = async(sqlConfig) => {
    try {
        cmdargs.handle(sqlConfig); //handle cmd line arguments
        if (cluster.isMaster && sqlConfig.useCpuCores > 1) {
            console.log(`Master ${process.pid} is running`);

            for (let i = 0; i < numCPUs && i < sqlConfig.useCpuCores; i++) {
                console.log(`Forking process number ${i}...`);
                cluster.fork();
            }

            cluster.on("exit", function(worker, code, signal) {
                console.log("Starting a new worker", `Cause, Worker ${worker.process.pid} died with code: ${code} , and signal: ${signal} `);
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