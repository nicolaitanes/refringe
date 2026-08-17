import express from 'express';
import SQL from 'sql-template-strings'
import { pgdb } from './pgdb.js';
import { renderTemplate } from './templates.js';

export const questionsDB = {
    async list(q) {
        const whereParts = [];
        if (q.active) whereParts.push('active = true');
        if (q.forproposal) whereParts.push('forproposal = true');
        if (q.forvenue) whereParts.push('forvenue = true');
        const result = await pgdb.query(SQL`select * from questions
        ${whereParts.length ? 'where ' + whereParts.join(' AND ') : ''}
        order by forproposal desc, forvenue desc, priority, fieldname`);
        return result.rows;
    },
    async add(q) {
        return await pgdb.add('questions', q, SQL`insert into questions (
            required, ispublic, parentid, forproposal, forvenue, priority,
            fieldname, fieldtype, choices, pattern, question
        ) values (
            ${q.required || false}, ${q.ispublic || false}, ${q.parentid || null}, ${q.forproposal || false}, ${q.forvenue || false}, ${q.priority || 0},
            ${q.fieldname}, ${q.choices || null}, ${q.pattern || null}, ${q.question}
        ) returning *`);
    },
    async update(id, q) {
        return await pgdb.update('questions', id, q, SQL`update questions set
        required = ${q.required},
        ispublic = ${q.ispublic}
        forproposal = ${q.forproposal},
        forvenue = ${q.forvenue},
        priority = ${q.priority},
        fieldname = ${q.fieldname},
        choices = ${q.choices},
        pattern = ${q.pattern},
        question = ${q.question}
        where id=${id}`);
    },
    async listAnswers(q) {
        const result =
            q.proposalid ? await pgdb.query(SQL`select * from proposalanswers a left outer join questions q on a.questionid = q.id and q.forproposal = true where q.active and a.userid = ${q.userid} order by priority, fieldname`) :
            q.userid ? await pgdb.query(SQL`select * from useranswers a left outer join questions q on a.questionid = q.id and q.foruser = true where q.active and a.userid = ${q.userid} order by priority, fieldname`) :
            q.venueid ? await pgdb.query(SQL`select * from venueanswers a left outer join questions q on a.questionid = q.id and q.forvenue = true where q.active and a.userid = ${q.userid} order by priority, fieldname`) :
            [];
        return result.rows.map(qa => ({
            ...qa,
            answer: qa.answer || '',
            proposalid: q.proposalid,
            userid: q.userid,
            venueid: q.venueid
        }));
    },
    async addOrUpdateAnswer(q) {
        if (!q.questionid) return;
        if (q.proposalid) {
            await pgdb.query(SQL`insert into proposalanswers (questionid, proposalid, answer) values (${q.questionid}, ${q.proposalid}, ${q.answer || null})
                on conflict (questionid, proposalid) do update set answer = excluded.answer`);
        } else if (q.userid) {
            await pgdb.query(SQL`insert into useranswers (questionid, userid, answer) values (${q.questionid}, ${q.userid}, ${q.answer || null})
                on conflict (questionid, userid) do update set answer = excluded.answer`);
        } else if (q.venueid) {
            await pgdb.query(SQL`insert into venueanswers (questionid, venueid, answer) values (${q.questionid}, ${q.venueid}, ${q.answer || null})
                on conflict (questionid, venueid) do update set answer = excluded.answer`);
        }
    }
};

function parseQuestion(body) {
    return {
        required: !!body.required,
        parentid: body.parentid ? `${body.parentid}` : null,
        forproposal: !!body.forproposal,
        forvenue: !!body.forvenue,
        priority: +(body.priority ?? 1),
        fieldname: `${body.fieldname || ''}`,
        fieldtype: body.fieldtype ? `${body.fieldtype}` : null,
        choices: body.choices?.map(c => `${c}`) ?? null,
        pattern: body.pattern ? `${body.pattern}` : null,
        question: `${body.question || ''}`
    };
}

function nestQuestions(questions) {
    const nested = [];
    const byId = {};
    for (const q of questions) {
        byId[q.id] = q;
        if (!q.parentid) {
            nested.push(q);
        } else {
            const parent = byId[q.parentid];
            if (!parent) {
                nested.push(q);
            } else {
                (parent.children ??= []).push(q);
            }
        }
    }
    return nested;
}

export const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
    let questions = nestQuestions(await questionsDB.list(req.query));
    res.json({ questions });
});

router.post('/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const q = parseQuestion(req.body);
        const newQ = await questionsDB.add(q);
        return res.json(newQ);
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});

router.post('/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const q = parseQuestion(req.body);
        await questionsDB.update(req.params.id, q);
        return res.json(q);
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});

router.get('/proposal/:id', async (req, res) => {
    const answers = nestQuestions(await questionsDB.listAnswers({ proposalid: req.params.id }));
    res.json({ answers });
});

router.get('/user/:id', async (req, res) => {
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== req.params.id)) return res.status(403).send('Forbidden');
    const answers = nestQuestions(await questionsDB.listAnswers({ userid: req.params.id }));
    res.json({ answers });
});

router.get('/venue/:id', async (req, res) => {
    const answers = nestQuestions(await questionsDB.listAnswers({ venueid: req.params.id }));
    res.json({ answers });
});

router.post('/proposal/:id', async(req, res) => {
    // TODO verify admin or proposal owner
});

router.post('/user/:id', async (req, res) => {
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== req.params.id)) return res.status(403).send('Forbidden');
    if (!req.body.questionid) return res.status(400).send('Bad Request');
    await questionsDB.addOrUpdateAnswer({
        questionid: req.body.questionid,
        userid: req.params.id,
        answer: req.body.answer || null
    });
    return res.status(204).send();
});

router.post('/venue/:id', async(req, res) => {
    // TODO verify admin or venue owner
});
