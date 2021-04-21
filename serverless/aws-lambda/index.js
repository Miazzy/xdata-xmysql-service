"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bodyParser = require("body-parser");
var express = require("express");
var serverless = require("serverless-http");
var cors = require("cors");
var mysql = require("mysql");
var Xapi = require("xmysql/lib/xapi.js");
var morgan = require("morgan");
var app = express();

var onXapiInitialized = new Promise(function(resolve, reject) {
    try {
        // /**************** START : setup express ****************/
        app.use(morgan("tiny"));
        app.use(cors());
        app.use(bodyParser.json());
        app.use(
            bodyParser.urlencoded({
                extended: true
            })
        );
        // /**************** END : setup express ****************/

        app.use(function(req, res, next) {
            // You can add authentication here
            console.log("Received request for: " + req.url, req);
            next();
        });

        var mysqlConfig = {
            host: config.mysql.host,
            port: 3306,
            database: config.mysql.database,
            user: config.mysql.user,
            password: config.mysql.password,
            apiPrefix: "/",
            ipAddress: "localhost",
            portNumber: 3000,
            ignoreTables: [],
            storageFolder: __dirname
        };

        var mysqlPool = mysql.createPool(mysqlConfig);
        var xapi = new Xapi(mysqlConfig, mysqlPool, app);
        xapi.init(function(err, results) {
            app.listen(3000);
            resolve();
        });
    } catch (err) {
        reject(err);
    }
});

function handler(event, context, callback) {
    onXapiInitialized.then(function() {
        serverless(app)(event, context, callback);
    });
}

exports.handler = handler;