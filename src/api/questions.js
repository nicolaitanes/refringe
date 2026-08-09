import express from 'express';
import SQL from 'sql-template-strings'
import { pgdb } from './pgdb.js';
import { renderTemplate } from './templates.js';

export const questionsDB = {
    async list(q) {
        // TODO filter by q.*
        const result = await pgdb.query(SQL`select * from questions
        order by forproposal desc, forvenue desc, priority, fieldname`);
        return result.rows;
    },
    async add(q) {
        return await pgdb.add('questions', q, SQL`insert into questions (
            required, forproposal, forvenue, priority,
            fieldname, fieldtype, choices, pattern, question
        ) values (
            ${q.required}, ${q.forproposal}, ${q.forvenue}, ${q.priority},
            ${q.fieldname}, ${q.choices}, ${q.pattern}, ${q.question}
        ) returning *`);
    },
    async update(id, q) {
        return await pgdb.update('questions', id, q, SQL`update questions set
        required = ${q.required},
        forproposal = ${q.forproposal},
        forvenue = ${q.forvenue},
        priority = ${q.priority},
        fieldname = ${q.fieldname},
        choices = ${q.choices},
        pattern = ${q.pattern},
        question = ${q.question}
        where id=${id}`);
    }
};

function parseQuestion(body) {
    return {
        required: !!body.required,
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

export const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
    const questions = await questionsDB.list(req.query);
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
