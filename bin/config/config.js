/* eslint valid-jsdoc: "off" */
/* eslint-disable indent */
/* eslint-disable eol-last */
'use strict';

/**
 * @param {AppInfo} appInfo app info
 */
module.exports = () => {

    /**
     * built-in config
     * @type {Egg.EggAppConfig}
     **/
    const config = exports = {};

    config.nacos = {
        registStatus: true,
        logger: console,
        serverList: ['172.18.1.50:8848', '172.18.1.50:8849', '172.18.1.50:8850'], // replace to real nacos serverList
        namespace: 'public',
        groupName: 'DEFAULT_GROUP',
        serviceName: 'xdata-xmysql-service', //正常模式
        debugServiceName: 'xdata-dmysql-service', //Debug模式
        readOnlyServiceName: 'xdata-rmysql-service', //只读模式
        sofaRpcPort: 3020, //sofa-rpc-node 微服务暴露端口
        sofaInterfaceName: 'xdata.xmysql.service', //sofa-rpc-node 微服务接口名称
        sofaZookeeperAddress: '172.18.254.95:32181', //sofa-rpc-node 微服务注册地址
        sofaRegistryName: 'zookeeper', //none表示不启用Zookeeper的注册中心 
    };

    config.redis = {
        host: '172.18.254.95', // 127.0.0.1:6379 172.18.254.95:36379
        port: 36379,
        family: 4, // 4 (IPv4) or 6 (IPv6)
        password: "",
        db: 0,
    };

    config.redisclustr = {
        servers: [{
            host: '172.18.254.95', //127.0.0.1:6379 172.18.254.95:37000
            port: 37000,
        }],
        slotInterval: 1000, // default: none. Interval to repeatedly re-fetch cluster slot configuration
        maxQueueLength: 100, // default: no limit. Maximum length of the getSlots queue (basically number of commands that can be queued whilst connecting to the cluster)
        queueShift: false, // default: true. Whether to shift the getSlots callback queue when it's at max length (error oldest callback), or to error on the new callback
        wait: 5000, // default: no timeout. Max time to wait to connect to cluster before sending an error to all getSlots callbacks
        slaves: 'share', // default: 'never'. How to direct readOnly commands: 'never' to use masters only, 'share' to distribute between masters and slaves or 'always' to  only use slaves (if available)
        createClient: function(port, host, options = {}) {
            options.password = '1234567890';
            options.db = 0;
            return require('redis').createClient(port, host, options);
        },
        redisOptions: {}
    };

    config.protect = {
        sqlInjection: false,
        xss: true,
    };

    config.service = {
        host: '172.18.254.95', // 172.18.254.95 222.212.88.72 hostname of database / localhost by default "-h, --host <n>"
        port: '39090', // port number for mysql / 3306 by default "-o, --port <n>"
        user: 'zhaoziyun', // username of database / root by default "-u, --user <n>"
        password: 'ziyequma', // password of database / empty by default "-p, --password <n>"
        database: 'xdata', // database schema name "-d, --database <n>"
        ipAddress: '0.0.0.0', // IP interface of your server / localhost by default "-r, --ipAddress <n>"
        portNumber: '3000', // port number for app / 3000 by default "-n, --portNumber <n>"
        ignoreTables: '', // comma separated table names to ignore "-i, --ignoreTables <n>"
        socketPath: '', // unix socket path / not used by default "-S, --socketPath <n>"
        storageFolder: '', // storage folder / current working dir by default / available only with local "-s, --storageFolder <n>"
        apiPrefix: '', // api url prefix / "/api/" by default "-a, --apiPrefix <n>"
        debug: false, // 是否开启调试模式
        readOnly: false, // readonly apis / false by default "-y, --readOnly"
        useCpuCores: '0', // use number of CPU cores (using cluster) / 1 by default "-c, --useCpuCores <n>"
        commonCacheTime: 1,
        dblitepath: './database/db.sqlite.db',
        sqlitepath: './database/db.sqlite3.db',
    };

    config.slaves = {
        host: '172.18.254.95', // hostname of database / localhost by default "-h, --host <n>"
        port: '39090', // port number for mysql / 3306 by default "-o, --port <n>"
        user: 'zhaoziyun', // username of database / root by default "-u, --user <n>"
        password: 'ziyequma', // password of database / empty by default "-p, --password <n>"
        database: 'xdata_slave', // database schema name "-d, --database <n>"
    };

    config.memorycache = {
        version: 'v2.2.2',
        cacheddl: {
            'bs_seal_regist': ``,
            'bs_goods_receive': ``,
            'bs_goods_borrow': ``,
            'bs_admin_group':``,
            'bs_admin_address':``,
            'bs_company_flow_base':``,
            'bs_company_flow_data':``,
            'bs_legal':``,
        },
    };

    return {
        ...config,
    };
};