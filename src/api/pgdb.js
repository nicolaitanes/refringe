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

export const pgdb = new pg.Pool({
    host: 'refringe-pg',
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD
});

pgdb.logEvent = async (op, context, tbl=null) => {
    // TODO persist for rehydration
    console.log(`${op} ${tbl}\n${JSON.stringify(context, null, 2)}\n`);
};

pgdb.add = async (tbl, context, q) => {
    await pgdb.logEvent('I',  context, tbl);
    const result = await pgdb.query(q);
    return result.rows[0];
};

pgdb.update = async (tbl, id, context, q) => {
    await pgdb.logEvent('U', { ...context, id }, tbl);
    const result = await pgdb.query(q);
    return result.rows[0];
};

pgdb.upsert = async (tbl, context, q) => {
    await pgdb.logEvent('P', { ...context, id }, tbl);
    const result = await pgdb.query(q);
    return result.rows[0];
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
