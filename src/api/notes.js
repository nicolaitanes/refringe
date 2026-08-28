import express from 'express';
import SQL from 'sql-template-strings'
import { pgdb } from './pgdb.js';
import { renderTemplate } from './templates.js';

export const notesDB = {
    async list(q) {
        const query = SQL`select * from notes n`;
        const hasid = 'proposalid' in q || 'showid' in q || 'userid' in q || 'venueid' in q;
        if (!hasid || 'proposalid' in q) {
            query.append(SQL` left join notes_proposals np on np.noteid = n.id`);
        }
        if (!hasid || 'noteid' in q) {
            query.append(SQL` left join notes_shows np on np.noteid = n.id`);
        }
        if (!hasid || 'userid' in q) {
            query.append(SQL` left join notes_users np on np.noteid = n.id`);
        }
        if (!hasid || 'venueid' in q) {
            query.append(SQL` left join notes_venues np on np.noteid = n.id`);
        }
        query.append(` where 1=1`);
        if ('level' in q) {
            if (q.level > 20) query.append(SQL` and n.is_visible_to_public`)
            else if (q.level > 10) query.append(SQL` and n.is_visible_to_proposers`)
            else query.append(SQL` and n.is_visible_to_organizers`);
        }
        const result = await pgdb.query(query);
        return result.rows;
    },
    async get(id) {
        const result = await pgdb.query(SQL`select * from notes where id = ${id}`);
        return result.rows[0];
    },
    async add(q) {
        const note = await pgdb.add('notes', q, SQL`insert into notes (content, is_visible_to_organizers, is_visible_to_proposers, is_visible_to_public) values (${q.content || ''}, ${!!q.is_visible_to_organizers}, ${!!q.is_visible_to_proposers}, ${!!q.is_visible_to_public}) returning *`);
        if (q.proposalid) {
            const link = { noteid: note.id, proposalid: q.proposalid };
            await pgdb.add('notes_proposals', link, SQL`insert into notes_proposals (noteid, proposalid) values (${link.noteid}, ${q.proposalid}) returning *`);
            note.proposalid = q.proposalid;
        } if (q.showid) {
            const link = { noteid: note.id, showid: q.showid };
            await pgdb.add('notes_shows', link, SQL`insert into notes_shows (noteid, showid) values (${link.noteid}, ${q.showid}) returning *`);
            note.showid = q.showid;
        } if (q.userid) {
            const link = { noteid: note.id, userid: q.userid };
            await pgdb.add('notes_users', link, SQL`insert into notes_users (noteid, userid) values (${link.noteid}, ${q.userid}) returning *`);
            note.userid = q.userid;
        } if (q.venueid) {
            const link = { noteid: note.id, venueid: q.venueid };
            await pgdb.add('notes_venues', link, SQL`insert into notes_venues (noteid, venueid) values (${link.noteid}, ${q.venueid}) returning *`);
            note.venueid = q.venueid;
        }
    },
    async update(id, q) {
        const query = SQL`update notes set updated=now()`;
        if ('content' in q) query.append(SQL`, content=${content}`);
        if ('is_visible_to_organizers' in q) query.append(SQL`, is_visible_to_organizers = ${!!q.is_visible_to_organizers}`);
        if ('is_visible_to_proposers' in q) query.append(SQL`, is_visible_to_proposers = ${!!q.is_visible_to_proposers}`);
        if ('is_visible_to_public' in q) query.append(SQL`, is_visible_to_public = ${!!q.is_visible_to_public}`);
        query.append(` where id=${id} returning *`);
        return await pgdb.update(id, q, query);
    },
    async delete(id) {
        await pgdb.delete('notes', id, `delete from notes where id=${id}`);
    }
};

export const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
    const q = { ...req.query, level: req.auth.l };
    const notes = await notesDB.list(q);
    return res.json({ notes });
});

router.post('/', async (req, res) => {
    try {
        const note = await notesDB.add({req.body, created_by_userid: req.auth.u });
        return res.json(note);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/:id', async (req, res) => {
    try {
        const note = await notesDB.update(req.params.id, req.body);
        return res.json(note);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.delete('/:id', async(req, res) => {
    try {
        await notesDB.delete(req.params.id);
        return res.status(204).send();
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

