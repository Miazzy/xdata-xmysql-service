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
    const nacosIP = 'nacos.yunwisdom.club'; // nacos IP地址 const nacosIP = '172.18.1.51';
    const nacosList = [`${nacosIP}:30080`]; // const nacosList = [`${nacosIP}:8848`, `${nacosIP}:8849`, `${nacosIP}:8850`];

    const redisIP = 'r-bp16338c31627a24pd.redis.rds.aliyuncs.com';
    const redisPassword = 'Redis@password';
    const redisPort = 6379;

    const mysqlIP = '172.18.254.95';
    const mysqlPort = '39090';
    const mysqlAccount = 'zhaoziyun';
    const mysqlPassword = 'ziyequma';
    const mysqlDatabase = 'xdata';

    config.nacos = {
        registStatus: true,
        logger: console,
        serverList: nacosList, // replace to real nacos serverList
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
        host: redisIP, // 127.0.0.1:6379 172.18.254.95:36379
        port: redisPort,
        password: redisPassword,
        family: 4, // 4 (IPv4) or 6 (IPv6)
        db: 0,
    };

    config.redislock = {
        timeout: 1000,
        retries: 3,
        delay: 300,
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

    config.xprofiler = {
        log_dir: `${process.cwd()}/logs`, // 性能分析日志输出目录
        log_interval: 120, // 采样间隔 120s
        enable_log_uv_handles: false, // 不输出 uv 句柄分类详情
        log_format_alinode: true, // 以 alinode 的格式输出日志
        log_level: 1 // 只输出 info 日志
    };

    config.service = {
        type: 'mysql',
        host: mysqlIP, // 172.18.254.95 222.212.88.72 hostname of database / localhost by default "-h, --host <n>"
        port: mysqlPort, // port number for mysql / 3306 by default "-o, --port <n>"
        user: mysqlAccount, // username of database / root by default "-u, --user <n>"
        password: mysqlPassword, // password of database / empty by default "-p, --password <n>"
        database: mysqlDatabase, // database schema name "-d, --database <n>"
        ipAddress: '0.0.0.0', // IP interface of your server / localhost by default "-r, --ipAddress <n>"
        portNumber: '3000', // port number for app / 3000 by default "-n, --portNumber <n>"
        ignoreTables: '', // comma separated table names to ignore "-i, --ignoreTables <n>"
        socketPath: '', // unix socket path / not used by default "-S, --socketPath <n>"
        storageFolder: '', // storage folder / current working dir by default / available only with local "-s, --storageFolder <n>"
        apiPrefix: '', // api url prefix / "/api/" by default "-a, --apiPrefix <n>"
        debug: false, // 是否开启调试模式
        readOnly: false, // readonly apis / false by default "-y, --readOnly"
        useCpuCores: '2', // use number of CPU cores (using cluster) / 1 by default "-c, --useCpuCores <n>" 慎用 启动进程数 最好不要太大 进程间通信得用分布式锁防止并发处理
        commonCacheTime: 1,
        dblitepath: './database/db.sqlite.db',
        sqlitepath: './database/{type}.{database}.{tablename}.sqlite.db', // [database].[tablename].sqlite.db
    };

    config.slaves = {
        host: mysqlIP, // hostname of database / localhost by default "-h, --host <n>"
        port: mysqlPort, // port number for mysql / 3306 by default "-o, --port <n>"
        user: mysqlAccount, // username of database / root by default "-u, --user <n>"
        password: mysqlPassword, // password of database / empty by default "-p, --password <n>"
        database: 'xdata_slave', // database schema name "-d, --database <n>"
    };

    config.memorycache = {
        version: 'v3.3.7',
        init_wait_milisecond: 100,
        sync_wait_milisecond: 3000,
        sync_interval_milisecond: 100,
        schedule_task_time: '0 */1000 * * * *', //全量增量同步定时任务 
        schedule_hour_time: '0 */150000 * * * *', //全量增量同步定时任务 
        schedule_task_flag: false, //是否启动定时同步
        batch_num: 1,
        ddl_sqlite_flag: false,
        trace_sql_flag: false,
        cache_sqlite_query: false,
        cacheddl: {
            'bs_goods_receive': '',
            'bs_goods_borrow': '',
        },
    };

    return {
        ...config,
    };
};