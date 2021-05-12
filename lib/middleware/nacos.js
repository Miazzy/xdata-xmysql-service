#! /usr/bin/env node


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
const Xapi = require("../../lib/xapi.js");
const config = require('../../bin/config/config');
const tools = require('../../lib/tools/tools').tools;
const cache = require('../../lib/cache/cache');
const lock = require('../../lib/lock/redisLock');
const port = config().service.portNumber || 3000;
const logger = console;

/**
 * Nacos配置注册服务中间件（注册微服务）
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
const register = async(req, res, next) => {
    let rpcregistry = null;
    try {
        const nacosConfig = config().nacos;
        const serviceConfig = config().service;
        const ipAddress = tools.getIpAddress();
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


const middlewareNacosExports = {
    register,
}

module.exports = middlewareNacosExports;