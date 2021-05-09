const config = require('../../bin/config/config');
const redisConfig = config().redis;
const lockConfig = config().redislock;
const client = require('redis').createClient(redisConfig.port, redisConfig.host, redisConfig);
const redislock = require('redislock');
const lock = redislock.createLock(client, lockConfig);

const LockAcquisitionError = redislock.LockAcquisitionError;
const LockReleaseError = redislock.LockReleaseError;

function lockExec(lockname = 'app:feature:lock', callback) {
    lock.acquire(lockname).then(async() => {
        await callback();
        return lock.release();
    }).then(function() {
        console.log(lockname, ' lock release ... ');
    }).catch(LockAcquisitionError, function(err) {
        console.error(lockname, ' lock acquire error : ', err);
    }).catch(LockReleaseError, function(err) {
        console.error(lockname, ' lock release error : ', err);
    });
}

function lockExecs(lockname = 'app:feature:lock', callback) {
    const lockTemp = redislock.createLock(client, lockConfig);
    lockTemp.acquire(lockname).then(async() => {
        await callback();
        return lockTemp.release();
    }).then(function() {
        console.log(lockname, ' lock execs release ... ');
    }).catch(LockAcquisitionError, function(err) {
        console.error(lockname, ' lock execs acquire error : ', err);
    }).catch(LockReleaseError, function(err) {
        console.error(lockname, ' lock execs release error : ', err);
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
    lockExecs,
    getLockInstance,
    getLockError,
}

module.exports = redisLockExports;