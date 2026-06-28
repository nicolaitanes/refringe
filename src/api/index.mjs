import express from 'express';
import bcrypt from 'bcrypt';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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
    default: 'https://refringe.mandelics.com',
    type: 'string',
    description: 'Base URL path'
}).argv;

const noauthAllowList = new Set([
    '/',
    '/auth',
    '/index',
    '/login',
    '/logout',
    '/setup',
    '/welcome'
]);
const saltRounds = 10;

const templates = {};
const templateDir = await fsp.readdir('./templates');
for (const fn of templateDir) {
    const { name } = /^(?<name>.*).html$/.exec(fn)?.groups ?? {};
    if (!name) continue;
    const txt = await fsp.readFile(path.join('./templates', fn), { encoding: 'utf-8' });
    templates[name] = Handlebars.compile(txt);
    Handlebars.registerPartial(name, templates[name]);
}

const renderTemplate = (req, res) => {
    let template = templates[req.params.template || 'index'];
    const status = template ? 200 : 404;
    template ??= templates['404'];
    const context = { path: req.params.template, auth: req.auth }; // TODO
    const html = template(context);
    res.set('Content-Type', 'text/html');
    res.send(Buffer.from(html));
};

const pgdb = new pg.Pool({
    host: 'refringe-pg',
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD
});

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

const usersDB = {
    async getByID(id) {
        const userResult = await pgdb.query(SQL`select * from users where id=${id} and active=true limit 1`);
        return userResult.rows[0];
    },
    async getByName(username, password) {
        const userResult = await pgdb.query(SQL`select * from users where username=${username} and active=true limit 1`);
        const user = userResult.rows[0];
        if (!user?.id) return null;
        if (! await bcrypt.compare(password, user.passhash)) return null;
        return user;
    },
    async count() {
        const usersResult = await pgdb.query('select count(1) as n from users');
        return +usersResult.rows[0].n;
    },
    async create(userdata, hats=[]) {
        const passhash = await bcrypt.hash(userdata.password, saltRounds);
        const userResult = await pgdb.query(SQL`insert into users
            (username, passhash, fullname)
            values (${userdata.username}, ${passhash}, ${userdata.fullname})
            returning *`);
        const user = userResult.rows[0];
        if (!user) return null;
        for (const hat of hats) {
            await pgdb.query(SQL`insert into userhats (userid, hatid) values (${user.id}, (select id from hats where hatname = ${hat}))`);
        }
        return user;
    },    
    async revokeOtherDevices(id) {
        const result = await pgdb.query(SQL`update users set revocation = revocation + 1 where id=${id} returning revocation`);
        return result.rows[0].revocation;
    }
};

// TODO more table-specific helpers

// TODO cache recently seen user details e.g. hat membership

const app = express();
app.use(compression());
app.use(cors({ origin: args.origin }));
app.use(cookieParser(process.env.COOKIE_SECRET));

const upload = multer();

const issueCookie = (req, res, body) => {
    const auth = {
        ...body,
        d: new Date().getTime()
    };
    const cookie = JSON.stringify(auth);
    res.cookie('rfa', cookie, { signed: true });
    req.auth = auth;
    return auth;
};

app.use(async (req, res) => {
    if (noauthAllowList.has(req.path)) return req.next();
    
    const cookie = req.signedCookies.rfa;
    if (cookie) {
        try {
            const auth = JSON.parse(cookie);
            if (!auth?.u) return res.redirect(303, '/');
            
            // TODO check user in cache, grab hats etc.
            req.auth = auth;
            if (!auth?.d || (auth.d + 5 * 60 * 1000) < new Date().getTime()) {
                try {
                    const user = await usersDB.getByID(auth.u);
                    if (!user || user.revocation > auth.r) return res.redirect(303, '/logout');
                    req.auth = issueCookie(req, res, auth);
                } catch (err) {
                    console.log(err);
                }
            }
            // TODO re-cache user details (hats?) 
            return req.next();
        } catch (err) {
            console.log(err);
        }
    }
    
    res.redirect(303, '/');
});

app.post('/auth', upload.none(), async (req, res) => {
    const user = await usersDB.getByName(req.body.username, req.body.password);
    if (!user) return res.redirect(303, '/login');
    
    issueCookie(req, res, {
        u: user.id,
        n: user.username,
        r: user.revocation
    });
    res.redirect(303, '/menu');
});

app.post('/revoke', async (req, res) => {
    req.auth.r = await usersDB.revokeOtherDevices(req.auth.u);
    issueCookie(req, res, req.auth);
    res.redirect(303, '/menu');
});

app.get('/logout', (req, res) => {
    issueCookie(req, res, {});
    res.redirect(303, '/');
});

// TODO update revocation on user password change

app.get('/welcome', async (req, res) => {
    if (await usersDB.count()) return res.redirect(303, '/login');
    req.params.template = 'welcome';
    return renderTemplate(req, res);
});

app.post('/setup', upload.none(), async (req, res) => {
    if (await usersDB.count()) return res.redirect(303, '/login');
    const user = await usersDB.create({
        username: req.body.username,
        password: req.body.password,
        fullname: 'Admin'
    }, ['Admin']);
    if (!user) return res.redirect(303, '/login');

    req.auth = issueCookie(req, res, {
        u: user.id,
        n: user.username,
        r: user.revocation
    });
    res.redirect(303, '/menu');
});

app.use(express.json());

app.get('/testdb', async (req, res) => {
    const result = await pgdb.query(SQL`select 1 as id`);
    res.set('Content-Type', 'text/plain');
    res.send(Buffer.from(JSON.stringify(result.rows[0], null, 2)));
});

app.get('/menu', (req, res) => {
    if (!req.auth?.u) res.redirect(303, '/');
    req.params.template = 'menu';
    return renderTemplate(req, res);
});

app.get('/:template', renderTemplate);
app.get('/', renderTemplate);

app.listen(8080);
