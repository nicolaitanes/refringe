import express from 'express';
import multer from 'multer';
import showdown from 'showdown';
import SQL from 'sql-template-strings'
import { logged, powerless, pgdb } from './pgdb.js';
import { renderTemplate } from './templates.js';
import { tmplJsonFields } from './time.js';

const markdownConverter = new showdown.Converter({
    simplifiedAutoLink: true,
    literalMidWordUnderscores: true,
    simpleLineBreaks: true,
});
const upload = multer();

export class PagesDB {
    constructor(req) {
        this.logged = req ? logged(req) : powerless;
    }
    async list(q) {
        const query = SQL`select p.* from pages p where 1=1`;
        if (q.active) query.append(SQL` and p.active = true`);
        query.append(SQL` order by p.urlpath`);
        const result = await pgdb.query(query);
        return result.rows;
    }
    async get(urlpath) {
        const result = await pgdb.query(SQL`select * from pages where urlpath = ${urlpath} and active limit 1`);
        return result.rows[0];
    }
    async add(q) {
        return await this.logged.add('pages', q, SQL`insert into pages (urlpath, content) values (${q.urlpath}, ${q.content}) returning *`);
    }
    async update(id, q) {
        return await this.logged.update('pages', id, q, SQL`update pages set
            active = ${q.active && q.active !== 'false'},
            urlpath = ${q.urlpath.trim()},
            content = ${q.content}
          where id=${id}`
        );
    }
};

export const pages = new Map();
const pageExpiry = 30_000;

export const flushPage = path => pages.delete(path);
export const getPage = async (path) => {
    let entry = pages.get(path);
    if (entry && (new Date().getTime() - entry.timestamp) < pageExpiry) {
        return entry.content;
    }
    const pagesDB = new PagesDB();
    entry = { timestamp: new Date().getTime() };
    if (path === '_list') {
        entry.content = await pagesDB.list({ active: true });
    } else {
        const page = await pagesDB.get(path);
        if (!page) return null;
        entry.content = page.content;
    }
    pages.set(path, entry);
    return entry.content;
};

export const renderPage = async (req, res) => {
    const paths = await getPage('_list');
    if (!paths.find(p => p.urlpath === req.path)) return req.next();
    const [header, footer, opengraph, raw] = await Promise.all(['(header)', '(footer)', '(opengraph)', req.path].map(getPage));
    const content = markdownConverter.makeHtml(raw);
    return renderTemplate({ template: 'page', header, footer, opengraph, content })(req, res);
};

export const router = express.Router();
router.use(express.json());
router.use(upload.none());

router.get('/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const pagesDB = new PagesDB(req);
    const pages = await pagesDB.list({
        active: 'active' in req.query ? req.query.active !== 'false' : undefined
    });
    if (req.headers.accept?.includes('application/json')) {
        return res.json({ pages });
    }
    return renderTemplate(tmplJsonFields({ template: 'pages', pages }))(req, res);
});

router.post('/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    if (!req.body.urlpath) return res.status(400).send('Bad Request');
    const pagesDB = new PagesDB(req);
    try {
        const newPage = await pagesDB.add({
            urlpath: '' + req.body.urlpath,
            content: '' + (req.body.content || '')
        });
        flushPage(newPage.urlpath);
        return res.json(newPage);
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});

router.put('/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    if (!req.body.urlpath) return res.status(400).send('Bad Request');
    const pagesDB = new PagesDB(req);
    try {
        const page = {
            active: !!req.body.active,
            urlpath: '' + req.body.urlpath,
            content: '' + (req.body.content || '')
        };
        await pagesDB.update(req.params.id, page);
        flushPage(page.urlpath);
        return res.json(page);
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});

router.post('/preview', async (req, res) => {
    const content = markdownConverter.makeHtml(req.body.content);
    if (req.headers.accept?.includes('application/json')) {
        return res.json({ content });
    }
    const [header, footer, siteName] = await Promise.all(['(header)', '(footer)', '(site-name)'].map(getPage));
    return renderTemplate({ template: 'page', header, footer, siteName, content, title: req.body.title })(req, res);
});
