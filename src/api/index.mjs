import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { randomUUID } from "crypto";
import { TZDate } from "@date-fns/tz";
import { promises as fsp } from 'fs';
import Handlebars from 'handlebars';
import multer from 'multer';
import path from 'path';
import pg from 'pg';
import SQL from 'sql-template-strings'
import yargs from 'yargs';

const args = yargs.option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
}).option('origin', {
    alias: 'o',
    default: 'https://friendsofthefield303.com',
    type: 'string',
    description: 'Base URL path'
}).argv;

const templates = {};
const templateDir = await fsp.readdir('./templates');
for (const fn of templateDir) {
    const { name } = /^(?<name>.*).html$/.exec(fn)?.groups ?? {};
    if (!name) continue;
    const txt = await fsp.readFile(path.join('./templates', fn), { encoding: 'utf-8' });
    templates[name] = Handlebars.compile(txt);
    Handlebars.registerPartial(name, templates[name]);
}

const pgdb = new pg.Pool({
    host: 'refringe-pg',
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD
});

const app = express();
app.use(compression());
app.use(cors({ origin: args.origin }));

app.get('/testdb', async (req, res) => {
    const result = await pgdb.query(SQL`select 1 as id`);
    res.set('Content-Type', 'text/plain');
    res.send(Buffer.from(JSON.stringify(result.rows[0], null, 2)));
});

const renderTemplate = (req, res) => {
    let template = templates[req.params.template || 'index'];
    const status = template ? 200 : 404;
    template ??= templates['404'];
    const context = { path: req.params.template }; // TODO
    const html = template(context);
    res.set('Content-Type', 'text/html');
    res.send(Buffer.from(html));
};

app.get('/:template', renderTemplate);
app.get('/', renderTemplate);

app.listen(8080);
