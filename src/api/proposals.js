import express from 'express';
import multer from 'multer';
import SQL from 'sql-template-strings'
import { pgdb } from './pgdb.js';
import { questionsDB } from './questions.js';
import { renderTemplate } from './templates.js';

const upload = multer();

export const proposalsDB = {
    async list(q) {
        const query = SQL`select p.*, u.fullname from proposals p join users u on p.userid = u.id where u.active = true`;
        if (q.active) query.append(SQL` and p.active = true`);
        if (q.userid) query.append(SQL` and p.userid = ${q.userid}`);
        if (q.status) query.append(SQL` and p.status = ${q.status}`);
        query.append(SQL` order by p.id desc`);
        const result = await pgdb.query(query);
        return result.rows;
    },
    async get(id) {
        const result = await pgdb.query(SQL`select * from proposals where id = ${id}`);
        return result.rows[0];
    },
    async add(q) {
        return await pgdb.add('proposals', q, SQL`insert into proposals (
            userid, title, status, active
        ) values (
            ${q.userid}, ${q.title?.trim()}, ${q.status || 'draft'}, ${q.active || true}
        ) returning *`);
    },
    async update(id, q) {
        return await pgdb.update('proposals', id, q, SQL`update proposals set
                title = ${q.title?.trim()},
                status = ${q.status},
                active = ${q.active},
                updated = now()
            where id=${id}`
        );
    },
};

function parseProposal(body) {
    return {
        userid: body.userid ? `${body.userid}` : null,
        title: `${body.title || ''}`,
        description: `${body.description || ''}`,
        status: body.status ? `${body.status}` : 'draft',
        active: !!body.active
    };
}

export const router = express.Router();
router.use(express.json()); // body can be json
router.use(upload.none());  // or multipart form data

router.get('/new', async (req, res) => {
    const questions = await questionsDB.list({ active: true, forproposal: true });
    return renderTemplate({ template: 'proposal-new', questions })(req, res);
});

router.get('/', async (req, res) => {
    const proposals = await proposalsDB.list({
        active: true,
        ...req.query
    });
    for (const proposal of proposals) proposal.updated = proposal.updated.toISOString().slice(0, 19);
    if (req.headers.accept?.includes('application/json')) res.json({ proposals });
    return renderTemplate({ template: 'proposals', proposals })(req, res);
});

router.get('/:id', async (req, res) => {
    const proposal = await proposalsDB.get(req.params.id);
    if (!proposal) return res.status(404).send('Not Found');
    // TODO also allow when status is beyond a certain point, e.g. published, but not draft or withdrawn
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== proposal.userid)) return res.status(403).send('Forbidden');
    // if json requested, return json
    if (req.headers.accept?.includes('application/json')) return res.json(proposal);
    // otherwise render with template
    const questions = await questionsDB.listAnswers({ proposalid: req.params.id });
    return renderTemplate({ template: 'proposal-edit', proposal, questions })(req, res);
});

router.post('/', async (req, res) => {
    try {
        const proposal = parseProposal(req.body);
        const newProposal = await proposalsDB.add({ ...proposal, userid: req.auth.u });

        const questions = await questionsDB.list({ active: true, forproposal: true });
        await Promise.all(questions.map(async (q) => {
            if (q.fieldname in req.body && req.body[q.fieldname]) {
                await questionsDB.addOrUpdateAnswer({ questionid: q.id, proposalid: newProposal.id, answer: req.body[q.fieldname] });
            }
        }));

        if (req.headers.accept?.includes('application/json')) return res.json(newProposal);
        return res.redirect(303, '/menu');
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});

router.post('/:id', async (req, res) => {
    try {
        const proposal = parseProposal(req.body);
        await proposalsDB.update(req.params.id, proposal);

        const answers = await questionsDB.listAnswers({ proposalid: req.params.id });
        await Promise.all(answers.map(async (q) => {
            if (q.fieldname in req.body && (req.body[q.fieldname] || null) !== q.answer) {
                await questionsDB.addOrUpdateAnswer({ questionid: q.id, proposalid: req.params.id, answer: req.body[q.fieldname] });
            }
        }));

        if (req.headers.accept?.includes('application/json')) return res.json(proposal);
        return res.redirect(303, '/menu');
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});
