import express from 'express';
import SQL from 'sql-template-strings'
import { logged, pgdb } from './pgdb.js';
import { renderTemplate } from './templates.js';

export class NotesDB {
    constructor(req) {
        this.logged = logged(req);
    }
    async list(q) {
        const query = SQL`select n.*, proposalid, showid, userid, venueid, u.fullname, uuid_extract_timestamp(n.id) as created
                          from notes n join users u on n.created_by_userid = u.id
                          left join notes_proposals np on np.noteid = n.id
                          left join notes_shows ns on ns.noteid = n.id
                          left join notes_users nu on nu.noteid = n.id
                          left join notes_venues nv on nv.noteid = n.id
                          where 1=1`;
        if (q.proposalid) query.append(SQL` and proposalid = ${q.proposalid}`);
        if (q.showid) query.append(SQL` and showid = ${q.showid}`);
        if (q.userid) query.append(SQL` and userid = ${q.userid}`);
        if (q.venueid) query.append(SQL` and venueid = ${q.venueid}`);
        if ('level' in q) {
            if (q.level > 20) query.append(SQL` and n.is_visible_to_public`)
            else if (q.level > 10) query.append(SQL` and n.is_visible_to_proposers`)
            else query.append(SQL` and n.is_visible_to_organizers`);
        }
        query.append(SQL` order by n.id desc`);
        const result = await pgdb.query(query);
        return result.rows;
    }
    async get(id) {
        const result = await pgdb.query(SQL`select * from notes where id = ${id}`);
        return result.rows[0];
    }
    async add(q) {
        const note = await this.logged.add('notes', q, SQL`insert into notes (content, is_visible_to_organizers, is_visible_to_proposers, is_visible_to_public, created_by_userid) values (${q.content || ''}, ${!!q.is_visible_to_organizers}, ${!!q.is_visible_to_proposers}, ${!!q.is_visible_to_public}, ${q.created_by_userid}) returning *`);
        if (q.proposalid) {
            const link = { noteid: note.id, proposalid: q.proposalid };
            await this.logged.add('notes_proposals', link, SQL`insert into notes_proposals (noteid, proposalid) values (${link.noteid}, ${q.proposalid}) returning *`);
            note.proposalid = q.proposalid;
        } if (q.showid) {
            const link = { noteid: note.id, showid: q.showid };
            await this.logged.add('notes_shows', link, SQL`insert into notes_shows (noteid, showid) values (${link.noteid}, ${q.showid}) returning *`);
            note.showid = q.showid;
        } if (q.userid) {
            const link = { noteid: note.id, userid: q.userid };
            await this.logged.add('notes_users', link, SQL`insert into notes_users (noteid, userid) values (${link.noteid}, ${q.userid}) returning *`);
            note.userid = q.userid;
        } if (q.venueid) {
            const link = { noteid: note.id, venueid: q.venueid };
            await this.logged.add('notes_venues', link, SQL`insert into notes_venues (noteid, venueid) values (${link.noteid}, ${q.venueid}) returning *`);
            note.venueid = q.venueid;
        }
        return note;
    }
    async update(id, q) {
        const query = SQL`update notes set updated=now()`;
        if ('content' in q) query.append(SQL`, content=${content}`);
        if ('is_visible_to_organizers' in q) query.append(SQL`, is_visible_to_organizers = ${!!q.is_visible_to_organizers}`);
        if ('is_visible_to_proposers' in q) query.append(SQL`, is_visible_to_proposers = ${!!q.is_visible_to_proposers}`);
        if ('is_visible_to_public' in q) query.append(SQL`, is_visible_to_public = ${!!q.is_visible_to_public}`);
        if ('is_hidden' in q) query.append(SQL`, is_hidden = ${!!q.is_hidden}`);
        query.append(SQL` where id=${id} returning *`);
        return await this.logged.update('notes', id, q, query);
    }
    async delete(id) {
        await this.logged.delete('notes_proposals', [id], SQL`delete from notes_proposals where noteid = ${id}`, { noteid: id });
        await this.logged.delete('notes_shows', [id], SQL`delete from notes_shows where noteid = ${id}`, { noteid: id });
        await this.logged.delete('notes_users', [id], SQL`delete from notes_users where noteid = ${id}`, { noteid: id });
        await this.logged.delete('notes_venues', [id], SQL`delete from notes_venues where noteid = ${id}`, { noteid: id });
        await this.logged.delete('notes', id);
    }
};

export const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
    const q = { ...req.query, level: req.auth.l };
    const notesDB = new NotesDB(req);
    const notes = await notesDB.list(q);
    return res.json({ notes });
});

router.post('/', async (req, res) => {
    try {
        const q = { ...req.body, created_by_userid: req.auth.u };
        if (!req.auth || req.auth.l > 10) q.is_visible_to_public = false;
        const notesDB = new NotesDB(req);
        const note = await notesDB.add(q);
        return res.json(note);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/:id', async (req, res) => {
    try {
        const notesDB = new NotesDB(req);
        const note = await notesDB.get(req.params.id);
        if (req.auth?.u !== note.created_by_userid) return res.status(403).send('Forbidden');
        const newNote = await notesDB.update(req.params.id, req.body);
        return res.json(newNote);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.delete('/:id', async(req, res) => {
    try {
        const notesDB = new NotesDB(req);
        const note = await notesDB.get(req.params.id);
        if (!req.auth || !(req.auth.u === note.created_by_userid || req.auth.l <= 10)) return res.status(403).send('Forbidden');
        await notesDB.delete(req.params.id);
        return res.status(204).send();
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

