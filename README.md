# Xsql : MySQL数据库的RestAPI服务器

## Why this ?

- 1. 快速生成MySQL数据库的RestAPI
- 2. MySQL数据库的所有表可以全量和增量同步至本地sqlite数据库，sqlite可以根据主数据库的规模选择分片。
- 3. 本地sqlite通过定时同步，或者解析MySQL—binlog数据库，保持与主数据库数据一致；同时会循环查询数据，检查不一致的数据，并将数据持久化到本地sqlite中。
- 4. XSQL服务，通过Nacos注册，可以实现了微服务架构，同时可以启动多个实例，每个实例都维护一份sqlite分片，查询RestAPI如果命中本地sqlite则不需要查询主数据库，同时通过微服务架构，xsql可以同时启动N个服务，能同时承受百万级/千万级/亿级数据量，和百万级以上并发。
- 5. 本地sqlite可以自定义分片规则，比如按hash,ID,日期，地域等进行分片，保证百万级以上数据量，通过分片方式开始查询到数据。
- 6. 除本地sqlite，还有将每个同步至本地数据库的表的数据（需提前配置表名称，需要分词的字段），进行分词，分词数组重新排序，然后建立倒排索引。同时提供搜索引擎服务。
- 7. 除本地sqlite以外，为提供ops,所有数据同步持久化为文档数据（非关系性，不提供事务），所有SQL查询，可以解析为特定参数查询函数，查询函数在文档数据中快速查询，由于没有sqlite的制约，在查询特定类型数据时，可能提供更大ops，数据同步通过类似raft协议来保持一致。
- 8. MySQL数据库，可以同时同步在mysql/postgres/oracle/sqlserver，作为一款自动的数据迁移工具。
- 9. MySQL数据库，在同步到sqlite时，会根据MySQL数据库表的信息，自动生成建表语句，但表必须有主键，另外如果表字段为特殊字符串，如database，则生成的DDL可能无法在sqlite中执行。

## Setup and Usage

xmysql requires node >= 10.x

```ts
npm install 
npm run start
```

## Example : Generate REST APIs for [Magento](http://www.magereverse.com/index/magento-sql-structure/version/1-7-0-2)
## Features
* Generates API for **ANY** MySql database :fire::fire:
* Serves APIs irrespective of naming conventions of primary keys, foreign keys, tables etc :fire::fire:
* Support for composite primary keys :fire::fire:
* REST API Usual suspects : CRUD, List, FindOne, Count, Exists, Distinct
* Bulk insert, Bulk delete, Bulk read :fire:   
* Relations
* Pagination 
* Sorting
* Column filtering - Fields :fire:  
* Row filtering - Where :fire:
* Aggregate functions
* Group By, Having (as query params) :fire::fire:  
* Group By, Having (as a separate API) :fire::fire:  
* Multiple group by in one API :fire::fire::fire::fire:
* Chart API for numeric column :fire::fire::fire::fire::fire::fire:
* Auto Chart API - (a gift for lazy while prototyping) :fire::fire::fire::fire::fire::fire:
* [XJOIN - (Supports any number of JOINS)](#xjoin) :fire::fire::fire::fire::fire::fire::fire::fire::fire:
* Supports views  
* Prototyping (features available when using local MySql server only)
    * Run dynamic queries :fire::fire::fire:
    * Upload single file
    * Upload multiple files
    * Download file
* Health and version apis
* Use more than one CPU Cores
* [Docker support](#docker) and [Nginx reverse proxy config](#nginx-reverse-proxy-config-with-docker) :fire::fire::fire: - Thanks to [@markuman](https://github.com/markuman)  
* AWS Lambda Example - Thanks to [@bertyhell](https://github.com/bertyhell) :fire::fire::fire:

1. 自动生成建表语句 xdata-xmysql-service sqlite3。 √
2. 查询数据，使用sqlite作为缓存，先查询sqlite，如果sqlite存在，则直接返回。 ×
3. 新增RestAPI，返回sqlite存在哪些表，表数据长度 和 主数据库表数据长度 ，一致标识。× 
4. 每张表新建一个sqlite数据库 [database].[tablename].sqlite.db，主要是为了避免并发写入时，sqlite可能锁库。√
5. 添加分布式锁，避免并发写入问题。√
6. Nedb作为持久化备用方案。×
7. 建立分布式事务机制。×
8. 使用alasql作为sql内存查询方案。×
9. 编写定时任务，定期执行数据库同步操作。√
10. 所有的增删改操作需要添加 表名称 + IP + 操作类型 锁。×
11. 所有操作如果显示服务器忙（未获取到锁），则需要提示服务器忙。×
12. 所有查询操作通过本地sqlite，或者本地Nedb，或者本地alasql返回，如果本地没有，则查询主/从数据库。×
13. 定时检测本地sqlite 与 远程 mysql 数据库表 长度 是否一致，以及抽样调查最近一段时间数据是否一致，如果一致，则设置此表为一致，查询请求，可以先由本地一致标识的数据库返回数据。×
14. 本地sqlite定期执行bin_log解析SQL，保证一致性，如果需要新增数据，直接新增，如果遇到修改数据，则查询主数据库数据，在将主数据库数据更新到本地，如果遇到删除，查询主数据库数据，如果主数据库数据此数据不存在，则删除本地sqlite对应数据。×
15. 初始化同步时，应该10000条的多批次查询，按批次将数据刷入到sqlite中，如果不这样数据量大于100000级，数据时查询不出来的，而且也难以同时就数据持久化到sqlite中。×
