import express from 'express';
import showdown from 'showdown';
import SQL from 'sql-template-strings'
import { logged, pgdb } from './pgdb.js';
import { ProposalsDB } from './proposals.js';
import { renderTemplate } from './templates.js';
import { tmplJsonFields } from './time.js';

export const markdownConverter = new showdown.Converter({
    safeMode: true,
    headerLevelStart: 3,
    simplifiedAutoLink: true,
    literalMidWordUnderscores: true,
    simpleLineBreaks: true,
});

export class QuestionsDB {
    constructor(req) {
        this.logged = logged(req);
    }
    async list(q) {
        const whereParts = [];
        const query = SQL`select * from questions where 1=1`;
        if (q.active) query.append(SQL` and active = true`);
        if (q.forproposal) query.append(SQL` and forproposal = true`);
        if (q.foruser) query.append(SQL` and foruser = true`);
        if (q.forvenue) query.append(SQL` and forvenue = true`);
        query.append(SQL` order by forproposal desc, foruser desc, forvenue desc, priority, fieldname`);
        const result = await pgdb.query(query);
        return result.rows.map(a => ({
            ...a,
            isChoices: !a.fieldtype && !!a.choices?.length,
            isTextarea: a.fieldtype === 'textarea',
            isYesno: a.fieldtype === 'yesno'
        }));
    }
    async add(q) {
        return await this.logged.add('questions', q, SQL`insert into questions (
            required, ispublic, parentid, forproposal, foruser, forvenue, priority,
            fieldname, fieldtype, choices, pattern, question
        ) values (
            ${q.required || false}, ${q.ispublic || false}, ${q.parentid || null}, ${q.forproposal || false}, ${q.foruser || false}, ${q.forvenue || false}, ${q.priority || 0},
            ${q.fieldname}, ${q.fieldtype}, ${q.choices || null}, ${q.pattern || null}, ${q.question}
        ) returning *`);
    }
    async update(id, q) {
        return await this.logged.update('questions', id, q, SQL`update questions set
        active = ${q.active},
        required = ${q.required},
        ispublic = ${q.ispublic},
        forproposal = ${q.forproposal},
        foruser = ${q.foruser},
        forvenue = ${q.forvenue},
        priority = ${q.priority},
        fieldname = ${q.fieldname},
        fieldtype = ${q.fieldtype},
        choices = ${q.choices},
        pattern = ${q.pattern},
        question = ${q.question}
        where id=${id}`);
    }
    async listAnswers(q) {
        const result =
            q.proposalid ? await pgdb.query(SQL`select * from questions q left outer join proposalanswers a on a.questionid = q.id and a.proposalid = ${q.proposalid} where q.active and q.forproposal order by priority, fieldname`) :
            q.userid ? await pgdb.query(SQL`select * from questions q left outer join useranswers a on a.questionid = q.id and a.userid = ${q.userid} where q.active and q.foruser order by priority, fieldname`) :
            q.venueid ? await pgdb.query(SQL`select * from questions q left outer join venueanswers a on a.questionid = q.id and a.venueid = ${q.venueid} where q.active and q.forvenue order by priority, fieldname`) :
            [];
        return result.rows.map(qa => ({
            ...qa,
            isChoices: !qa.fieldtype && !!qa.choices?.length,
            isTextarea: qa.fieldtype === 'textarea',
            isYesno: qa.fieldtype === 'yesno',
            answer: qa.answer || '',
            proposalid: q.proposalid,
            userid: q.userid,
            venueid: q.venueid
        }));
    }
    async addOrUpdateAnswer(q) {
        if (!q.questionid) return;
        if (q.proposalid) {
            await this.logged.upsert('proposalanswers', q, SQL`insert into proposalanswers (questionid, proposalid, answer) values (${q.questionid}, ${q.proposalid}, ${q.answer || ''})
                on conflict (questionid, proposalid) do update set answer = excluded.answer`);
        } else if (q.userid) {
            await this.logged.upsert('useranswers', q, SQL`insert into useranswers (questionid, userid, answer) values (${q.questionid}, ${q.userid}, ${q.answer || ''})
                on conflict (questionid, userid) do update set answer = excluded.answer`);
        } else if (q.venueid) {
            await this.logged.upsert('venueanswers', q, SQL`insert into venueanswers (questionid, venueid, answer) values (${q.questionid}, ${q.venueid}, ${q.answer || ''})
                on conflict (questionid, venueid) do update set answer = excluded.answer`);
        }
    }
};

function parseQuestion(body) {
    return {
        active: !!body.active,
        required: !!body.required,
        ispublic: !!body.ispublic,
        parentid: body.parentid ? `${body.parentid}` : null,
        forproposal: !!body.forproposal,
        foruser: !!body.foruser,
        forvenue: !!body.forvenue,
        priority: +(body.priority ?? 1),
        fieldname: `${body.fieldname || ''}`,
        fieldtype: body.fieldtype ? `${body.fieldtype}` : null,
        choices: body.choices?.map(c => `${c}`) ?? null,
        pattern: body.pattern ? `${body.pattern}` : null,
        question: `${body.question || ''}`
    };
}

// also sets answerHTML for fieldtype 'textarea'
export function nestQuestions(questions) {
    const nested = [];
    const byId = {};
    for (const q of questions) byId[q.id] = q;
    for (const q of questions) {
        if (q.fieldtype === 'textarea' && q.answer) {
            q.answerHTML = markdownConverter.makeHtml(q.answer);
        }
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
    const questionsDB = new QuestionsDB(req);
    const questions = nestQuestions(await questionsDB.list(req.query));
    if (req.headers.accept?.includes('application/json')) return res.json({ questions });
    return renderTemplate(tmplJsonFields({ template: 'questions', questions }))(req, res);
});

router.post('/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const questionsDB = new QuestionsDB(req);
    try {
        const q = parseQuestion(req.body);
        const newQ = await questionsDB.add(q);
        return res.json(newQ);
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});

router.put('/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const questionsDB = new QuestionsDB(req);
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
    const questionsDB = new QuestionsDB(req);
    const answers = nestQuestions(await questionsDB.listAnswers({ proposalid: req.params.id }));
    res.json({ answers });
});

router.get('/user/:id', async (req, res) => {
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== req.params.id)) return res.status(403).send('Forbidden');
    const questionsDB = new QuestionsDB(req);
    const answers = nestQuestions(await questionsDB.listAnswers({ userid: req.params.id }));
    res.json({ answers });
});

router.get('/venue/:id', async (req, res) => {
    const questionsDB = new QuestionsDB(req);
    const answers = nestQuestions(await questionsDB.listAnswers({ venueid: req.params.id }));
    res.json({ answers });
});

router.post('/proposal/:id', async(req, res) => {
    const proposalsDB = new ProposalsDB(req);
    const questionsDB = new QuestionsDB(req);
    const proposal = await proposalsDB.get(req.params.id);
    if (!proposal) return res.status(404).send('Not Found');
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== proposal.userid)) return res.status(403).send('Forbidden');
    await questionsDB.addOrUpdateAnswer({
        questionid: req.body.questionid,
        proposalid: req.params.id,
        answer: req.body.answer || null
    });
    return res.status(204).send();
});

router.post('/user/:id', async (req, res) => {
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== req.params.id)) return res.status(403).send('Forbidden');
    if (!req.body.questionid) return res.status(400).send('Bad Request');
    const questionsDB = new QuestionsDB(req);
    await questionsDB.addOrUpdateAnswer({
        questionid: req.body.questionid,
        userid: req.params.id,
        answer: req.body.answer || null
    });
    return res.status(204).send();
});

router.post('/venue/:id', async(req, res) => {
    const questionsDB = new QuestionsDB(req);
    const venuesDB = new VenuesDB(req);
    const venue = await venuesDB.get(req.params.id);
    if (!venue) return res.status(404).send('Not Found');
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== venue.userid)) return res.status(403).send('Forbidden');
    await questionsDB.addOrUpdateAnswer({
        questionid: req.body.questionid,
        venueid: req.params.id,
        answer: req.body.answer || null
    });
    return res.status(204).send();
});
