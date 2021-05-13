const sqlite3 = require('sqlite3');
const config = require('../../../bin/config/config');
const filesystem = require('../../../lib/filesystem/filesystem');
const cache = require('../../../lib/cache/cache');
const lock = require('../../../lib/lock/redisLock');
const tools = require('../../../lib/tools/tools').tools;
const requestIp = require('request-ip');
const sqlstring = require('sqlstring');
const sqliteDBMap = new Map();
const mysql = require("mysql");
const { open } = require('sqlite');
const sqliteFile = `${process.cwd()}/` + config().service.sqlitepath;
sqlite3.verbose();

/**
 * 打开SQLiteDB
 */
const openSQLiteDB = async(sqliteDBMap = new Map()) => {
    const type = config().service.type || 'mysql';
    const database = config().service.database || 'xdata';
    const trace_sql_flag = config().memorycache.trace_sql_flag; //是否trace执行SQL
    const tablenames = config().memorycache.cacheddl;
    const keys = Object.keys(tablenames);
    for await (const tablename of keys) {
        try {
            const path = sqliteFile.replace(/{type}/g, type).replace(/{database}/g, database).replace(/{tablename}/g, tablename);
            const fileFlag = await filesystem.isFileExisted(path);
            if (!fileFlag) {
                filesystem.writeFile(path, "");
                console.log(`sqlite filename:`, path);
            }
            const db = await open({
                filename: path, //[type].[database].[tablename].sqlite.db
                driver: sqlite3.cached.Database
            });
            db.on('trace', (data) => {
                trace_sql_flag ? (console.info(`sql_trace> `, data)) : null;
            });
            sqliteDBMap.set(`${type}.${database}.${tablename}`, db);
        } catch (error) {
            console.error(`sqlite open error>`, error);
        }
    }
    return sqliteDBMap;
}

/**
 * 打开单个Sqlite数据库文件
 * @param {*} type 
 * @param {*} database 
 * @param {*} qTableName 
 */
const openSingleDB = async(type, database, qTableName, sqliteDBMap = new Map()) => {
    const path = sqliteFile.replace(/{type}/g, type).replace(/{database}/g, database).replace(/{tablename}/g, qTableName);
    const fileFlag = await filesystem.isFileExisted(path);
    if (!fileFlag) {
        filesystem.writeFile(path, "");
        console.log(`open single db by sqlite filename:`, path);
    }
    const db = await open({
        filename: path,
        driver: sqlite3.cached.Database
    });
    db.on('trace', (data) => {
        trace_sql_flag ? (console.info(`sql_trace> `, data)) : null;
    });
    sqliteDBMap.set(`${type}.${database}.${qTableName}`, db);
    return sqliteDBMap;
}

/**
 * 初始化sqliteDB
 */
const initSqliteDB = async(pool = { query: () => {} }, metaDB = {}, sqliteDBMap = new Map()) => {

    const ipaddress = tools.getIpAddress();
    const cacheddl = config().memorycache.cacheddl;
    const version = config().memorycache.version;
    const type = config().service.type || 'mysql';
    const database = config().service.database || 'xdata';
    const init_wait_milisecond = config().memorycache.init_wait_milisecond;
    const ddl_sqlite_flag = config().memorycache.ddl_sqlite_flag;
    const keys = Object.keys(cacheddl);
    console.log(`cache ddl #init# >>>>>>>>>>>>>> `);
    //开启分布式锁
    lock.lockExecs(`app:init_sqlite_db:${ipaddress}:${version}:lock`, async() => {
        console.log(`exec into lock which app:init_sqlite_db:lock `);
        (async() => {
            for await (tableName of keys) {
                const qTableName = `${tableName}`;
                const cacheKey = `init_sqlite_${qTableName}_${ipaddress}_${version}`;
                const flag = await cache.getValue(cacheKey);
                let initSQL = cacheddl[qTableName];
                try {
                    const db = sqliteDBMap.get(`${type}.${database}.${qTableName}`);
                    if (typeof db == 'undefined' || db == null || db == undefined || db == '') {
                        await openSingleDB(type, database, qTableName, sqliteDBMap);
                    }
                    if (flag != `true` && (tools.isNull(initSQL) || initSQL == 'generate' || initSQL == 'auto')) {
                        initSQL = await generateDDL(database, qTableName, pool);
                    }
                } catch (error) {
                    console.error(`generate ddl error:`, error);
                }
                try {
                    if (flag != `true` && !tools.isNull(initSQL)) { // await sqliteDB.query(initSQL); // memoryDB.query(initSQL);
                        ddl_sqlite_flag ? sqliteDB.query(initSQL) : null;
                        sqliteDBMap.get(`${type}.${database}.${qTableName}`).exec('BEGIN TRANSACTION');
                        sqliteDBMap.get(`${type}.${database}.${qTableName}`).exec(initSQL);
                        sqliteDBMap.get(`${type}.${database}.${qTableName}`).exec('COMMIT');
                        cache.setValue(cacheKey, `true`, 3600 * 24 * 365 * 1000); //console.error(`cache key: ${cacheKey} flag: ${flag} init sql:`, initSQL);
                    }
                } catch (error) {
                    console.error(`exec ddl error:`, error);
                }
                await tools.sleep(init_wait_milisecond);
            }
        })();
    });
    console.log(`cache ddl #init# >>>>>>>>>>>>>> finish ... `);
}

/**
 * 同步SqliteDB数据库
 * @param {*} pool
 */
const syncSqliteDB = async(pool = { query: () => {} }, metaDB = {}, sqliteDBMap, fullSyncFlag = false) => {

    //如果没有获取到MetaDB信息，则不能执行
    if (!(metaDB.tables && Object.keys(metaDB.tables).length > 0)) {
        return false;
    }
    console.log(`metaDB: `, ` metaDB.tables:`, JSON.stringify(metaDB.tables).slice(0, 100), ` metaDB.tables length: `, Object.keys(metaDB.tables).length);

    const ipaddress = tools.getIpAddress();
    const cacheddl = config().memorycache.cacheddl;
    const version = config().memorycache.version;
    const sync_interval_milisecond = config().memorycache.sync_interval_milisecond;
    const batch_num = config().memorycache.batch_num;
    const keys = Object.keys(cacheddl);
    const type = config().service.type || 'mysql';
    const database = config().service.database || 'xdata';

    console.log(`cache ddl #sync# start >>>>>>>>>>>>>> : ......`, `cache ddl #sync# keys >>>>>>>>>>>>>> :`, keys);

    //TODO 开启分布式锁 
    lock.lockExecs(`app:sync_sqlite_db:${ipaddress}:${version}:lock`, async() => {
        console.log(`exec into lock which app:sync_sqlite_db:lock `);
        (async() => { //拉取数据库数据
            for await (tableName of keys) { // 根据配置参数选择，增量查询或者全量查询
                const qTableName = `${tableName}`;
                const cacheKey = `sync_sqlite_${qTableName}_${ipaddress}_${version}`;
                const flag = await cache.getValue(cacheKey); // console.log(`cache key: ${cacheKey} flag: ${flag} . `);
                const path = sqliteFile.replace(/{type}/g, type).replace(/{database}/g, database).replace(/{tablename}/g, `${tableName}`);
                const fileFlag = await filesystem.isFileExisted(path);
                let initSQL = await generateDDL(database, qTableName, pool);
                const databaseKey = `${type}.${database}.${qTableName}`;
                let sqliteDB = sqliteDBMap.get(databaseKey);
                if (tools.isNull(sqliteDB)) {
                    await openSingleDB(type, database, qTableName, sqliteDBMap);
                    sqliteDB = sqliteDBMap.get(databaseKey);
                }
                if (!tools.isNull(initSQL)) {
                    sqliteDB.run('BEGIN TRANSACTION');
                    sqliteDB.run(initSQL);
                    sqliteDB.run('COMMIT');
                    await tools.sleep(sync_interval_milisecond);
                }
                if (!(flag == `true` && fileFlag) || fullSyncFlag) { /***************** 方案一 全量 *****************/
                    try {
                        cache.setValue(cacheKey, `true`, 3600 * 24 * 365 * 1000);
                        sync(qTableName, metaDB, sqliteDBMap, pool);
                    } catch (error) {
                        console.log(`full sync error:`, error);
                    }
                } else { /***************** 方案二 增量 *****************/
                    try {
                        //查询主数据库数据等于当前最大值得数据 xid 更新 //将多的数据同步更新过来
                        insync(qTableName, metaDB, sqliteDBMap, pool); //查询本地sqlite数据，获取当前最大值 id , xid //查询主数据库数据库大于当前最大值的数据 id 新增 //将多的数据同步新增过来
                    } catch (error) {
                        console.log(`increment sync error:`, error);
                    }
                }
                await tools.sleep(sync_interval_milisecond);
            }
        })();
    });
}

/**
 * 执行CRUD操作
 * @param {*} query 
 * @param {*} params 
 * @param {*} route 
 * @param {*} execstr 
 * @returns 
 */
const exec = async(query, params, tableName, sqliteDBMap) => {
    const qType = config().service.type || 'mysql';
    const qDatabase = config().service.database || 'xdata';
    const qTableName = tools.isNull(tableName) ? `${params[0]}` : tableName;
    console.log(`sqlite cache exec  ${qType}.${qDatabase}.${qTableName} `);
    execstr = sqlstring.format(query, params);
    console.info(`sqlite cache exec >>>>>>>>>>>>>>>`, execstr);
    const result = new Promise((resolve, reject) => {
        sqliteDBMap.get(`${qType}.${qDatabase}.${qTableName}`).all(execstr).then(rows => {
            return resolve(rows);
        });
    });
    return result;
}

const dataQuery = (query, params = [], pool) => {
    return new Promise(function(resolve) {
        pool.query(query, params, (error, rows, _fields) => {
            resolve(rows);
        });
    });
}

const insync = async(qTableName, metaDB, sqliteDBMap, pool) => {

    const ipaddress = tools.getIpAddress();
    const version = config().memorycache.version;
    const batch_num = config().memorycache.batch_num;
    const type = config().service.type || 'mysql';
    const database = config().service.database || 'xdata';
    const sqliteDB = sqliteDBMap.get(`${type}.${database}.${qTableName}`);
    let tempRows = null;

    // 查询MaxID,MinID
    let querySQL = `SELECT max(id) maxid , min(id) minid from ${qTableName} `; //需要检查ID是否存在 // console.log(`exec #sync# tablename#${qTableName}# >>>>>>>>>>>>>> :`, ` SELECT sql :`, querySQL);
    tempRows = await sqliteDB.all(querySQL);
    const { maxid, minid } = tempRows && tempRows.length > 0 ? tempRows[0] : { maxid: 0, minid: 0 };

    querySQL = `SELECT max(xid) maxXID from ${qTableName} `; //需要检查ID是否存在
    tempRows = await sqliteDB.all(querySQL);
    const { maxXID } = tempRows && tempRows.length > 0 ? tempRows[0] : 0;

    querySQL = `SELECT * from ${qTableName} where id > ? or id < ? `;
    const rows = await dataQuery(querySQL, [maxid, minid], pool);
    console.log(`exec #inc#sync# ${qTableName} rows length`, rows.length);
    try {
        await (async() => {
            console.log(`database> querySQL: ${querySQL} tablename:`, qTableName, ' rows length:', rows.length);
            const pageSize = batch_num; // N条批量执行
            let page = 1,
                maxRow = 0,
                maxPage = Math.ceil(rows.length / pageSize);
            sqliteDB.run('BEGIN TRANSACTION');
            while (page <= maxPage) {
                try {
                    startPage = pageSize * (page - 1);
                    maxRow = pageSize * (page - 0);
                    const curRows = rows.slice(startPage, maxRow);
                    const statement = tools.parseInsertSQL(qTableName, curRows, metaDB);
                    let execstr = sqlstring.format(statement.query, statement.params);
                    execstr = execstr.replace(/\r|\n/g, ''); //执行插入语句前，先查询数据库中是否存在此数据，若存在，则不执行 //sqliteDB.query(execstr, [], (err, rows) => { err ? (console.error(`exec error & sql:`, execstr, ` error:`, err, ` rows:`, curRows)) : null; });
                    sqliteDB.run(statement.query.replace(/INSERT INTO/g, 'INSERT OR REPLACE INTO'), statement.params).catch((error) => { console.error(`sync_exec_sql>`, statement.query, ` \nstatement>`, JSON.stringify(statement.params), `\nerror>`, error) }); // console.log(`cur rows:`, JSON.stringify(curRows).slice(0, 100), ` page :`, page); //console.log(`statement execstr:`, execstr.slice(0, 100), ` exec success... page: `, page); // console.log(`query:`, statement.query, ` params:`, statement.params);
                    console.log(`${type}.${database}.${qTableName} rows inc inserted which id eq `, curRows[0].id);
                } catch (error) {
                    console.log(`sqlite db exec error:`, error);
                } finally {
                    ++page;
                }
            }
            sqliteDB.run('COMMIT');
            console.log(`database> inc sync tablename:`, qTableName, ` over ... `);
        })();
    } catch (error) {
        console.log(`sql error:`, error);
    }

    querySQL = `SELECT * from ${qTableName} where xid > ? `;
    const patchRows = await dataQuery(querySQL, [maxXID], pool);
    console.log(`exec #inc#patch# ${qTableName} rows length`, patchRows.length);
    try {
        await (async() => {
            const pageSize = batch_num; // N条批量执行
            let page = 1,
                maxRow = 0,
                maxPage = Math.ceil(patchRows.length / pageSize);
            sqliteDB.run('BEGIN TRANSACTION');
            while (page <= maxPage) {
                try {
                    startPage = pageSize * (page - 1);
                    maxRow = pageSize * (page - 0);
                    const curRows = patchRows.slice(startPage, maxRow);
                    const statement = tools.parseUpdateSQL(qTableName, curRows, metaDB);
                    sqliteDB.run(statement.query, statement.params).catch((error) => { console.error(`sync_exec_sql>`, statement.query, ` \nstatement>`, JSON.stringify(statement.params), `\nerror>`, error) }); // console.log(`cur rows:`, JSON.stringify(curRows).slice(0, 100), ` page :`, page); //console.log(`statement execstr:`, execstr.slice(0, 100), ` exec success... page: `, page); // console.log(`query:`, statement.query, ` params:`, statement.params);
                    console.log(`${type}.${database}.${qTableName} rows inc patched which id eq `, curRows[0].id, ` & statement:`, statement);
                } catch (error) {
                    console.log(`sqlite db exec error:`, error);
                } finally {
                    ++page;
                }
            }
            sqliteDB.run('COMMIT');
            console.log(`database> inc sync tablename:`, qTableName, ` over ... `);
        })();
    } catch (error) {
        console.log(`sql error:`, error);
    }

}

const sync = async(qTableName, metaDB, sqliteDBMap, pool) => {

    const ipaddress = tools.getIpAddress();
    const version = config().memorycache.version;
    const batch_num = config().memorycache.batch_num;
    const type = config().service.type || 'mysql';
    const database = config().service.database || 'xdata';

    // TODO 同步之前，先查询一下此表最大length，如果小于50000，则不分页查询，如果大于50000，则需要分页查询。此次应该通过分页查询，每次查询10000条，不应该全量查询，当数据量比较小时，可以刷到sqlite中，但是当数据量较大，如1000000，则数据库查询不到，且无法正常持久化到sqlite中

    let maxLength = 1000000;

    const querySQL = `SELECT * from ${qTableName} order by id desc `; //需要检查ID是否存在
    console.log(`exec #sync# tablename#${qTableName}# >>>>>>>>>>>>>> :`, ` SELECT sql :`, querySQL);
    const sqliteDB = sqliteDBMap.get(`${type}.${database}.${qTableName}`);

    // 先查询出本地sqliteDB中含有数据，在插入本地sqliteDB前，先检查是否含有此数据，如果含有且内容不一致则执行更新操作
    const rows_sqlite = await sqliteDB.all(querySQL);
    const tempMap = new Map();
    for (const item of rows_sqlite) {
        tempMap.set(item.id, item);
    }

    try {
        // 查询主数据库所有数据，全部插入本地数据库中
        lock.lockExecs(`app:sync_sqlite_db@${qTableName}@full@:${ipaddress}:${version}:lock`, async() => {
            const rows = await dataQuery(querySQL, [], pool);
            console.log(`exec #sync# ${qTableName} rows length`, rows.length);
            try {
                await (async() => {
                    console.log(`database> querySQL: ${querySQL} tablename:`, qTableName, ' rows length:', rows.length);
                    const pageSize = batch_num; // N条批量执行
                    let page = 1,
                        maxRow = 0,
                        maxPage = Math.ceil(rows.length / pageSize);
                    sqliteDB.run('BEGIN TRANSACTION');
                    while (page <= maxPage) {
                        try {
                            startPage = pageSize * (page - 1);
                            maxRow = pageSize * (page - 0);
                            const curRows = rows.slice(startPage, maxRow);
                            const elem = tempMap.get(curRows[0].id)
                            if (tools.isNull(elem)) { //本地sqlite不存在，则继续插入操作
                                const statement = tools.parseInsertSQL(qTableName, curRows, metaDB); // let execstr = sqlstring.format(statement.query, statement.params);  execstr = execstr.replace(/\r|\n/g, ''); //执行插入语句前，先查询数据库中是否存在此数据，若存在，则不执行 //sqliteDB.query(execstr, [], (err, rows) => { err ? (console.error(`exec error & sql:`, execstr, ` error:`, err, ` rows:`, curRows)) : null; });
                                sqliteDB.run(statement.query.replace(/INSERT INTO/g, 'INSERT OR REPLACE INTO'), statement.params).catch((error) => { console.error(`sync_exec_sql>`, statement.query, ` \nstatement>`, JSON.stringify(statement.params), `\nerror>`, error) }); // console.log(`cur rows:`, JSON.stringify(curRows).slice(0, 100), ` page :`, page); //console.log(`statement execstr:`, execstr.slice(0, 100), ` exec success... page: `, page); // console.log(`query:`, statement.query, ` params:`, statement.params);
                                console.log(`${type}.${database}.${qTableName} rows inserted which id eq `, curRows[0].id);
                            } else if (!tools.isEqual(elem, curRows[0])) {
                                const statement = tools.parseUpdateSQL(qTableName, curRows, metaDB);
                                sqliteDB.run(statement.query, statement.params).catch((error) => { console.error(`sync_exec_sql>`, statement.query, ` \nstatement>`, JSON.stringify(statement.params), `\nerror>`, error) }); // console.log(`cur rows:`, JSON.stringify(curRows).slice(0, 100), ` page :`, page); //console.log(`statement execstr:`, execstr.slice(0, 100), ` exec success... page: `, page); // console.log(`query:`, statement.query, ` params:`, statement.params);
                                console.log(`${type}.${database}.${qTableName} rows which id eq `, curRows[0].id, ` is already existed & rows full patched which id eq `, curRows[0].id, ` & statement:`, statement);
                            }
                        } catch (error) {
                            console.log(`sqlite db exec error:`, error);
                        } finally {
                            ++page;
                        }
                    }
                    sqliteDB.run('COMMIT');
                    console.log(`database> sync tablename:`, qTableName, ` over ... `);
                })();
            } catch (error) {
                console.log(`sql error:`, error);
            }
            return true;
        });
    } catch (error) {
        console.log(`full scale sync error:`, error);
    }
}

/**
 * 根据MySQL系统中表配置信息生成SQLite建表语句
 */
const generateDDL = async(database = 'xdata', tableName = '', pool = { query: () => {} }) => {

    if (tools.isNull(tableName)) {
        return '';
    }

    const cacheKey = `generate_sqlite_rows_flag`;
    const flag = await cache.getValue(cacheKey);
    const querySQL = "SELECT `c`.`table_name`, `c`.`column_name`, `c`.`ordinal_position`, `c`.`column_key`, `c`.`is_nullable`, `c`.`column_type`, `c`.`column_default` FROM ((`information_schema`.`columns` AS `c` LEFT JOIN `information_schema`.`key_column_usage` AS `k` ON `c`.`column_name` = `k`.`column_name` AND `c`.`table_schema` = `k`.`referenced_table_schema` AND `c`.`table_name` = `k`.`table_name`) LEFT JOIN `information_schema`.`statistics` AS `s` ON `c`.`column_name` = `s`.`column_name` AND `c`.`table_schema` = `s`.`index_schema` AND `c`.`table_name` = `s`.`table_name`) LEFT JOIN `information_schema`.`VIEWS` AS `v` ON `c`.`table_schema` = `v`.`table_schema` AND `c`.`table_name` = `v`.`table_name` WHERE `c`.`table_schema` = ':table_schema' AND `v`.`table_name` IS NULL ORDER BY `c`.`table_name`, `c`.`ordinal_position` ".replace(/:table_schema/g, database);

    let ddlSQL = `CREATE TABLE IF NOT EXISTS ${tableName} ( \n `;

    pool.query(querySQL, [], (error, rows, _fields) => {
        cache.setValue(cacheKey, `true`, 3600 * 24 * 365 * 1000);
        cache.setValue(cacheKey.replace('_flag', '_value'), JSON.stringify(rows), 3600 * 24 * 365 * 1000);
    });

    if (flag != 'true') { //查询表字段信息
        await tools.sleep(15000);
    }

    let rows = await cache.getValue(cacheKey.replace('_flag', '_value'));
    try {
        rows = JSON.parse(rows);
    } catch (error) {
        console.log(`generate ddl json parse error:`, error);
    }

    //筛选数据，选出表名称的数据
    rows = rows.filter((item) => {
        return item['table_name'] == tableName;
    });
    rows = rows.filter((item, index) => {
        const _index = rows.findIndex(elem => { return elem['column_name'] == item['column_name'] })
        return _index == index;
    }); // console.log(`generate create table ddl rows:`, rows); // console.error(`generate create table ddl rows:`, rows);

    //根据表字段数据生成建表语句
    for (const element of rows) {
        ddlSQL += generateDdlColumn(element);
    }

    ddlSQL = ddlSQL.replace(/,$/gi, "");
    ddlSQL += ' ) '; // 建表语句封尾

    //console.log(`generate create table ddl:`, ddlSQL); //console.error(`generate create table ddl:`, ddlSQL);
    cache.setValue(cacheKey.replace('_flag', '_create_sql'), ddlSQL, 3600 * 24 * 365 * 1000);

    return ddlSQL;
}

/**
 * 根据字段元素信息，生成此字段的DDL
 * @param {*} element 
 * @returns 
 */
const generateDdlColumn = (element) => {
    const defaultKey = element['column_default'] == 'CURRENT_TIMESTAMP' ? ' default CURRENT_TIMESTAMP ' : (element['column_type'].includes('char') && !tools.isNull(element['column_default']) ? ` default '${element['column_default']}' ` : (!tools.isNull(element['column_default']) ? ` default ${element['column_default']} ` : ''));
    const nullableKey = element['is_nullable'] == 'YES' ? ' null ' : ' not null ';
    const primaryKey = element['column_key'] == 'PRI' ? ' primary key ' : '';
    return ` ${element['column_name']} ${element['column_type']} ${defaultKey} ${nullableKey} ${primaryKey} \n ,`;
}

const sqlitetaskExports = {
    openSQLiteDB,
    openSingleDB,
    initSqliteDB,
    syncSqliteDB,
    generateDDL,
    generateDdlColumn,
    exec,
}

module.exports = sqlitetaskExports;