"use strict";

const Redis = require("ioredis");
const RedisClustr = require('redis-clustr');
const config = require('../bin/config/config');
const tools = require('./tools/tools').tools;
const ioredis = new Redis(config().redis);
const redis = new RedisClustr(config().redisclustr);
const sqlstring = require('sqlstring');

/** 获取Redis缓存值 */
const getValue = async(key) => {
    return new Promise((resolve, reject) => {
        redis.get(key, (err, value) => {
            if (err) {
                return reject(err);
            }
            return resolve(value);
        })
    });
}

/** 设置Redis缓存值 */
const setValue = async(key, value, extime = 3) => {
    redis.set(key, value, 'EX', extime);
}

/**
 * @description xdata-xmysql-service 
 * @classdesc RestAPI控制器
 * @author xmysql
 */
class xctrl {

    //构造函数
    constructor(app, mysql) {
        this.app = app;
        this.mysql = mysql;
    }

    //新增数据函数
    async create(req, res) {
        let query = "INSERT INTO ?? SET ?";
        let params = [];

        params.push(req.app.locals._tableName);
        params.push(req.body);

        if (req.body.xid || req.headers.xid) {
            req.body.xid = tools.queryUniqueID();
        }
        console.log(`insert request body:`, req.body, ` req.headers.xid:`, req.headers.xid);

        var results = await this.mysql.exec(query, params);
        results.node = req.body;

        //记录消息队列或者异步日志query,params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, id, req.body

        res.status(200).json(results);
    }

    //查询数据函数
    async list(req, res) {
        let queryParamsObj = {};
        let results = null;

        queryParamsObj.query = "";
        queryParamsObj.params = [];

        this.mysql.prepareListQuery(req, res, queryParamsObj, 0);

        const key = `cache_key_list_${queryParamsObj.query}#${JSON.stringify(queryParamsObj.params)}`;

        //根据缓存key query和params , 查询是否有命中数据
        try {
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(
            queryParamsObj.query,
            queryParamsObj.params
        );

        //记录消息队列或者异步日志query,params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, query&params, results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果3s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 5);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    //查询数据函数
    async nestedList(req, res) {
        let queryParamsObj = {};
        let results = null;

        queryParamsObj.query = "";
        queryParamsObj.params = [];

        this.mysql.prepareListQuery(req, res, queryParamsObj, 1);

        const key = `cache_key_nestedList_${queryParamsObj.query}#${JSON.stringify(queryParamsObj.params)}`;

        //根据缓存key query和params , 查询是否有命中数据
        try {
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(
            queryParamsObj.query,
            queryParamsObj.params
        );

        //记录消息队列或者异步日志query,params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, query&params, results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果3s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 5);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    //查询第一条数据函数
    async findOne(req, res) {
        let queryParamsObj = {};
        let results = null;

        queryParamsObj.query = "";
        queryParamsObj.params = [];

        this.mysql.prepareListQuery(req, res, queryParamsObj, 2);

        //根据缓存key query和params , 查询是否有命中数据
        const key = `cache_key_findOne_${queryParamsObj.query}#${JSON.stringify(queryParamsObj.params)}`;

        //根据缓存key query和params , 查询是否有命中数据
        try {
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(
            queryParamsObj.query,
            queryParamsObj.params
        );

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, query&params, results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果3s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 5);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    //查询数据 根据ID值查询数据
    async read(req, res) {
        let query = "select * from ?? where ";
        let params = [];
        let results = null;

        params.push(req.app.locals._tableName);

        let clause = this.mysql.getPrimaryKeyWhereClause(
            req.app.locals._tableName,
            req.params.id.split("___")
        );

        if (!clause) {
            return res.status(400).send({
                error: "Table is made of composite primary keys - all keys were not in input"
            });
        }

        query += clause;
        query += " LIMIT 1";

        //根据缓存key query和params , 查询是否有命中数据
        const key = `cache_key_read_${query}#${JSON.stringify(params)}`;

        //根据缓存key query和params , 查询是否有命中数据
        try {
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(query, params);

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, query&params, results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果5s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 1);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    //判断是否存在函数
    async exists(req, res) {
        let query = "select * from ?? where ";
        let params = [];
        let results = null;

        params.push(req.app.locals._tableName);

        let clause = this.mysql.getPrimaryKeyWhereClause(
            req.app.locals._tableName,
            req.params.id.split("___")
        );

        if (!clause) {
            return res.status(400).send({
                error: "Table is made of composite primary keys - all keys were not in input"
            });
        }

        query += clause;
        query += " LIMIT 1";

        //根据缓存key query和params , 查询是否有命中数据
        const key = `cache_key_read_${query}#${JSON.stringify(params)}`;

        //根据缓存key query和params , 查询是否有命中数据
        try {
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(query, params);

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, query&params, results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果5s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 3);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    async update(req, res) {
        let query = "REPLACE INTO ?? SET ?";
        let params = [];

        params.push(req.app.locals._tableName);
        params.push(req.body);

        if (req.body.xid || req.headers.xid) {
            req.body.xid = tools.queryUniqueID();
        }
        console.log(`update request body:`, req.body, ` req.headers.xid:`, req.headers.xid);

        var results = await this.mysql.exec(query, params);
        results.node = req.body;

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, id, req.body , update操作需要先查询一次

        res.status(200).json(results);
    }

    async patch(req, res) {

        let query = "UPDATE ?? SET ";
        let keys = Object.keys(req.body);

        if (req.body.xid || req.headers.xid) {
            req.body.xid = tools.queryUniqueID();
        }
        console.log(`patch request body:`, req.body, ` req.headers.xid:`, req.headers.xid);

        // SET clause
        let updateKeys = "";
        for (let i = 0; i < keys.length; ++i) {
            updateKeys += keys[i] + " = ? ";
            if (i !== keys.length - 1) updateKeys += ", ";
        }

        // where clause
        query += updateKeys + " where ";
        let clause = this.mysql.getPrimaryKeyWhereClause(
            req.app.locals._tableName,
            req.params.id.split("___")
        );

        if (!clause) {
            return res.status(400).send({
                error: "Table is made of composite primary keys - all keys were not in input"
            });
        }

        query += clause;

        let params = [];
        params.push(req.app.locals._tableName);
        params = params.concat(Object.values(req.body));

        let results = await this.mysql.exec(query, params);
        results.node = req.body;

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, id, req.body , patch操作需要先查询一次

        res.status(200).json(results);
    }

    async delete(req, res) {
        let query = "DELETE FROM ?? WHERE ";
        let params = [];

        params.push(req.app.locals._tableName);

        let clause = this.mysql.getPrimaryKeyWhereClause(
            req.app.locals._tableName,
            req.params.id.split("___")
        );

        if (!clause) {
            return res.status(400).send({
                error: "Table is made of composite primary keys - all keys were not in input"
            });
        }

        query += clause;

        let results = await this.mysql.exec(query, params);

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, id, status#delete , delete操作需要标记状态

        res.status(200).json(results);
    }

    async multiPatch(req, res, tableName, patchID = '') {

        tableName = tableName + '@patch';

        let query = "UPDATE ?? SET ";
        let keys = Object.keys(req.body[tableName]);
        let params = [];
        let updateKeys = "";

        for (let i = 0; i < keys.length; ++i) {
            updateKeys += keys[i] + " = ? ";
            if (i !== keys.length - 1) updateKeys += ", ";
        }

        query += updateKeys + " where ";

        if (req.body[tableName] && req.body[tableName]['id']) {
            console.log(`patchID: ${patchID} => ${req.body[tableName]['id']} `);
            patchID = req.body[tableName]['id'];
        }

        let clause = this.mysql.getPrimaryKeyWhereClause(tableName, [patchID]);

        if (clause) {

            query += clause;
            params.push(tableName);
            params = params.concat(Object.values(req.body[tableName]));
            await this.mysql.exec(query, params);

            //记录消息队列或者异步日志query, params
            (async() => { //异步日志记录到消息队列中

            })();

            //设置缓存 tablename, id, req.body[tableName] , update操作需要先查询一次
        }
    }

    async multiDelete(req, res, ftableName = '', tableName = '') {
        tableName = ftableName + '@delete';
        try {
            let query = `delete from ?? where :fieldName = ':fieldValue' `;
            let params = [];
            let fieldName = req.body[tableName].fieldName || '-';
            let fieldValue = req.body[tableName].fieldValue || '-';
            query = query.replace(':ftableName', ftableName).replace(':fieldName', fieldName).replace(':fieldValue', fieldValue);
            params.push(ftableName);
            console.log(`multi delete table data : `, query, ` table name :`, ftableName);
            await this.mysql.exec(query, params);

            //记录消息队列或者异步日志query, params
            (async() => { //异步日志记录到消息队列中

            })();

            //设置缓存 tablename, key&value , status#delete , delete操作需要先查询一次

        } catch (error) {
            console.log(error);
        }
    }

    async multiInsert(req, res) {
        // console.log(`body:`, JSON.stringify(req.body));

        //执行删除操作
        try {
            let tableNames = req.body.deletetname.split(',');
            tableNames = [...new Set(tableNames)];
            for (let tableName of tableNames) {
                await this.multiDelete(req, res, tableName, );
            }
        } catch (error) {
            console.log(error);
        }

        //执行修改操作
        try {
            let tableNames = req.body.patchtname.split(',');
            let ids = req.body.patchID.split(',');
            tableNames = [...new Set(tableNames)];
            ids = [...new Set(ids)];
            for (let tableName of tableNames) {
                const index = tableNames.findIndex(item => { return item == tableName });
                await this.multiPatch(req, res, tableName, ids && ids[index] ? ids[index] : '');
            }
        } catch (error) {
            console.log(error);
        }

        //执行新增操作，如果存在直接替换replace into
        try {
            let results = [];
            let tableNames = req.body.tname.split(',');
            console.log(`tableNames: `, req.body.tname);

            for (let tableName of tableNames) {
                let queryParamsObj = {};
                queryParamsObj.query = "";
                queryParamsObj.params = [];

                this.mysql.prepareBulkReplace(
                    tableName,
                    req.body[tableName],
                    queryParamsObj
                );

                results = await this.mysql.exec(
                    queryParamsObj.query,
                    queryParamsObj.params
                );

                //记录消息队列或者异步日志query, params
                (async() => { //异步日志记录到消息队列中

                })();

                //设置缓存 tablename, id, req.body[tableName]
            }
            res.status(200).json(results);
        } catch (error) {
            res.status(200).json({ code: '99', error });
        }
    }

    async bulkInsert(req, res) {

        let queryParamsObj = {};
        queryParamsObj.query = "";
        queryParamsObj.params = [];
        let results = [];

        this.mysql.prepareBulkInsert(
            req.app.locals._tableName,
            req.body,
            queryParamsObj
        );

        results = await this.mysql.exec(
            queryParamsObj.query,
            queryParamsObj.params
        );

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, id, req.body[tableName]

        res.status(200).json(results);
    }

    async whereDelete(req, res) {
        let query = `delete from ?? where :fieldName = ':fieldValue' `;
        let params = [];
        let fieldName = req.query.fieldName || 'id';
        let fieldValue = req.query.fieldValue || '';

        console.log(`req: ${JSON.stringify(req.query)}`);
        query = query.replace(':fieldName', fieldName).replace(':fieldValue', fieldValue);
        params.push(req.app.locals._tableName);
        console.log(`query:${query}, params:${JSON.stringify(params)}`);

        var results = await this.mysql.exec(query, params);

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, key&value , status#delete , delete操作需要先查询一次

        res.status(200).json(results);
    }

    async whereDeleteAndInsert(req, res) {
        let query = `delete from ?? where :fieldName = ':fieldValue' `;
        let params = [];
        let fieldName = req.query.fieldName || 'id';
        let fieldValue = req.query.fieldValue || '';

        console.log(`req: ${JSON.stringify(req.query)}`);
        query = query.replace(':fieldName', fieldName).replace(':fieldValue', fieldValue);
        params.push(req.app.locals._tableName);
        console.log(`query:${query}, params:${JSON.stringify(params)}`);

        await this.mysql.exec(query, params);

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, key&value , status#delete , delete操作需要先查询一次

        await bulkInsert(req, res);
    }

    async bulkDelete(req, res) {
        let query = "delete from ?? where ?? in ";
        let params = [];

        params.push(req.app.locals._tableName);
        params.push(this.mysql.getPrimaryKeyName(req.app.locals._tableName));

        query += "(";

        if (req.query && req.query._ids) {
            let ids = req.query._ids.split(",");
            for (var i = 0; i < ids.length; ++i) {
                if (i) {
                    query += ",";
                }
                query += "?";
                params.push(ids[i]);
            }
        }

        query += ")";

        //console.log(query, params);

        var results = await this.mysql.exec(query, params);

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, ids , status#delete , delete操作需要先查询一次

        res.status(200).json(results);
    }

    async bulkRead(req, res) {

        let queryParamsObj = {};
        let results = null;

        queryParamsObj.query = "";
        queryParamsObj.params = [];

        this.mysql.prepareListQuery(req, res, queryParamsObj, 3);

        //根据缓存key query和params , 查询是否有命中数据
        const key = `cache_key_bulkRead_${queryParamsObj.query}#${JSON.stringify(queryParamsObj.params)}`;

        try {
            //根据缓存key query和params , 查询是否有命中数据
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(
            queryParamsObj.query,
            queryParamsObj.params
        );

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, ids , results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果3s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 3);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    async count(req, res) {
        let queryParamsObj = {};
        let results = null;

        queryParamsObj.query = "select count(1) as no_of_rows from ?? ";
        queryParamsObj.params = [];

        queryParamsObj.params.push(req.app.locals._tableName);

        this.mysql.getWhereClause(
            req.query._where,
            req.app.locals._tableName,
            queryParamsObj,
            " where "
        );

        //根据缓存key query和params , 查询是否有命中数据
        const key = `cache_key_count_${queryParamsObj.query}#${JSON.stringify(queryParamsObj.params)}`;

        try {
            //根据缓存key query和params , 查询是否有命中数据
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, query&params , results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果3s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 3);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    async distinct(req, res) {
        let queryParamsObj = {};
        let results = null;

        queryParamsObj.query = "";
        queryParamsObj.params = [];

        this.mysql.prepareListQuery(req, res, queryParamsObj, 4);

        //根据缓存key query和params , 查询是否有命中数据
        const key = `cache_key_distinct_${queryParamsObj.query}#${JSON.stringify(queryParamsObj.params)}`;

        try {
            //根据缓存key query和params , 查询是否有命中数据
            results = await getValue(key);
            //查询到缓存信息，直接返回
            if (results) {
                results = typeof results == 'string' ? JSON.parse(results) : results;
                console.log(`result : ${JSON.stringify(results).slice(0,10)}`);
                return res.status(200).json(results);
            }
        } catch (error) {
            console.log(error);
        }

        results = await this.mysql.exec(
            queryParamsObj.query,
            queryParamsObj.params
        );

        //记录消息队列或者异步日志query, params
        (async() => { //异步日志记录到消息队列中

        })();

        //设置缓存 tablename, query&params , results 
        try {
            if (results) {
                console.log(`cache key: ${key}`); //缓存查询query和params,如果3s内再次查询则使用缓存
                redis.set(key, JSON.stringify(results), 'EX', 3);
            }
        } catch (error) {
            console.log(error);
        }

        res.status(200).json(results);
    }

    async groupBy(req, res) {
        if (req.query && req.query._fields) {
            let queryParamsObj = {};
            queryParamsObj.query = "select ";
            queryParamsObj.params = [];

            /**************** add columns and group by columns ****************/
            this.mysql.getColumnsForSelectStmt(
                req.app.locals._tableName,
                req.query,
                queryParamsObj
            );

            queryParamsObj.query += ",count(*) as _count from ?? group by ";
            let tableName = req.app.locals._tableName;
            queryParamsObj.params.push(tableName);

            this.mysql.getColumnsForSelectStmt(
                req.app.locals._tableName,
                req.query,
                queryParamsObj
            );

            if (!req.query._sort) {
                req.query._sort = {};
                req.query._sort = "-_count";
            }

            /**************** add having clause ****************/
            this.mysql.getHavingClause(
                req.query._having,
                req.app.locals._tableName,
                queryParamsObj,
                " having "
            );

            /**************** add orderby clause ****************/
            this.mysql.getOrderByClause(req.query, tableName, queryParamsObj);

            //console.log(queryParamsObj.query, queryParamsObj.params);
            var results = await this.mysql.exec(
                queryParamsObj.query,
                queryParamsObj.params
            );

            //记录消息队列或者异步日志query,params
            (async() => { //异步日志记录到消息队列中

            })();

            res.status(200).json(results);
        } else {
            const message = "Missing _fields query params eg: /api/tableName/groupby?_fields=column1";
            res.status(400).json({ message });
        }
    }

    async ugroupby(req, res) {
        if (req.query && req.query._fields) {
            let queryParamsObj = {};
            queryParamsObj.query = "";
            queryParamsObj.params = [];
            let uGrpByResults = {};

            /**************** add fields with count(*) *****************/
            let fields = req.query._fields.split(",");

            for (var i = 0; i < fields.length; ++i) {
                uGrpByResults[fields[i]] = [];

                if (i) {
                    queryParamsObj.query += " UNION ";
                }
                queryParamsObj.query +=
                    " SELECT IFNULL(CONCAT(?,?,??),?) as ugroupby, count(*) as _count from ?? GROUP BY ?? ";
                queryParamsObj.params.push(fields[i]);
                queryParamsObj.params.push("~");
                queryParamsObj.params.push(fields[i]);
                queryParamsObj.params.push(fields[i] + "~");
                queryParamsObj.params.push(req.app.locals._tableName);
                queryParamsObj.params.push(fields[i]);
            }

            //console.log(queryParamsObj.query, queryParamsObj.params);
            var results = await this.mysql.exec(
                queryParamsObj.query,
                queryParamsObj.params
            );

            for (var i = 0; i < results.length; ++i) {
                let grpByColName = results[i]["ugroupby"].split("~")[0];
                let grpByColValue = results[i]["ugroupby"].split("~")[1];

                let obj = {};
                obj[grpByColValue] = results[i]["_count"];

                uGrpByResults[grpByColName].push(obj);
            }

            //记录消息队列或者异步日志query,params
            (async() => { //异步日志记录到消息队列中

            })();

            res.status(200).json(uGrpByResults);
        } else {
            const message = "Missing _fields query params eg: /api/tableName/ugroupby?_fields=column1,column2";
            res.status(400).json({ message });
        }
    }

    async aggregate(req, res) {
        if (req.query && req.query._fields) {
            let tableName = req.app.locals._tableName;
            let query = "select ";
            let params = [];
            let fields = req.query._fields.split(",");

            for (var i = 0; i < fields.length; ++i) {
                if (i) {
                    query = query + ",";
                }
                query =
                    query +
                    " min(??) as ?,max(??) as ?,avg(??) as ?,sum(??) as ?,stddev(??) as ?,variance(??) as ? ";
                params.push(fields[i]);
                params.push("min_of_" + fields[i]);
                params.push(fields[i]);
                params.push("max_of_" + fields[i]);
                params.push(fields[i]);
                params.push("avg_of_" + fields[i]);
                params.push(fields[i]);
                params.push("sum_of_" + fields[i]);
                params.push(fields[i]);
                params.push("stddev_of_" + fields[i]);
                params.push(fields[i]);
                params.push("variance_of_" + fields[i]);
            }

            query = query + " from ??";
            params.push(tableName);

            var results = await this.mysql.exec(query, params);

            //记录消息队列或者异步日志query,params
            (async() => { //异步日志记录到消息队列中

            })();

            res.status(200).json(results);
        } else {
            const message = "Missing _fields in query params eg: /api/tableName/aggregate?_fields=numericColumn1";
            res.status(400).json({ message });
        }
    }

    async chart(req, res) {
        let query = "";
        let params = [];
        let obj = {};

        if (req.query) {
            let isRange = false;
            if (req.query.range) {
                isRange = true;
            }

            if (req.query && req.query.min && req.query.max && req.query.step) {
                //console.log(req.params.min, req.params.max, req.params.step);

                obj = this.mysql.getChartQueryAndParamsFromMinMaxStep(
                    req.app.locals._tableName,
                    req.query._fields,
                    parseInt(req.query.min),
                    parseInt(req.query.max),
                    parseInt(req.query.step),
                    isRange
                );
            } else if (
                req.query &&
                req.query.steparray &&
                req.query.steparray.length > 1
            ) {
                obj = this.mysql.getChartQueryAndParamsFromStepArray(
                    req.app.locals._tableName,
                    req.query._fields,
                    req.query.steparray.split(",").map(Number),
                    isRange
                );
            } else if (
                req.query &&
                req.query.steppair &&
                req.query.steppair.length > 1
            ) {
                obj = this.mysql.getChartQueryAndParamsFromStepPair(
                    req.app.locals._tableName,
                    req.query._fields,
                    req.query.steppair.split(",").map(Number),
                    false
                );
            } else {
                query =
                    "select min(??) as min,max(??) as max,stddev(??) as stddev,avg(??) as avg from ??";
                params = [];

                params.push(req.query._fields);
                params.push(req.query._fields);
                params.push(req.query._fields);
                params.push(req.query._fields);
                params.push(req.app.locals._tableName);

                let _this = this;

                let results = await _this.mysql.exec(query, params);

                //console.log(results, results['max'], req.params);

                obj = _this.mysql.getChartQueryAndParamsFromMinMaxStddev(
                    req.app.locals._tableName,
                    req.query._fields,
                    results[0]["min"],
                    results[0]["max"],
                    results[0]["stddev"],
                    isRange
                );
            }

            this.mysql.getWhereClause(
                req.query._where,
                req.app.locals._tableName,
                obj,
                " where "
            );

            let results = await this.mysql.exec(obj.query, obj.params);

            //记录消息队列或者异步日志query,params
            (async() => { //异步日志记录到消息队列中

            })();

            res.status(200).json(results);
        } else {
            const message = "Missing _fields in query params eg: /api/tableName/chart?_fields=numericColumn1";
            res.status(400).json({ message });
        }
    }

    async autoChart(req, res) {
        let query = "describe ??";
        let params = [req.app.locals._tableName];
        let obj = {};
        let results = [];

        let isRange = false;
        if (req.query.range) {
            isRange = true;
        }

        let describeResults = await this.mysql.exec(query, params);
        console.log(`describe results`, describeResults);

        //记录消息队列或者异步日志query,params
        (async() => { //异步日志记录到MySQL中
            await this.mysql.exec(`INSERT INTO bs_sql_log (id, statement, params) VALUES (?, ?, ?);`, [tools.queryUniqueID(), query, JSON.stringify(params)]);
        })();

        for (var i = 0; i < describeResults.length; ++i) {

            if (
                describeResults[i]["Key"] !== "PRI" &&
                this.mysql.isTypeOfColumnNumber(describeResults[i]["Type"])
            ) {
                query =
                    "select min(??) as min,max(??) as max,stddev(??) as stddev,avg(??) as avg from ??";
                params = [];

                params.push(describeResults[i]["Field"]);
                params.push(describeResults[i]["Field"]);
                params.push(describeResults[i]["Field"]);
                params.push(describeResults[i]["Field"]);
                params.push(req.app.locals._tableName);

                let _this = this;

                let minMaxResults = await _this.mysql.exec(query, params);
                console.log(minMaxResults, minMaxResults['max'], req.params);

                query = "";
                params = [];

                obj = _this.mysql.getChartQueryAndParamsFromMinMaxStddev(
                    req.app.locals._tableName,
                    describeResults[i]["Field"],
                    minMaxResults[0]["min"],
                    minMaxResults[0]["max"],
                    minMaxResults[0]["stddev"],
                    isRange
                );

                let r = await this.mysql.exec(obj.query, obj.params);

                //记录消息队列或者异步日志query,params
                (async() => { //异步日志记录到消息队列中

                })();

                let resultObj = {};
                resultObj["column"] = describeResults[i]["Field"];
                resultObj["chart"] = r;

                results.push(resultObj);
            }
        }

        res.status(200).json(results);
    }
}

//expose class
module.exports = xctrl;