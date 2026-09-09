import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import SQL from 'sql-template-strings'
import yargs from 'yargs';

import { initAuth } from './auth.js';
import { router as calendars } from './calendars.js';
import { router as notes } from './notes.js';
import { pgdb } from './pgdb.js';
import { router as pages, renderPage } from './pages.js';
import { router as proposals, ProposalsDB } from './proposals.js';
import { router as questions, markdownConverter } from './questions.js';
import { router as tags } from './tags.js';
import { initTemplates, renderTemplate } from './templates.js';
import { localJsonDates } from './time.js';
import { router as venues, VenuesDB } from './venues.js';

const args = yargs.option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
}).argv;
    
initTemplates('./templates');

const app = express();
app.use(compression());
app.use(cors({ origin: process.env.API_ORIGIN }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(renderPage);

app.use(localJsonDates);

initAuth(app);

app.get('/menu', async (req, res) => {
    const proposalsDB = new ProposalsDB(req);
    const venuesDB = new VenuesDB(req);
    const proposals = await proposalsDB.list({ active: true, userid: req.auth?.u });
    const venues = await venuesDB.list({ active: true, userid: req.auth?.u });
    renderTemplate({ template: 'menu', proposals, venues })(req, res);
});

app.use('/calendars', calendars);
app.use('/notes', notes);
app.use('/pages', pages);
app.use('/proposals', proposals);
app.use('/questions', questions);
app.use('/tags', tags);
app.use('/venues', venues);

app.use(express.json());

app.get('/testdb', async (req, res) => {
    const result = await pgdb.query(SQL`select 1 as id`);
    res.set('Content-Type', 'text/plain');
    res.send(Buffer.from(JSON.stringify(result.rows[0], null, 2)));
});

app.post('/render-markdown', (req, res) => res.json({
    html: markdownConverter.makeHtml(req.body.markdown || '')
}));

app.get('/:template', renderTemplate());

app.get('/', renderTemplate());

app.listen(8080);
