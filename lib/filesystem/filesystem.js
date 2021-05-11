const os = require('os');
const fs = require('fs');

/**
 * 创建指定路径文件
 * @param {*} path 
 * @param {*} buffer 
 * @param {*} callback 
 */
const writeFile = (path, buffer, callback = (e) => { console.log(e) }) => {
    let lastPath = path.substring(0, path.lastIndexOf("/"));
    fs.mkdir(lastPath, { recursive: true }, (err) => {
        if (err) return callback(err);
        fs.writeFile(path, buffer, function(err) {
            if (err) return callback(err);
            return callback(null);
        });
    });
}

/** 
 * 判断文件是否存在的函数 
 * @param {*} path, 文件路径
 */
const isFileExisted = (path) => {
    return new Promise((resolve, reject) => {
        fs.access(path, (err) => {
            if (err) {
                resolve(false); //"不存在"
            } else {
                resolve(true); //"存在"
            }
        })
    });
};


const filesystemExports = {
    writeFile,
    isFileExisted,
}

module.exports = filesystemExports;