import express from 'express';
import SQL from 'sql-template-strings'
import { logged, pgdb } from './pgdb.js';
import { renderTemplate } from './templates.js';
import { tmplJsonFields } from './time.js';

export class TagsDB {
    constructor(req) {
        this.logged = logged(req);
    }
    async list(q) {
        const query = SQL`select * from tags t`;
        query.append(` where 1=1`);
        if ('active' in q) query.append(SQL` and t.active`);
        if ('level' in q) {
            if (q.level > 10) query.append(SQL` and t.is_visible_to_public`)
        }
        query.append(` order by active desc, name`);
        const result = await pgdb.query(query);
        return result.rows;
    }
    async get(id) {
        const result = await pgdb.query(SQL`select * from tags where id = ${id}`);
        return result.rows[0];
    }
    async add(q) {
        return await this.logged.add('tags', q, SQL`insert into tags (name, emoji, description, is_visible_to_public, created_by_userid) values (${q.name || ''}, ${q.emoji || ''}, ${q.description || ''}, ${!!q.is_visible_to_public}, ${q.created_by_userid}) returning *`);
    }
    async update(id, q) {
        const parts = [];
        if ('active' in q) parts.push(SQL`active=${!!q.active}`);
        if ('name' in q) parts.push(SQL`name=${q.name || ''}`);
        if ('emoji' in q) parts.push(SQL`emoji=${q.emoji || ''}`);
        if ('description' in q) parts.push(SQL`description=${q.description || ''}`);
        if ('is_visible_to_public' in q) parts.push(SQL`is_visible_to_public=${!!q.is_visible_to_public}`);
        if (!parts.length) return null;
        const [first, ...rest] = parts;
        const query = SQL`update tags set `;
        query.append(first);
        for (const part of rest) {
            query.append(', ');
            query.append(part);
        }
        query.append(` returning *`);
        return await this.logged.update('tags', id, q, query);
    }
    async listLinked(contextType, recordid, q) {
        const query = SQL`select t.*, `;
        query.append(`l.${contextType}id from tags t join tags_${contextType}s l on t.id = l.tagid where l.${contextType}id is not null`);
        if (recordid) {
            query.append(` and l.${contextType}id`);
            query.append(SQL` = ${recordid}`);
        }
        if ('active' in q) query.append(SQL` and t.active = ${![false, 'false'].includes(q.active)}`);
        if ('level' in q) {
            if (q.level > 10) query.append(SQL` and t.is_visible_to_public`)
        }
        query.append(` order by active desc, name`);
        const result = await pgdb.query(query);
        return result.rows;
    }
    async link(id, contextType, recordid) {
        const query = SQL`insert into `;
        query.append(`tags_${contextType}s (tagid, ${contextType}id) values `);
        query.append(SQL`(${id}, ${recordid})`);
        await this.logged.add(`tags_${contextType}s`, { tagid: id, [contextType+'id']: recordid }, query);
    }
    async unlink(id, contextType, recordid) {
        const query = SQL`delete from `;
        query.append(`tags_${contextType}s where ${contextType}id `);
        query.append(SQL`= ${recordid} and tagid = ${id}`);
        await this.logged.delete(`tags_${contextType}s`, [id, recordid], query, { tagid: id, [contextType+'id']: recordid});
    }
};

export const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
    const tagsDB = new TagsDB(req);
    const q = { ...req.query, level: req.auth.l };
    const tags = await tagsDB.list(q);
    if (req.headers.accept?.includes('application/json')) return res.json({ tags });
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    return renderTemplate(tmplJsonFields({ template: 'tags', tags }))(req, res);
});

router.post('/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const tagsDB = new TagsDB(req);
        const tag = await tagsDB.add({ ...req.body, created_by_userid: req.auth.u });
        return res.json(tag);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const tagsDB = new TagsDB(req);
        const tag = await tagsDB.update(req.params.id, req.body);
        return res.json(tag);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.get('/:contextType/', async (req, res) => {
    const tbl = req.params.contextType;
    if (!['proposal', 'show', 'user', 'venue'].includes(tbl)) return res.status(400).send('Bad Request');
    const q = { ...req.query, level: req.auth.l, active: true };
    const tagsDB = new TagsDB(req);
    const tags = await tagsDB.listLinked(tbl, null, q);
    return res.json({ tags });
});

router.get('/:contextType/:recordid', async (req, res) => {
    const tbl = req.params.contextType;
    if (!['proposal', 'show', 'user', 'venue'].includes(tbl)) return res.status(400).send('Bad Request');
    const q = { ...req.query, level: req.auth.l, active: true };
    const tagsDB = new TagsDB(req);
    const tags = await tagsDB.listLinked(tbl, req.params.recordid, q);
    return res.json({ tags });
});

router.put('/:id/:contextType/:recordid', async(req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const tbl = req.params.contextType;
        if (!['proposal', 'show', 'user', 'venue'].includes(tbl)) return res.status(400).send('Bad Request');
        const tagsDB = new TagsDB(req);
        await tagsDB.link(req.params.id, tbl, req.params.recordid);
        return res.status(204).send();
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});


router.delete('/:id/:contextType/:recordid', async(req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const tbl = req.params.contextType;
        if (!['proposal', 'show', 'user', 'venue'].includes(tbl)) return res.status(400).send('Bad Request');
        const tagsDB = new TagsDB(req);
        await tagsDB.unlink(req.params.id, tbl, req.params.recordid);
        return res.status(204).send();
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});
