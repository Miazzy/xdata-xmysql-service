"use strict";

const RedisClustr = require('redis-clustr');
const config = require('../../bin/config/config');
const redis = new RedisClustr(config().redisclustr);

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

const cacheExports = {
    getValue,
    setValue,
}

module.exports = cacheExports;