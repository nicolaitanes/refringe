import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import SQL from 'sql-template-strings'
import yargs from 'yargs';

import { initAuth } from './auth.js';
import { initTemplates, renderTemplate } from './templates.js';
import { pgdb } from './pgdb.js';
import { getPage, router as pages, renderPage } from './pages.js';
import { router as proposals, proposalsDB } from './proposals.js';
import { router as questions } from './questions.js';
import { usersDB } from './users.js';
import { router as venues, venuesDB } from './venues.js';

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

initTemplates('./templates');

const app = express();
app.use(compression());
app.use(cors({ origin: args.origin }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(renderPage);

initAuth(app);

app.get('/menu', async (req, res) => {
    const proposals = await proposalsDB.list({ active: true, userid: req.auth?.u });
    const venues = await venuesDB.list({ active: true, userid: req.auth?.u });
    renderTemplate({ template: 'menu', proposals, venues })(req, res);
});

app.use('/pages', pages);
app.use('/proposals', proposals);
app.use('/questions', questions);
app.use('/venues', venues);

app.use(express.json());

app.get('/testdb', async (req, res) => {
    const result = await pgdb.query(SQL`select 1 as id`);
    res.set('Content-Type', 'text/plain');
    res.send(Buffer.from(JSON.stringify(result.rows[0], null, 2)));
});

app.get('/:template', async (req, res) => {
    const siteName = await getPage('(site-name)');
    return renderTemplate({ siteName })(req, res);
});

app.get('/', renderTemplate());

app.listen(8080);
