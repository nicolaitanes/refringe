import express from 'express';
import multer from 'multer';
import SQL from 'sql-template-strings'
import { pgdb } from './pgdb.js';
import { renderTemplate } from './templates.js';

const upload = multer();

export const calendarsDB = {
    async list(q) {
        const query = SQL`select c.* from calendars c where 1=1`;
        if ('active' in q) query.append(SQL` and c.active = true`);
        if ('current' in q) query.append(SQL` and (c.enddate is null or c.enddate > now())`);
        query.append(SQL` order by c.startdate, c.name`);
        const result = await pgdb.query(query);
        return result.rows;
    },
    async get(id) {
        const result = await pgdb.query(SQL`select * from calendars where id = ${id}`);
        return result.rows[0];
    },
    async add(q) {
        return await pgdb.add('calendars', q, SQL`insert into calendars (name, notes) values (${q.name || ''}, ${q.notes || ''}) returning *`);
    },
    async update(id, q) {
        const query = SQL`update calendars set updated=now()`;
        if ('active' in q) query.append(SQL`, active=${!!q.active}`);
        if ('name' in q) query.append(SQL`, name=${q.name}`);
        if ('notes' in q) query.append(SQL`, notes=${q.notes}`);
        if ('startdate' in q) query.append(SQL`, startdate=${q.startdate}`);
        if ('enddate' in q) query.append(SQL`, enddate=${q.enddate}`);
        query.append(SQL` where id=${id} returning *`);
        return await pgdb.update('calendars', id, q, query);
    },
    // with mainly calendar details
    async listLinked(entity, id, andLinkable = false) {
        const query = SQL`select c.name, c.startdate, c.enddate, l.* from calendars c`;
        if (andLinkable) query.append(` left`);
        query.append(` join calendars_${entity}s l on c.id = l.calendarid and c.active and ${entity}id =`);
        query.append(SQL` ${id} where c.active and (calendarid is not null or c.enddate < now()) order by startdate, name`);
        const result = await pgdb.query(query);
        return result.rows;
    },
    async link(id, entity, entityid, q={}) {
        const context = {
            active: true,
            status: 'unconfirmed',
            ...q,
            calendarid: id,
            [entity+'id']: entityid
        };
        const query = SQL`insert into`;
        query.append(` calendars_${entity}s (calendarid, ${entity}id, active, status) values`);
        query.append(SQL` (${id}, ${entityid}, ${context.active}, ${context.status})`);
        query.append(` on conflict (calendarid, ${entity}id) do update set`);
        query.append(SQL` active=${context.active}, status=${context.status} returning *`);
        return await pgdb.upsert('calendars_'+entity, context, q);
    },
    async unlink(id, entity, entityid) {
        const query = SQL`update`;
        query.append(` calendars_${entity}s set active = false where ${entity}id =`);
        query.append(SQL` ${entityid} and calendarid=${calendarid}`);
        await pgdb.update('calendars_'+entity, [id, entityid], { calendarid: id, [entity+'id']: entityid, active: false }, q);
    },
    async listProposals(id) {
        const result = await pgdb.query(SQL`select p.*, u.fullname from proposals p join users u on p.userid = u.id left join calendars_proposals c on c.proposalid = p.id where p.active and u.active and (calendarid is not null or allcalendars) order by name, fullname`);
        return result.rows;
    },
    async listVenues(id) {
        const result = await pgdb.query(SQL`select v.* from venues v left join calendars_venues c on c.venueid = v.id where v.active and (calendarid is not null or allcalendars) order by name`);
        return result.rows;
    },
    async listShows(id) {
        const result = await pgdb.query(SQL`select s.* from shows s where s.calendarid = ${id} and s.active`);
        return result.rows;
    },
    async addShow(id, q) {
        return await pgdb.add('shows', q, SQL`insert into shows (calendarid, proposalid, isinstallation, isgroup, groupshowid, venueid, dateonly, starttime, endtime) values (${id}, ${q.proposalid}, ${!!q.isinstallation}, ${!!q.isgroup}, ${q.groupshowid ?? null}, ${q.venueid ?? null}, ${q.dateonly ?? null}, ${q.starttime ?? null}, ${q.endtime ?? null}) returning *`);
    },
    async updateShow(id, q) {
        const query = SQL`update shows set updated=now()`;
        if ('active' in q) query.append(SQL` active=${!!q.active}`);
        if ('isinstallation' in q) query.append(SQL` isinstallation=${!!q.isinstallation}`);
        if ('isgroup' in q) query.append(SQL` isgroup=${!!q.isgroup}`);
        if ('groupshowid' in q) query.append(SQL` groupshowid=${q.groupshowid}`);
        if ('dateonly' in q) query.append(SQL` venueid=${q.dateonly}`);
        if ('starttime' in q) query.append(SQL` venueid=${q.starttime}`);
        if ('endtime' in q) query.append(SQL` venueid=${q.endtime}`);
        query.append(SQL` where id=${id} returning *`);
        return await pgdb.update('calendars', id, q, query);
    },
    async listPublic(q) {
        const query = SQL`select p.*, c.notes, c.startdate, c.enddate from publiccalendars p left join calendars c on p.calendarid = c.id where 1=1`;
        if ('active' in q) query.append(SQL` and p.active = true`);
        if ('current' in q) query.append(SQL` and (c.enddate is null or c.enddate > now())`);
        query.append(SQL` order by p.startdate desc, p.name`);
        const result = await pgdb.query(query);
        return result.rows;
    },
    async getPublic(id) {
        const result = await pgdb.query(SQL`select p.*, c.notes, c.startdate, c.enddate from publiccalendars p left join calendars c on p.calendarid = c.id where p.id = ${id}`);
        return result.rows[0];
    },
    async addPublic(q) {
        return await pgdb.add('publiccalendars', q, SQL`insert into publiccalendars (name, key, calendarid, priority) values (${q.name || ''}, ${q.key || ''}, ${q.calendarid}, ${q.priority ?? 100}) returning *`);
    },
    async updatePublic(id, q) {
        const query = SQL`update publiccalendars set updated=now()`;
        if ('active' in q) query.append(SQL`, active=${!!q.active}`);
        if ('name' in q) query.append(SQL`, name=${q.name}`);
        if ('key' in q) query.append(SQL`, key=${q.key}`);
        if ('calendarid' in q) query.append(SQL`, calendarid=${q.calendarid}`);
        if ('priority' in q) query.append(SQL`, priority=${priority}`);
        query.append(SQL` where id=${id} returning *`);
        return await pgdb.update('publiccalendars', id, q, query);
    },
};

export const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
    const calendars = await calendarsDB.list(req.query);
    if (req.headers.accept?.includes('application/json')) return res.json({ calendars });
    const publicCalendars = await calendarsDB.listPublic(req.query);
    return renderTemplate({
        template: 'calendars',
        calendars: JSON.stringify(calendars).replace(/\\/g, '\\\\'),
        publicCalendars: JSON.stringify(publicCalendars).replace(/\\/g, '\\\\')
    })(req, res);
});

router.post('/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const calendar = await calendarsDB.add(req.body);
        return res.json(calendar);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const calendar = await calendarsDB.update(req.params.id, req.body);
        return res.json(calendar);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.get('/:id/proposals', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const proposals = await calendarsDB.listProposals(req.params.id);
    return res.json({ proposals });
});

router.post('/:id/proposals/:proposalid', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        return res.json(await calendarsDB.link(req.params.id, 'proposal', req.params.proposalid, req.body));
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.get('/:id/venues', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const venues = await calendarsDB.listVenues(req.params.id);
    return res.json({ venues });
});

router.post('/:id/venues/:venueid', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        return res.json(await calendarsDB.link(req.params.id, 'venue', req.params.venueid, req.body));
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.get('/:id/shows/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const shows = await calendarsDB.listShows(req.params.id);
    return res.json({ shows });
});

router.post('/:id/shows/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const show = await calendarsDB.addShow(req.params.id, req.body);
        return res.json(show);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/:id/shows/:showid', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const show = await calendarsDB.updateShow(req.params.showid, req.body);
        return res.json(show);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.post('/linked/:entity/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const linked = await calendarsDB.link(req.params.entity, req.params.id, req.body);
        return res.json(linked);
    } catch (err) {
        console.log(err);
        return res.json(linked);
    }
});

router.get('/public/', async (req, res) => {
    const publicCalendars = await calendarsDB.listPublic(req.query);
    return res.json({ publicCalendars });
});

router.post('/public/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const calendar = await calendarsDB.addPublic(req.body);
        return res.json(calendar);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/public/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const calendar = await calendarsDB.updatePublic(req.params.id, req.body);
        return res.json(calendar);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

// TODO get /:id (scheduler edit?)
// TODO get /public/:key
