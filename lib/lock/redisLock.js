const config = require('../../bin/config/config');
const redisConfig = config().redis;
const lockConfig = config().redislock;
const client = require('redis').createClient(redisConfig.port, redisConfig.host, redisConfig);
const redislock = require('redislock');
const lock = redislock.createLock(client, lockConfig);

const LockAcquisitionError = redislock.LockAcquisitionError;
const LockReleaseError = redislock.LockReleaseError;

function lockExec(lockname = 'app:feature:lock', callback) {
    lock.acquire(lockname).then(function() {
        callback();
        return lock.release();
    }).then(function() {
        console.log(lockname, ' lock release ... ');
    }).catch(LockAcquisitionError, function(err) {
        console.error(lockname, ' lock acquire error : ', err);
    }).catch(LockReleaseError, function(err) {
        console.error(lockname, ' lock release error : ', err);
    });
}

function getLockInstance() {
    return lock;
}

function getLockError() {
    return { LockAcquisitionError, LockReleaseError }
}

const redisLockExports = {
    lockExec,
    getLockInstance,
    getLockError,
}

module.exports = redisLockExports;