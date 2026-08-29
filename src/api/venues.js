import express from 'express';
import multer from 'multer';
import SQL from 'sql-template-strings'
import { pgdb } from './pgdb.js';
import { questionsDB } from './questions.js';
import { renderTemplate } from './templates.js';

const upload = multer();

export const venuesDB = {
    async list(q) {
        const query = SQL`select v.* from venues v where 1=1`;
        if (q.active) query.append(SQL` and v.active = true`);
        if (q.userid) query.append(SQL` and v.userid = ${q.userid}`);
        if (q.status) query.append(SQL` and v.status = ${q.status}`);
        query.append(SQL` order by v.name`);
        const result = await pgdb.query(query);
        return result.rows;
    },
    async get(id) {
        const result = await pgdb.query(SQL`select * from venues where id = ${id}`);
        return result.rows[0];
    },
    async add(q) {
        return await pgdb.add('venues', q, SQL`insert into venues (
            userid, active, name, status, address, city, state, zip, latitude, longitude, phone, email, website
        ) values (
            ${q.userid}, ${q.active || true}, ${q.name?.trim()}, ${q.status || 'unconfirmed'}, ${q.address?.trim()}, ${q.city?.trim()}, ${q.state?.trim()}, ${q.zip?.trim()}, ${q.latitude || null}, ${q.longitude || null}, ${q.phone?.trim()}, ${q.email?.trim()}, ${q.website?.trim()}
        ) returning *`);
    },
    async update(id, q) {
        return await pgdb.update('venues', id, q, SQL`update venues set
                active = ${q.active && q.active !== 'false'},
                name = ${q.name.trim()},
                status = ${q.status || 'unconfirmed'},
                address = ${q.address ? q.address.trim() : null},
                city = ${q.city ? q.city.trim() : null},
                state = ${q.state ? q.state.trim() : null},
                zip = ${q.zip ? q.zip.trim() : null},
                latitude = ${q.latitude || null},
                longitude = ${q.longitude || null},
                phone = ${q.phone ? q.phone.trim() : null},
                email = ${q.email ? q.email.trim() : null},
                website = ${q.website ? q.website.trim() : null},
                updated = now()
            where id=${id}`
        );
    },
};

function parseVenue(body) {
    return {
        userid: body.userid ? `${body.userid}` : null,
        active: !!body.active,
        name: `${body.name || ''}`,
        status: `${body.status || 'unconfirmed'}`,
        address: body.address ? `${body.address}` : null,
        city: body.city ? `${body.city}` : null,
        state: body.state ? `${body.state}` : null,
        zip: body.zip ? `${body.zip}` : null,
        latitude: body.latitude ? parseFloat(body.latitude) : null,
        longitude: body.longitude ? parseFloat(body.longitude) : null,
        phone: body.phone ? `${body.phone}` : null,
        email: body.email ? `${body.email}` : null,
        website: body.website ? `${body.website}` : null
    };
}

export const router = express.Router();
router.use(express.json()); // body can be json
router.use(upload.none());  // or multipart form data

router.get('/new', async (req, res) => {
    const questions = await questionsDB.list({ active: true, forvenue: true });
    return renderTemplate({ template: 'venue-new', questions })(req, res);
});

router.get('/', async (req, res) => {
    const venues = await venuesDB.list({
        active: true,
        ...req.query
    });
    if (req.headers.accept?.includes('application/json')) return res.json({ venues });
    return renderTemplate({ template: 'venues', venues })(req, res);
});

router.get('/:id', async (req, res) => {
    const venue = await venuesDB.get(req.params.id);
    if (!venue) return res.status(404).send('Not Found');
    // TODO also allow when status is beyond a certain point, e.g. published, but not draft or withdrawn
    if (!req.auth || (req.auth.l > 10 && req.auth.u !== venue.userid)) return res.status(403).send('Forbidden');
    // if json requested, return json
    if (req.headers.accept?.includes('application/json')) return res.json(venue);
    // otherwise render with template
    const questions = await questionsDB.listAnswers({ venueid: req.params.id });
    return renderTemplate({ template: 'venue-edit', venue, questions })(req, res);
});

router.post('/', async (req, res) => {
    try {
        const venue = parseVenue(req.body);
        if (!venue.name) return res.status(400).send('Name is required');
        if (!venue.address) return res.status(400).send('Address is required');
        
        const newVenue = await venuesDB.add({ ...venue, userid: req.auth.u });

        const questions = await questionsDB.list({ active: true, forvenue: true });
        await Promise.all(questions.map(async (q) => {
            if (q.fieldname in req.body && req.body[q.fieldname]) {
                await questionsDB.addOrUpdateAnswer({ questionid: q.id, venueid: newVenue.id, answer: req.body[q.fieldname] });
            }
        }));

        if (req.headers.accept?.includes('application/json')) return res.json(newVenue);
        return res.redirect(303, '/menu');
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});

router.post('/:id', async (req, res) => {
    try {
        const venue = parseVenue(req.body);
        await venuesDB.update(req.params.id, venue);

        const answers = await questionsDB.listAnswers({ venueid: req.params.id });
        await Promise.all(answers.map(async (q) => {
            if (q.fieldname in req.body && (req.body[q.fieldname] || null) !== q.answer) {
                await questionsDB.addOrUpdateAnswer({ questionid: q.id, venueid: req.params.id, answer: req.body[q.fieldname] });
            }
        }));

        if (req.headers.accept?.includes('application/json')) return res.json(venue);
        return res.redirect(303, '/menu');
    } catch (err) {
        console.error(err);
        return res.status(503).send('Unknown Error');
    }
});
