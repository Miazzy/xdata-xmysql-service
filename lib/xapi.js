"use strict";

const protect = require('@risingstack/protect');
var Xsql = require("./xsql.js");
var Xctrl = require("./xctrl.js");
var multer = require("multer");
const path = require("path");
const v8 = require("v8");
const os = require("os");
const { tools } = require('./tools/tools.js');

//防SQL注入中间件
const injMiddleware = protect.express.sqlInjection({ body: true, loggerFunction: console.error });

/**
 * @description xdata-xmysql-service 
 * @classdesc RestAPI路由器
 * @author xmysql
 */
class Xapi {

    //构造函数
    constructor(args, mysqlPool, app, sqliteDB, memoryDB, sqliteDBMap) {
        this.config = args;
        this.mysql = new Xsql(args, mysqlPool, sqliteDB, memoryDB, sqliteDBMap);
        this.app = app;
        this.ctrls = [];
        this.sqliteDB = sqliteDB;
        this.memoryDB = memoryDB;
        this.sqliteDBMap = sqliteDBMap;

        /**************** START : multer ****************/
        this.storage = multer.diskStorage({
            destination: function(req, file, cb) {
                cb(null, process.cwd());
            },
            filename: function(req, file, cb) { // console.log(file);
                const extname = path.extname(file.originalname);
                cb(null, tools.queryUniqueID() + '@' + tools.getIpAddress() + '@' + extname);
            }
        });
        this.upload = multer({ storage: this.storage });
        /**************** END : multer ****************/
    }

    getXSQL() {
        return this.mysql;
    }

    getSQLiteDB() {
        return this.sqliteDB;
    }

    getMemoryDB() {
        return this.memoryDB;
    }

    getSQLiteDBMap() {
        return this.sqliteDBMap;
    }

    init(cbk) {
        this.mysql.init((err, results) => {
            this.app.use(this.urlMiddleware.bind(this));
            let stat = this.setupRoutes();
            this.app.use(this.errorMiddleware.bind(this));
            cbk(err, stat);
        });
    }

    urlMiddleware(req, res, next) {
        // get only request url from originalUrl
        let justUrl = req.originalUrl.split("?")[0];
        let pathSplit = [];

        // split by apiPrefix
        let apiSuffix = justUrl.split(this.config.apiPrefix);

        if (apiSuffix.length === 2) {
            // split by /
            pathSplit = apiSuffix[1].split("/");
            if (pathSplit.length) {
                if (pathSplit.length >= 3) {
                    // handle for relational routes
                    req.app.locals._parentTable = pathSplit[0];
                    req.app.locals._childTable = pathSplit[2];
                } else {
                    // handles rest of routes
                    req.app.locals._tableName = pathSplit[0];
                }
            }
        }

        next();
    }

    errorMiddleware(err, req, res, next) {
        if (err && err.code) res.status(400).json({ error: err });
        else if (err && err.message)
            res.status(500).json({ error: "Internal server error : " + err.message });
        else res.status(500).json({ error: "Internal server error : " + err });

        next(err);
    }

    asyncMiddleware(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(err => {
                next(err);
            });
        };
    }

    root(req, res) {
        let routes = [];
        routes = this.mysql.getSchemaRoutes(
            false,
            req.protocol + "://" + req.get("host") + this.config.apiPrefix
        );
        routes = routes.concat(
            this.mysql.globalRoutesPrint(
                req.protocol + "://" + req.get("host") + this.config.apiPrefix
            )
        );
        res.json(routes);
    }

    setupRoutes() {

        const $middleware = this.asyncMiddleware;
        let stat = { tables: 0, apis: 3 };
        const tablePrefix = this.config.apiPrefix + "tables";
        const xjoinPrefix = this.config.apiPrefix + "xjoin";

        // show routes for database schema
        this.app.get("/", $middleware(this.root.bind(this)));
        this.app.route(tablePrefix).get($middleware(this.tables.bind(this)));
        this.app.route(xjoinPrefix).get($middleware(this.xjoin.bind(this)));

        /**************** START : setup routes for each table ****************/
        let resources = [];
        resources = this.mysql.getSchemaRoutes(true, this.config.apiPrefix);
        stat.tables += resources.length;

        // iterate over each resource
        for (var j = 0; j < resources.length; ++j) {

            let resourceCtrl = new Xctrl(this.app, this.mysql, this.sqliteDB, this.memoryDB, this.sqliteDBMap);
            this.ctrls.push(resourceCtrl);

            let routes = resources[j]["routes"];
            stat.apis += resources[j]["routes"].length;

            // iterate over each routes in resource and map function
            for (var i = 0; i < routes.length; ++i) {
                const $router = this.app.route(routes[i]["routeUrl"]);
                switch (routes[i]["routeType"]) {
                    case "list":
                        $router.get($middleware(resourceCtrl.list.bind(resourceCtrl)));
                        break;
                    case "findOne":
                        $router.get($middleware(resourceCtrl.findOne.bind(resourceCtrl)));
                        break;
                    case "create":
                        $router.post($middleware(resourceCtrl.create.bind(resourceCtrl)));
                        break;
                    case "read":
                        $router.get($middleware(resourceCtrl.read.bind(resourceCtrl)));
                        break;
                    case "bulkInsert":
                        $router.post($middleware(resourceCtrl.bulkInsert.bind(resourceCtrl)));
                        break;
                    case "bulkRead":
                        $router.get($middleware(resourceCtrl.bulkRead.bind(resourceCtrl)));
                        break;
                    case "multiInsert":
                        $router.post($middleware(resourceCtrl.multiInsert.bind(resourceCtrl)));
                        break;
                    case "whereDeleteAndInsert":
                        $router.post($middleware(resourceCtrl.whereDeleteAndInsert.bind(resourceCtrl)));
                        break;
                    case "whereDelete":
                        $router.delete($middleware(resourceCtrl.whereDelete.bind(resourceCtrl)));
                        break;
                    case "bulkDelete":
                        $router.delete($middleware(resourceCtrl.bulkDelete.bind(resourceCtrl)));
                        break;
                    case "patch":
                        $router.patch($middleware(resourceCtrl.patch.bind(resourceCtrl)));
                        break;
                    case "update":
                        $router.put($middleware(resourceCtrl.update.bind(resourceCtrl)));
                        break;
                    case "delete":
                        $router.delete($middleware(resourceCtrl.delete.bind(resourceCtrl)));
                        break;
                    case "exists":
                        $router.get($middleware(resourceCtrl.exists.bind(resourceCtrl)));
                        break;
                    case "count":
                        $router.get($middleware(resourceCtrl.count.bind(resourceCtrl)));
                        break;
                    case "distinct":
                        $router.get($middleware(resourceCtrl.distinct.bind(resourceCtrl)));
                        break;
                    case "describe":
                        $router.get($middleware(this.tableDescribe.bind(this)));
                        break;
                    case "relational":
                        $router.get($middleware(resourceCtrl.nestedList.bind(resourceCtrl)));
                        break;
                    case "groupby":
                        $router.get($middleware(resourceCtrl.groupBy.bind(resourceCtrl)));
                        break;
                    case "ugroupby":
                        $router.get($middleware(resourceCtrl.ugroupby.bind(resourceCtrl)));
                        break;
                    case "chart":
                        $router.get($middleware(resourceCtrl.chart.bind(resourceCtrl)));
                        break;
                    case "autoChart":
                        $router.get($middleware(resourceCtrl.autoChart.bind(resourceCtrl)));
                        break;
                    case "aggregate":
                        $router.get($middleware(resourceCtrl.aggregate.bind(resourceCtrl)));
                        break;
                }
            }
        }

        /**************** END : setup routes for each table ****************/

        /**************** START : multer routes ****************/
        this.app.route("/dynamic*").post($middleware(this.runQuery.bind(this)));
        this.app.post("/upload", this.upload.single("file"), this.uploadFile.bind(this));
        this.app.post("/uploads", this.upload.array("files", 10), this.uploadFiles.bind(this));
        this.app.get("/download", this.downloadFile.bind(this));
        /**************** END : multer routes ****************/

        /**************** START : health and version ****************/
        this.app.get("/_health", $middleware(this.health.bind(this)));
        this.app.get("/_version", $middleware(this.version.bind(this)));
        /**************** END : health and version ****************/

        stat.apis += 6;

        console.log(`          Generated: ${stat.apis} REST APIs for ${stat.tables} tables`);
        console.log("          Database              :    %s", this.config.database);
        console.log("          Number of Tables      :    %s", stat.tables);
        console.log("          REST APIs Generated   :    %s", stat.apis);

        return stat;
    }

    async xjoin(req, res) {
        let obj = {};

        obj.query = "";
        obj.params = [];

        this.mysql.prepareJoinQuery(req, res, obj);

        if (obj.query.length) {
            let results = await this.mysql.exec(obj.query, obj.params);
            res.status(200).json(results);
        } else {
            res.status(400).json({ err: "Invalid Xjoin request" });
        }
    }

    async tableDescribe(req, res) {
        let query = "describe ??";
        let params = [req.app.locals._tableName];
        let results = await this.mysql.exec(query, params);
        res.status(200).json(results);
    }

    async tables(req, res) {
        let query = "SELECT table_name AS resource FROM information_schema.tables WHERE table_schema = ? ";
        let params = [this.config.database];
        if (Object.keys(this.config.ignoreTables).length > 0) {
            query += "and table_name not in (?)";
            params.push(Object.keys(this.config.ignoreTables));
        }
        let results = await this.mysql.exec(query, params);
        res.status(200).json(results);
    }

    async runQuery(req, res) {
        let query = req.body.query;
        let params = req.body.params;
        let results = { query, params }; //let results = await this.mysql.exec(query, params);
        res.status(200).json(results);
    }

    /**************** START : files related ****************/

    downloadFile(req, res) {
        let file = path.join(process.cwd(), req.query.name);
        res.download(file);
    }

    uploadFile(req, res) {
        if (req.file) { // console.log(req.file.path);
            res.json({ err: false, success: true, path: req.file.path, name: req.file.path.split('xdata-xmysql-service/')[1] });
        } else {
            res.json({ err: true, success: false, message: "upload failed" });
        }
    }

    uploadFiles(req, res) {
        if (!req.files || req.files.length === 0) {
            res.json({ err: true, success: false, message: "upload failed" });
        } else {
            let files = [];
            for (let i = 0; i < req.files.length; ++i) {
                files.push(req.files[i].path);
            }
            res.json({ err: false, success: true, path: files.toString() });
        }
    }

    /**************** END : files related ****************/

    /**************** START : health and version ****************/

    async getMysqlUptime() {
        let v = await this.mysql.exec("SHOW GLOBAL STATUS LIKE 'Uptime';", []);
        return v[0]["Value"];
    }

    async getMysqlHealth() {
        let v = await this.mysql.exec("SELECT version() as version", []);
        return v[0]["version"];
    }

    async health(req, res) {
        let status = {};

        status["process_uptime"] = process.uptime();
        status["mysql_uptime"] = await this.getMysqlUptime();

        if (Object.keys(req.query).length) {
            status["process_memory_usage"] = process.memoryUsage();
            status["os_total_memory"] = os.totalmem();
            status["os_free_memory"] = os.freemem();
            status["os_load_average"] = os.loadavg();
            status["v8_heap_statistics"] = v8.getHeapStatistics();
        }

        res.json(status);
    }

    async version(req, res) {
        let version = {};
        let uptime = await this.mysql.exec("SHOW GLOBAL STATUS LIKE 'Uptime';", []);
        let mysqlVersion = await this.mysql.exec("SELECT version() as version", []);
        version["xdata-xmysql-service"] = this.app.get("version");
        version["mysql_health"] = await this.getMysqlHealth();
        version["node_info"] = process.versions.node;
        version["mysql_uptime"] = uptime[0]["Value"];
        version["mysql_version"] = mysqlVersion[0]["version"];
        res.json(version);
    }

    /**************** END : health and version ****************/

}

//expose class
module.exports = Xapi;