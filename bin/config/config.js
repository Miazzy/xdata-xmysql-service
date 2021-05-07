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
        dblitepath: './database/db.sqlite',
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
        version: 'v2.1.3',
        cacheddl: {
            'bs_seal_regist': `CREATE TABLE IF NOT EXISTS bs_seal_regist
            (
                id                  varchar(36)                            not null  primary key,
                create_by           varchar(128)                           null ,
                create_time         timestamp    default CURRENT_TIMESTAMP not null,
                filename            varchar(256)                           null ,
                count               int                                    null,
                deal_depart         varchar(256)                           null,
                deal_manager        varchar(256)                           null, -- comment '经办人员',
                approve_type        varchar(32)                            null, -- comment '审批类别',
                seal_time           datetime                               null, -- comment '盖印时间',
                seal_man            varchar(256)                           null, -- comment '盖印人员',
                seal_type           varchar(256)                           null, -- comment '用印类型',
                seal_wflow          varchar(256) default 'none'            null, -- comment '用印流程',
                seal_category       text                                   null, -- comment '印章类型(合同专用章、公章、法人章、法人私章)',
                seal_category01     text                                   null,
                seal_category02     text                                   null,
                order_type          varchar(256)                            null, -- comment '用印顺序',
                contract_id         varchar(256)                            null, -- comment '合同编号',
                sign_man            varchar(256)                            null, -- comment '文件签收',
                workno              varchar(256)                            null, -- comment '流程编号',
                status              varchar(256)                            null, -- comment '用印状态',
                deal_mail           varchar(256)                            null, -- comment '经办人邮箱',
                mobile              varchar(256)                            null, -- comment '经办人电话',
                files               text                                    null, -- comment '附件信息',
                username            varchar(256)                            null, -- comment '登录账户',
                prefix              varchar(128)                            null, -- comment '编号前缀',
                message             varchar(512)                            null, -- comment '审批说明',
                company             varchar(512)                            null, -- comment '所属公司',
                partner             text                                    null, -- comment '合作方',
                no                  int                                     null, -- comment '印章编号',
                serialid            int                                     null, -- comment '序列号',
                serial_id           int                                     null,
                zone_name           text                                    null,
                team_name           varchar(128)                            null, -- comment '团队名称',
                seal_group_ids      varchar(1024)                           null, -- comment '用印组员',
                seal_group_names    varchar(1024)                           null, -- comment '用印组员名称',
                seal                varchar(1024)                           null, -- comment '印章组员',
                archive             varchar(1024)                           null, -- comment '归档组员',
                name                varchar(256)                            null, -- comment '流程组名',
                front               varchar(1024)                           null, -- comment '前台组员',
                seal_name           varchar(256)                            null, -- comment '印章员工',
                front_name          varchar(256)                            null, -- comment '前台员工',
                archive_name        varchar(256)                            null, -- comment '归档员工',
                front_group_ids     varchar(1024)                           null, -- comment '前台组员',
                front_group_names   varchar(1024)                           null, -- comment '前台组员名称',
                archive_group_ids   text                                    null, -- comment '档案组员',
                archive_group_names text                                    null, -- comment '档案组员名称',
                finance             varchar(512)                            null, -- comment '财务归档账号',
                finance_name        varchar(512)                            null, -- comment '财务归档员工',
                record              varchar(512)                            null, -- comment '档案归档账号',
                record_name         varchar(512)                            null, -- comment '档案归档员工',
                doc_time            datetime                                null, -- comment '档案时间',
                receive_time        datetime                                null, -- comment '领取时间',
                finance_time        datetime                                null, -- comment '财务时间',
                front_time          datetime                                null, -- comment '移交时间',
                done_time           datetime                                null, -- comment '归档时间',
                send_time           datetime                                null,
                send_location       varchar(256)                            null,
                send_mobile         varchar(256)                            null,
                confirm_status      varchar(256)                            null,
                remark              varchar(256)                            null,
                finance_status      int          default 0                  null,
                archive_status      int          default 0                  null,
                receive_status      int          default 0                  null,
                stimestamp          timestamp    default CURRENT_TIMESTAMP  null,
                xid                 varchar(36)  default '0'                null,
                update_time         timestamp    default CURRENT_TIMESTAMP  null
            )`,
            'bs_goods_receive': `CREATE TABLE IF NOT EXISTS bs_goods_receive
            (
                id               varchar(36)                 not null primary key, --  comment '主键'
                create_by        varchar(50)                 null, --  comment '创建人',
                create_time      datetime                    null, --  comment '创建日期',
                receive_time     datetime                    null, --  comment '领用时间',
                name             varchar(256)                null, --  comment '物品名称',
                amount           varchar(32)                 null, --  comment '领用数量',
                unit             varchar(32)  default '个'    null, --  comment '物品单位',
                receive_name     varchar(256)                null, --  comment '领用人员',
                remark           varchar(256)                null, --  comment '备注说明',
                type             varchar(256) default '办公用品' null, --  comment '领用类别',
                company          varchar(256)                null, --  comment '领用单位',
                status           varchar(256) default '待处理'  null, --  comment '状态',
                approve_name     varchar(256)                null, --  comment '审批人员',
                workflow         varchar(256)                null, --  comment '关联流程',
                department       varchar(256)                null, --  comment '领用部门',
                approve          varchar(256)                null, --  comment '审批人员',
                pid              varchar(36)                 null, --  comment '上级编号',
                userid           varchar(256)                null, --  comment '接待人员',
                user_group_ids   text                        null, --  comment '接待人员组',
                user_group_names text                        null, --  comment '接待人员组名',
                user_admin_name  varchar(256)                null, --  comment '接待姓名',
                disagree_remark  varchar(256)                null, --  comment '驳回理由',
                notify_time      datetime                    null, --  comment '消息通知时间',
                serialid         int                         null,
                xid              varchar(36)  default '0'    null
            )`,
            'bs_goods_borrow': `CREATE TABLE IF NOT EXISTS bs_goods_borrow
            (
                id               varchar(36)             not null primary key, -- comment '主键'
                create_by        varchar(50)             null, --  comment '创建人',
                create_time      datetime                null, --  comment '创建日期',
                amount           varchar(32)             null, --  comment '借用数量',
                workflow         varchar(256)            null, --  comment '关联流程',
                receive_time     datetime                null, --  comment '借用时间',
                remark           varchar(256)            null, --  comment '备注说明',
                type             varchar(256)            null, --  comment '借用类别',
                serialid         int                     null, --  comment '序列编号',
                approve          varchar(256)            null, --  comment '审批人员',
                name             varchar(256)            null, --  comment '物品名称',
                receive_name     varchar(256)            null, --  comment '借用人员',
                company          varchar(256)            null, --  comment '借用单位',
                department       varchar(256)            null, --  comment '借用部门',
                status           varchar(256)            null, --  comment '状态',
                approve_name     varchar(256)            null, --  comment '审批人员',
                pid              varchar(36)             null, --  comment '上级编号',
                user_group_ids   text                    null, --  comment '接待人员组',
                userid           varchar(256)            null, --  comment '接待人员',
                user_group_names text                    null, --  comment '接待人员组名',
                user_admin_name  varchar(256)            null, --  comment '接待姓名',
                unit             varchar(32)             null, --  comment '物品单位',
                notify_time      datetime                null, --  comment '消息通知时间',
                xid              varchar(36) default '0' null
            )`,
        },
    };

    return {
        ...config,
    };
};