import express from 'express';
import multer from 'multer';
import SQL from 'sql-template-strings'
import { NotesDB } from './notes.js';
import { logged, pgdb } from './pgdb.js';
import { markdownConverter } from './questions.js';
import { TagsDB } from './tags.js';
import { renderTemplate } from './templates.js';
import { tmplJson, tmplJsonFields, writeLocalJsonDates } from './time.js';

const upload = multer();

export class CalendarsDB {
    constructor(req) {
        this.logged = logged(req);
    }
    async list(q) {
        const query = SQL`select c.*, p.id as publicid, p.publicname, p.key, p.ispublic, p.priority from calendars c left join publiccalendars p on c.id = p.calendarid where 1=1`;
        if ('active' in q) query.append(SQL` and c.active`);
        if ('current' in q) query.append(SQL` and (c.enddate is null or c.enddate > now())`);
        if ('ispublic' in q) query.append(SQL` and p.ispublic and c.active`);
        query.append(SQL` order by c.startdate, p.priority, c.name`);
        if ('limit' in q) query.append(SQL` limit ${q.limit}`);
        const result = await pgdb.query(query);
        for (const row of result.rows) {
            if (row.notes) row.notesHTML = markdownConverter.makeHtml(row.notes);
            if (row.callforwork) row.callforworkHTML = markdownConverter.makeHtml(row.callforwork);
        }
        return result.rows;
    }
    async get(id) {
        const result = await pgdb.query(SQL`select * from calendars where id = ${id}`);
        const row = result.rows[0];
        if (row?.notes) row.notesHTML = markdownConverter.makeHtml(row.notes);
        if (row?.callforwork) row.callforworkHTML = markdownConverter.makeHtml(row.callforwork);
        return row;
    }
    async add(q) {
        const row = await this.logged.add('calendars', q, SQL`insert into calendars (name, notes, startdate, enddate, deadline, callforwork, calling_public, calling_users) values (${q.name || ''}, ${q.notes || ''}, ${q.startdate}, ${q.enddate}, ${q.deadline}, ${q.callforwork}, ${!!q.calling_public}, ${!!q.calling_users}) returning *`);
        if (row?.notes) row.notesHTML = markdownConverter.makeHtml(row.notes);
        if (row?.callforwork) row.callforworkHTML = markdownConverter.makeHtml(row.callforwork);
        return row;
    }
    async update(id, q) {
        const query = SQL`update calendars set updated=now()`;
        if ('active' in q) query.append(SQL`, active=${!!q.active}`);
        if ('name' in q) query.append(SQL`, name=${q.name}`);
        if ('notes' in q) query.append(SQL`, notes=${q.notes}`);
        if ('startdate' in q) query.append(SQL`, startdate=${q.startdate}`);
        if ('enddate' in q) query.append(SQL`, enddate=${q.enddate}`);
        if ('deadline' in q) query.append(SQL`, deadline=${q.deadline}`);
        if ('callforwork' in q) query.append(SQL`, callforwork=${q.callforwork}`);
        if ('calling_public' in q) query.append(SQL`, calling_public=${q.calling_public}`);
        if ('calling_users' in q) query.append(SQL`, calling_users=${q.calling_users}`);
        query.append(SQL` where id=${id} returning *`);
        const row = await this.logged.update('calendars', id, q, query);
        if (row?.notes) row.notesHTML = markdownConverter.makeHtml(row.notes);
        if (row?.callforwork) row.callforworkHTML = markdownConverter.makeHtml(row.callforwork);
        return row;
    }
    // with mainly calendar details
    async listLinked(entity, id, andLinkable = false) {
        const query = SQL`select c.name, c.startdate, c.enddate, l.* from calendars c`;
        if (andLinkable) query.append(` left`);
        query.append(` join calendars_${entity}s l on c.id = l.calendarid and c.active and ${entity}id =`);
        query.append(SQL` ${id} where c.active and (calendarid is not null or c.enddate > now()) order by startdate, name`);
        const result = await pgdb.query(query);
        return result.rows;
    }
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
        return await this.logged.upsert('calendars_'+entity, context, query);
    }
    async unlink(id, entity, entityid) {
        const query = SQL`update`;
        query.append(` calendars_${entity}s set active = false where ${entity}id =`);
        query.append(SQL` ${entityid} and calendarid=${calendarid}`);
        await this.logged.update('calendars_'+entity, [id, entityid], { calendarid: id, [entity+'id']: entityid, active: false }, query);
    }
    async listProposals(id) {
        const result = await pgdb.query(SQL`select p.*, u.fullname from proposals p join users u on p.userid = u.id left join calendars_proposals c on c.proposalid = p.id where p.active and u.active and (calendarid is null or calendarid=${id} or allcalendars) order by title, fullname`);
        return result.rows;
    }
    async listVenues(id) {
        const result = await pgdb.query(SQL`select v.* from venues v left join calendars_venues c on c.venueid = v.id where v.active and (calendarid is null or calendarid = ${id} or allcalendars) order by name`);
        return result.rows;
    }
    async listShows(id) {
        const result = await pgdb.query(SQL`select s.*, p.title from shows s join proposals p on s.proposalid = p.id where s.calendarid = ${id} and s.active and p.active`);
        return result.rows;
    }
    async addShow(id, q) {
        return await this.logged.add('shows', q, SQL`insert into shows (calendarid, proposalid, isinstallation, isgroup, groupshowid, venueid, dateonly, starttime, endtime) values (${id}, ${q.proposalid}, ${!!q.isinstallation}, ${!!q.isgroup}, ${q.groupshowid || null}, ${q.venueid || null}, ${q.dateonly || null}, ${q.starttime || null}, ${q.endtime || null}) returning *`);
    }
    async updateShow(id, q) {
        const query = SQL`update shows set updated=now()`;
        if ('active' in q) query.append(SQL`, active=${!!q.active}`);
        if ('iscancelled' in q) query.append(SQL`, iscancelled=${!!q.iscancelled}`);
        if ('isinstallation' in q) query.append(SQL`, isinstallation=${!!q.isinstallation}`);
        if ('isgroup' in q) query.append(SQL`, isgroup=${!!q.isgroup}`);
        if ('groupshowid' in q) query.append(SQL`, groupshowid=${q.groupshowid || null}`);
        if ('venueid' in q) query.append(SQL`, venueid=${q.venueid || null}`);
        if ('dateonly' in q) query.append(SQL`, dateonly=${q.dateonly || null}`);
        if ('starttime' in q) query.append(SQL`, starttime=${q.starttime || null}`);
        if ('endtime' in q) query.append(SQL`, endtime=${q.endtime || null}`);
        query.append(SQL` where id=${id} returning *`);
        return await this.logged.update('calendars', id, q, query);
    }
    async getPublic(key) {
        const result = await pgdb.query(SQL`select p.*, c.notes, c.startdate, c.enddate from publiccalendars p left join calendars c on p.calendarid = c.id where p.key = ${key} order by ispublic desc, priority limit 1`);
        const row = result.rows[0];
        if (row?.notes) row.notesHTML = markdownConverter.makeHtml(row.notes);
        if (row?.callforwork) row.callforworkHTML = markdownConverter.makeHtml(row.callforwork);
        return row;
    }
    async addPublic(q) {
        return await this.logged.add('publiccalendars', q, SQL`insert into publiccalendars (publicname, key, calendarid, ispublic, priority) values (${q.publicname || ''}, ${q.key || ''}, ${q.calendarid}, ${!!q.ispublic}, ${q.priority ?? 100}) returning *`);
    }
    async updatePublic(id, q) {
        const query = SQL`update publiccalendars set updated=now()`;
        if ('ispublic' in q) query.append(SQL`, ispublic=${!!q.ispublic}`);
        if ('publicname' in q) query.append(SQL`, publicname=${q.publicname}`);
        if ('key' in q) query.append(SQL`, key=${q.key}`);
        // if ('calendarid' in q) query.append(SQL`, calendarid=${q.calendarid}`);
        if ('priority' in q) query.append(SQL`, priority=${q.priority}`);
        query.append(SQL` where id=${id} returning *`);
        return await this.logged.update('publiccalendars', id, q, query);
    }
};

export const router = express.Router();
router.use(express.json());

router.get('/:id/proposals', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const proposals = await new CalendarsDB(req).listProposals(req.params.id);
    return res.json({ proposals });
});

router.post('/:id/proposals/:proposalid', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        return res.json(await new CalendarsDB(req).link(req.params.id, 'proposal', req.params.proposalid, req.body));
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.get('/:id/venues', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const venues = await new CalendarsDB(req).listVenues(req.params.id);
    return res.json({ venues });
});

router.post('/:id/venues/:venueid', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        return res.json(await new CalendarsDB(req).link(req.params.id, 'venue', req.params.venueid, req.body));
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.get('/:id/shows/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const shows = await new CalendarsDB(req).listShows(req.params.id);
    return res.json({ shows });
});

router.post('/:id/shows/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const show = await new CalendarsDB(req).addShow(req.params.id, req.body);
        return res.json(show);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/:id/shows/:showid', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const show = await new CalendarsDB(req).updateShow(req.params.showid, req.body);
        return res.json(show);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.post('/linked/:entity/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const linked = await new CalendarsDB(req).link(req.params.entity, req.params.id, req.body);
        return res.json(linked);
    } catch (err) {
        console.log(err);
        return res.json(linked);
    }
});

router.get('/public/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) req.query.ispublic = true;
    const publicCalendars = (await new CalendarsDB(req).list(req.query))
        .filter(c => c.publicid);
    return res.json({ publicCalendars });
});

router.get('/public/:key', async (req, res) => {
    const calendar = await new CalendarsDB(req).getPublic(req.params.key);
    if (calendar) return res.json(calendar);
    return res.status(404).send('Not Found');
});

router.get('/events/', async (req, res) => {
    // TODO fullcalendar of public calendars and upcoming deadlines; pre-highlight next event
    //           : (await new CalendarsDB(req).list({ active: true, current: true, ispublic: true, limit: 1 }))[0];

    const calendar = (await new CalendarsDB(req).list({ active: true, current: true, ispublic: true, limit: 1 }))[0];
    res.redirect(303, calendar?.key ? '/calendars/events/' + calendar.key : '/');
});

router.get('/events/:key', async (req, res) => {
    const calendarsDB = new CalendarsDB(req);
    const notesDB = new NotesDB(req);
    const tagsDB = new TagsDB(req);
    const calendar = await calendarsDB.getPublic(req.params.key);
    if (!calendar) return res.status(404).send('Not Found');
    // TODO short-duration caching
    const [
        proposals,
        venues,
        shows,
        notes,
        tags,
        showTags
    ] = await Promise.all([
        calendarsDB.listProposals(calendar.calendarid),
        calendarsDB.listVenues(calendar.calendarid),
        calendarsDB.listShows(calendar.calendarid),
        notesDB.list({ active: true, level: 99 }),
        tagsDB.listLinked('proposal', null, { active: true, level: 99 }),
        tagsDB.listLinked('show', null, { active: true, level: 99 })
    ]);
    return renderTemplate(tmplJsonFields({
        template: 'event-schedule',
        key: calendar.key,
        calendarid: calendar.id,
        proposalid: req.query.proposal || '',
        tagname: req.query.tag || '',
        venueid: req.query.venue || '',
        calendar: { ...calendar, id: calendar.calendarid, publicid: calendar.id },
        pubcalendar: calendar,
        proposals,
        venues,
        shows: shows.filter(s => s.venueid),
        notes,
        tags,
        showTags
    }))(req, res);
    // TODO more SSR based on req.query (also `by: 'artist' | 'venue' | 'day')
});

router.get('/events/:key/map/', async (req, res) => {
    const calendarsDB = new CalendarsDB(req);
    const notesDB = new NotesDB(req);
    const tagsDB = new TagsDB(req);
    const calendar = await calendarsDB.getPublic(req.params.key);
    if (!calendar) return res.status(404).send('Not Found');
    const [shows, venues] = await Promise.all([
        calendarsDB.listShows(calendar.calendarid),
        calendarsDB.listVenues(calendar.calendarid)
    ]);
    const presentVenueIDs = new Set(shows.map(s => s.venueid));
    return renderTemplate(tmplJsonFields({
        template: 'event-map',
        key: calendar.key,
        venueid: req.query.venue || '',
        calendar: { ...calendar, id: calendar.calendarid, publicid: calendar.id },
        pubcalendar: calendar,
        venues: venues.filter(v => presentVenueIDs.has(v.id))
    }))(req, res);
});
    

router.get('/', async (req, res) => {
    const calendars = await new CalendarsDB(req).list(req.query);
    if (req.headers.accept?.includes('application/json')) return res.json({ calendars });
    return renderTemplate(tmplJsonFields({ template: 'calendars', calendars }))(req, res);
});

router.get('/:id', async (req, res) => {
    const calendar = await new CalendarsDB(req).get(req.params.id);
    if (!calendar) return res.status(404).send('Not Found');
    let status = !calendar.active ? 'inactive'
          : calendar.ispublic ? 'public'
          : calendar.calling_public ? 'publiccall'
          : calendar.calling_users ? 'usercall'
          : 'draft';
    if (calendar.deadline && status.endsWith('call') && calendar.deadline < new Date()) {
        status = 'draft';
    }
    if (!req.auth || req.auth.l > 20) {
        if (!status.startsWith('public')) return res.status(403).send('Forbidden');
    } else if (req.auth.l > 10) {
        if (status !== 'public' && status !== 'usercall') return res.status(403).send('Forbidden');
    }
    if (req.headers.accept?.includes('application/json')) return res.json(calendar);
    if (!status.endsWith('call')) {
        calendar.callforwork = null;
        calendar.deadline = null;
    }
    calendar.name = calendar.publicname || calendar.name;
    return renderTemplate(writeLocalJsonDates({
        template: req.auth && req.auth.l <= 10 ? 'calendar-edit' : 'calendar-detail',
        calendar,
        calendarJSON: tmplJson(calendar),
        status
    }))(req, res);
});

router.post('/', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    try {
        const calendarsDB = await new CalendarsDB(req);
        const calendar = await calendarsDB.add(req.body);
        const { id: publicid, ...pc } = req.body.key
            ? await calendarsDB.addPublic({
                calendarid: calendar.id,
                publicname: req.body.publicname || calendar.name,
                key: req.body.key,
                ispublic: !!req.body.ispublic,
                priority: req.body.priority ?? 100
            })
            : {};
        Object.assign(calendar, { publicid }, pc);
        return res.json(calendar);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});

router.put('/:id', async (req, res) => {
    if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    const calendarsDB = await new CalendarsDB(req);
    try {
        let calendar = await calendarsDB.update(req.params.id, req.body);
        if (req.body.publicid || req.body.key) {
            const pc = { ...req.body, id: req.body.publicid, calendarid: req.params.id };
            pc.publicname ||= calendar.name;
            const { id: publicid, ...newpc } = pc.id
                ? await calendarsDB.updatePublic(pc.id, pc)
                : await calendarsDB.addPublic(pc);
            calendar = {
                ...calendar,
                ...newpc,
                publicid
            };
        }
        return res.json(calendar);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Unknown Error');
    }
});
