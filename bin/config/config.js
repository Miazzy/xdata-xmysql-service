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
        registStatus: false,
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

    config.redislock = {
        timeout: 300000,
        retries: 100,
        delay: 3000,
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
        version: 'v3.0.1',
        init_wait_milisecond: 100,
        sync_wait_milisecond: 5000,
        sync_interval_milisecond: 1000,
        batch_num: 1000,
        ddl_sqlite_flag: false,
        trace_sql_flag: false,
        cacheddl: {
            'bs_seal_regist': '',
            'bs_seal_regist_archive': '',
            'bs_seal_regist_finance': '',
            'bs_company_flow': '',
            'bs_company_flow_alteration': '',
            'bs_company_flow_base': '',
            'bs_company_flow_data': '',
            'bs_company_flow_inc': '',
            'bs_company_flow_link': '',
            'bs_company_flow_manager': '',
            'bs_company_flow_pledge': '',
            'bs_company_flow_qualification': '',
            'bs_company_flow_report': '',
            'bs_company_flow_stock': '',
            'bs_admin_address': '',
            'bs_admin_group': '',
            'bs_goods_borrow': '',
            'bs_goods_receive': '',
            'bs_legal': '',
            'bs_ability_quota': '',
            'bs_announce': '',
            'bs_approve': '',
            'bs_approve_general': '',
            'bs_approve_node': '',
            'bs_ask_report': '',
            'bs_async_log': '',
            'bs_attendance': '',
            'bs_attendance_details': '',
            'bs_blog': '',
            'bs_blog_attention': '',
            'bs_blog_tags': '',
            'bs_blog_watchtag': '',
            'bs_blogger': '',
            'bs_books': '',
            'bs_bug_logging': '',
            'bs_car_apply': '',
            'bs_comments': '',
            'bs_communication': '',
            'bs_company': '',
            'bs_company_base': '',
            'bs_company_branch': '',
            'bs_company_dev_annual_report': '',
            'bs_company_dev_billboard': '',
            'bs_company_dev_business_events': '',
            'bs_company_dev_compatible_products': '',
            'bs_company_dev_core_person': '',
            'bs_company_dev_financing': '',
            'bs_company_info': '',
            'bs_company_inp_certification': '',
            'bs_company_inp_copyright': '',
            'bs_company_inp_patent': '',
            'bs_company_inp_trademark': '',
            'bs_company_inp_websiteorapp': '',
            'bs_company_investments': '',
            'bs_company_legal_accreditation': '',
            'bs_company_legal_announce': '',
            'bs_company_legal_courtsession': '',
            'bs_company_legal_judicative': '',
            'bs_company_legal_publication': '',
            'bs_company_legal_stock_freeze': '',
            'bs_company_legal_stock_pledged': '',
            'bs_company_manage_bid': '',
            'bs_company_manage_permission': '',
            'bs_company_manage_recruit': '',
            'bs_company_manage_supplier': '',
            'bs_company_manage_tax_credits': '',
            'bs_company_manage_taxpayer': '',
            'bs_company_senior_executive': '',
            'bs_company_stockholder': '',
            'bs_contract_transfer_apply': '',
            'bs_covid_address': '',
            'bs_crontab_task': '',
            'bs_document': '',
            'bs_document_item': '',
            'bs_dynamic': '',
            'bs_egress': '',
            'bs_entry_job': '',
            'bs_entry_man': '',
            'bs_favor_info': '',
            'bs_free_process': '',
            'bs_free_process_h': '',
            'bs_goods': '',
            'bs_home_pictures': '',
            'bs_hrmresource': '',
            'bs_hrmschedulesign': '',
            'bs_issue': '',
            'bs_job_logging': '',
            'bs_leave': '',
            'bs_lock_info': '',
            'bs_lost_property': '',
            'bs_market_info': '',
            'bs_message': '',
            'bs_mireanna': '',
            'bs_mireanna_item': '',
            'bs_month_job_logging': '',
            'bs_news': '',
            'bs_notice': '',
            'bs_official_seal': '',
            'bs_overtime': '',
            'bs_payment': '',
            'bs_plan_task': '',
            'bs_plan_task_item': '',
            'bs_plan_task_mission': '',
            'bs_product_logging': '',
            'bs_project_logging': '',
            'bs_purchase': '',
            'bs_purchase_item': '',
            'bs_quarter_job_logging': '',
            'bs_questions': '',
            'bs_questions_rs': '',
            'bs_record_borrow': '',
            'bs_recruit': '',
            'bs_redhead': '',
            'bs_registor': '',
            'bs_regular_apply': '',
            'bs_reim': '',
            'bs_reim_item': '',
            'bs_repair_apply': '',
            'bs_report_job_logging': '',
            'bs_requirement': '',
            'bs_reserve': '',
            'bs_resign': '',
            'bs_reward_apply': '',
            'bs_reward_data': '',
            'bs_reward_items': '',
            'bs_salary': '',
            'bs_seal_contract': '',
            'bs_seal_declare': '',
            'bs_seal_normal': '',
            'bs_seal_query_rights': '',
            'bs_seal_registed': '',
            'bs_shifts_apply': '',
            'bs_short_link': '',
            'bs_sign': '',
            'bs_sign_in': '',
            'bs_sign_up': '',
            'bs_sign_work': '',
            'bs_sql_log': '',
            'bs_sync_rec': '',
            'bs_task_assign': '',
            'bs_task_logging': '',
            'bs_team': '',
            'bs_traffic_allowance': '',
            'bs_transaction': '',
            'bs_travel': '',
            'bs_user_info': '',
            'bs_visit_apply': '',
            'bs_visit_appointment': '',
            'bs_wedepart': '',
            'bs_week_job_logging': '',
            'bs_wework_depart': '',
            'bs_wework_user': '',
            'bs_work_contact': '',
            'bs_work_contact_item': '',
            'bs_work_examine': '',
            'bs_work_examine_items': '',
            'bs_year_job_logging': '',
            'pr_business': '',
            'pr_business_status': '',
            'pr_businesses': '',
            'pr_collection': '',
            'pr_database_log': '',
            'pr_design': '',
            'pr_flow': '',
            'pr_log': '',
            'pr_log_history': '',
            'pr_log_informed': '',
            'pr_log_mnode': '',
            'pr_log_mnode_history': '',
            'pr_log_unode': '',
            'pr_log_unode_history': '',
            'pr_rights': '',
            'pr_template': '',
            'sys_announcement': '',
            'sys_announcement_send': '',
            'sys_category': '',
            'sys_check_rule': '',
            'sys_data_log': '',
            'sys_data_source': '',
            'sys_depart': '',
            'sys_depart_permission': '',
            'sys_depart_role': '',
            'sys_depart_role_permission': '',
            'sys_depart_role_user': '',
            'sys_dict': '',
            'sys_dict_item': '',
            'sys_fill_rule': '',
            'sys_log': '',
            'sys_permission': '',
            'sys_permission_data_rule': '',
            'sys_position': '',
            'sys_quartz_job': '',
            'sys_role': '',
            'sys_role_permission': '',
            'sys_sms': '',
            'sys_sms_template': '',
            'sys_user': '',
            'sys_user_agent': '',
            'sys_user_depart': '',
            'sys_user_role': '',
        },
    };

    return {
        ...config,
    };
};