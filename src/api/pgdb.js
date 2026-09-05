import express from 'express';
import bcrypt from 'bcrypt';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { TZDate } from "@date-fns/tz";
import { promises as fsp } from 'fs';
import path from 'path';
import pg from 'pg';
import SQL from 'sql-template-strings'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const pgdb = new pg.Pool({
    host: 'refringe-pg',
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD
});

const logDB = open({
    filename: path.join('/app-logs', 'refringe-logs.sqlite'),
    driver: sqlite3.Database,
});

logDB.then(logdb => logdb.run(`
  create table if not exists events (
    id integer primary key,
    op text,
    tblid text,
    tbl text,
    sql text,
    context jsonb
  )
`));

pgdb.logEvent = async (op, context, tbl=null, sql=null, id=null) => {
    const jsonContext = JSON.stringify(context, null, 2);
    console.log(`${op} ${tbl}\n${jsonContext}\n`);
    (await logDB).run(SQL`insert into events (op, tblid, tbl, sql, context) values (${op}, ${id}, ${tbl}, ${sql?.text}, ${jsonContext})`);
};

pgdb.add = async (tbl, context, q) => {
    await pgdb.logEvent('I', context, tbl, q);
    const result = await pgdb.query(q);
    return result.rows[0];
};

pgdb.update = async (tbl, id, context, q) => {
    await pgdb.logEvent('U', { ...context, id }, tbl, q, id);
    const result = await pgdb.query(q);
    return result.rows[0];
};

pgdb.upsert = async (tbl, context, q) => {
    await pgdb.logEvent('P', context, tbl, q);
    const result = await pgdb.query(q);
    return result.rows[0];
};

pgdb.delete = async (tbl, id, q, context) => {
    if (!context && id && !Array.isArray(id)) {
        const query = SQL`select *`;
        query.append(` from ${tbl}`);
        query.append(SQL` where id=${id}`);
        context = await pgdb.query(query);
    }
    await pgdb.logEvent('D', context ?? { id }, tbl, q, id);
    if (q) await pgdb.query(q);
};

for (const tbl of ['migrations', 'seeds']) {
    const result = await pgdb.query('select name from ' + tbl);
    const scripts = new Set(result.rows.map(r => r.name));
    const dir = await fsp.readdir('./' + tbl);
    dir.sort();
    for (const fn of dir) {
        if (scripts.has(fn)) continue;
        console.log(tbl, ':', fn);
        const txt = await fsp.readFile(path.join('./' + tbl, fn), { encoding: 'utf-8' });
        await pgdb.query(txt);
        await pgdb.query(`insert into ${tbl} (name) values ('${fn}');`);
    }
}
