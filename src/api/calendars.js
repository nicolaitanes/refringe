import express from 'express';
import multer from 'multer';
import SQL from 'sql-template-strings'
import { NotesDB } from './notes.js';
import { logged, pgdb } from './pgdb.js';
import { markdownConverter, QuestionsDB } from './questions.js';
import { TagsDB } from './tags.js';
import { renderTemplate } from './templates.js';
import { tmplJson, tmplJsonFields, writeLocalJsonDates } from './time.js';
import { UsersDB } from './users.js';
import { VenuesDB } from './venues.js';

const upload = multer();

export class CalendarsDB {
    constructor(req) {
        this.logged = logged(req);
    }
    async list(q) {
        const query = SQL`select c.*, p.id as publicid, p.publicname, p.key, p.ispublic, p.priority from calendars c left join publiccalendars p on c.id = p.calendarid where 1=1`;
        if ('active' in q) query.append(SQL` and c.active`);
        if ('current' in q) query.append(SQL` and (c.enddate is null or c.enddate > (now() + '- 366 days'))`);
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
        try {
            const result = await pgdb.query(SQL`select c.*, p.id as publicid, p.publicname, p.key, p.ispublic, p.priority from calendars c left join publiccalendars p on c.id = p.calendarid where c.id = ${id}`);
            const row = result.rows[0];
            if (row?.notes) row.notesHTML = markdownConverter.makeHtml(row.notes);
            if (row?.callforwork) row.callforworkHTML = markdownConverter.makeHtml(row.callforwork);
            return row;
        } catch (err) { console.error(err); }
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
        try {
            const query = SQL`select c.name, c.startdate, c.enddate, l.* from calendars c`;
            if (andLinkable) query.append(` left`);
            query.append(` join calendars_${entity}s l on c.id = l.calendarid and c.active and ${entity}id =`);
            query.append(SQL` ${id} where c.active and (calendarid is not null or c.enddate > now()) order by startdate, name`);
            const result = await pgdb.query(query);
            return result.rows;
        } catch (err) { console.error(err); }
        return [];
    }
    async link(id, entity, entityid, q={}) {
        const context = {
            active: true,
            status: 'unconfirmed',
            ...q,
            calendarid: id,
            [entity+'id']: entityid
        };
        try {
            const query = SQL`insert into`;
            query.append(` calendars_${entity}s (calendarid, ${entity}id, active, status) values`);
            query.append(SQL` (${id}, ${entityid}, ${context.active}, ${context.status})`);
            query.append(` on conflict (calendarid, ${entity}id) do update set`);
            query.append(SQL` active=${context.active}, status=${context.status} returning *`);
            return await this.logged.upsert('calendars_'+entity, context, query);
        } catch (err) { console.error(err); }
    }
    async unlink(id, entity, entityid) {
        try {
            const query = SQL`update`;
            query.append(` calendars_${entity}s set active = false where ${entity}id =`);
            query.append(SQL` ${entityid} and calendarid=${id}`);
            await this.logged.update('calendars_'+entity, [id, entityid], { calendarid: id, [entity+'id']: entityid, active: false }, query);
        } catch (err) { console.error(err); }
    }
    async userHasShows(id, userid) {
        try {
            const result = await pgdb.query(SQL`select case when exists (select 1 from shows s join proposals p on s.proposalid = p.id where s.active and p.active and p.userid = ${userid} and s.calendarid = ${id}) then 1 else 0 end as yesno`);
            return !!result.rows[0].yesno;
        } catch (err) { console.error(err); }
    }
    async listProposals(id) {
        try {
            const result = await pgdb.query(SQL`select p.*, u.fullname from proposals p join users u on p.userid = u.id left join calendars_proposals c on c.proposalid = p.id where p.active and u.active and (calendarid is null or calendarid=${id} or allcalendars) order by title, fullname`);
            return result.rows;
        } catch (err) { console.error(err); }
    }
    async listVenues(id) {
        try {
            const result = await pgdb.query(SQL`select v.* from venues v left join calendars_venues c on c.venueid = v.id where v.active and (calendarid is null or calendarid = ${id} or allcalendars) order by name`);
            return result.rows;
        } catch (err) { console.error(err); }
    }
    async listShows(id) {
        try {
            const result = await pgdb.query(SQL`select s.*, p.title from shows s join proposals p on s.proposalid = p.id where s.calendarid = ${id} and s.active and p.active`);
            return result.rows;
        } catch (err) { console.error(err); }
    }
    async addShow(id, q) {
        try {
            return await this.logged.add('shows', q, SQL`insert into shows (calendarid, proposalid, isinstallation, isgroup, groupshowid, venueid, dateonly, starttime, endtime) values (${id}, ${q.proposalid}, ${!!q.isinstallation}, ${!!q.isgroup}, ${q.groupshowid || null}, ${q.venueid || null}, ${q.dateonly || null}, ${q.starttime || null}, ${q.endtime || null}) returning *`);
        } catch (err) { console.error(err); }
    }
    async updateShow(id, q) {
        try {
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
            return await this.logged.update('shows', id, q, query);
        } catch (err) { console.error(err); }
    }
    async getPublic(key) {
        const result = await pgdb.query(SQL`select p.*, c.notes, c.startdate, c.enddate from publiccalendars p left join calendars c on p.calendarid = c.id where p.key = ${key} and ispublic order by priority limit 1`);
        const row = result.rows[0];
        if (row?.notes) row.notesHTML = markdownConverter.makeHtml(row.notes);
        if (row?.callforwork) row.callforworkHTML = markdownConverter.makeHtml(row.callforwork);
        return row;
    }
    async addPublic(q) {
        try {
            return await this.logged.add('publiccalendars', q, SQL`insert into publiccalendars (publicname, key, calendarid, ispublic, priority) values (${q.publicname || ''}, ${q.key || ''}, ${q.calendarid}, ${!!q.ispublic}, ${q.priority ?? 100}) returning *`);
        } catch (err) { console.error(err); }
    }
    async updatePublic(id, q) {
        try {
            const query = SQL`update publiccalendars set updated=now()`;
            if ('ispublic' in q) query.append(SQL`, ispublic=${!!q.ispublic}`);
            if ('publicname' in q) query.append(SQL`, publicname=${q.publicname}`);
            if ('key' in q) query.append(SQL`, key=${q.key}`);
            // if ('calendarid' in q) query.append(SQL`, calendarid=${q.calendarid}`);
            if ('priority' in q) query.append(SQL`, priority=${q.priority}`);
            query.append(SQL` where id=${id} returning *`);
            return await this.logged.update('publiccalendars', id, q, query);
        } catch (err) { console.error(err); }
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
    const calendars = (await new CalendarsDB(req).list({ active: true, current: true }))
          .filter(c => c.ispublic || c.calling_public || (req.auth?.u && c.calling_users));
    
    return renderTemplate(tmplJsonFields({
        template: 'events',
        calendars
    }))(req, res);
});

router.get('/events/:key/map/', async (req, res) => {
    const calendarsDB = new CalendarsDB(req);
    const notesDB = new NotesDB(req);
    const questionsDB = new QuestionsDB(req);
    const tagsDB = new TagsDB(req);
    const calendar = await calendarsDB.getPublic(req.params.key);
    if (!calendar) return res.status(404).send('Not Found');
    const [shows, venues] = await Promise.all([
        calendarsDB.listShows(calendar.calendarid),
        calendarsDB.listVenues(calendar.calendarid)
    ]);
    await Promise.all(venues.map(async v => {
        const qa = await questionsDB.listAnswers({ venueid: v.id });
        for (const { fieldname, answer, ispublic } of qa) {
            if (ispublic) v[fieldname] = answer;
        }
    }));
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
    
const getScheduleOrPreview = async (req, res, key, uvid) => {
    const calendarsDB = new CalendarsDB(req);
    const notesDB = new NotesDB(req);
    const questionsDB = new QuestionsDB(req);
    const tagsDB = new TagsDB(req);
    const usersDB = new UsersDB(req);
    const venuesDB = new VenuesDB(req);
    let calendar = await calendarsDB.getPublic(key);
    let isPreview = false;
    let userid = null;
    let venueid = null;
    if (!calendar) {
        isPreview = true;
        calendar = await calendarsDB.get(key);
        if (!calendar) return res.status(404).send('Not Found');
        calendar.calendarid = calendar.id;
        userid = uvid?.split('')?.reverse('')?.join('');
        if ((!req.auth || req.auth.l > 10) &&!userid) return res.status(404).send('Not Found');
        if (userid) {
            const user = await usersDB.getByID(userid);
            if (!user) {
                venueid = userid;
                userid = null;
                const venue = await venuesDB.get(venueid);
                if (!venue) return res.status(404).send('Not Found');
            }
        }
    }
    // TODO short-duration caching
    let [
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
    if (venueid) {
        const showsByID = new Map(shows.map(s => [s.id, s]));
        shows = shows.filter(s => (s.venueid ?? showsByID.get(s.groupshowid)?.venueid) === venueid);
        proposals = proposals.filter(p => shows.some(s => s.proposalid === p.id));
        venues = venues.filter(v => v.id === venueid);
    } else if (userid) {
        const proposalsByID = new Map(proposals.map(p => [p.id, p]));
        const showsByID = new Map(shows.map(s => [s.id, s]));
        const showsByProposalID = shows.reduce((all, s) => { (all[s.proposalid] ||= []).push(s); return all }, {});
        const showsByGroupID = shows.reduce((all, s) => { (all[s.groupshowid] ||= []).push(s); return all }, {});
        proposals = proposals.filter(p =>
            p.userid === userid ||
                // parent group shows: any child by this user
            (p.isgroupshow && showsByGroupID[p.id]?.some(s => proposalsByID.get(s.proposalid)?.userid === userid)) ||
                // children of user's group shows
            (p.groupshowid && proposalsByID.get(showsByID.get(p.groupshowid)?.proposalid)?.userid === userid)
        );
        shows = shows.filter(s => proposals.some(p => p.id === s.proposalid));
        venues = venues.filter(v => shows.some(s => s.venueid === v.id));
    }
    await Promise.all([
        ...proposals.map(async p => {
            const qa = await questionsDB.listAnswers({ proposalid: p.id });
            for (const { fieldname, answer, ispublic } of qa) {
                if (ispublic) p[fieldname] = answer;
            }
        }),
        ...venues.map(async v => {
            const qa = await questionsDB.listAnswers({ venueid: v.id });
            for (const { fieldname, answer, ispublic } of qa) {
                if (ispublic) v[fieldname] = answer;
            }
        })
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
        showTags,
        isPreview
    }))(req, res);
    // TODO more SSR based on req.query (also `by: 'artist' | 'venue' | 'day')
};

router.get('/events/:key', async (req, res) => getScheduleOrPreview(req, res, req.params.key));
router.get('/events/:key/:uvid', async (req, res) => getScheduleOrPreview(req, res, req.params.key, req.params.uvid));


router.get('/', async (req, res) => {
    const calendars = await new CalendarsDB(req).list(req.query);
    if (req.headers.accept?.includes('application/json')) return res.json({ calendars });
    return renderTemplate(tmplJsonFields({ template: 'calendars', calendars }))(req, res);
});

router.get('/:id', async (req, res) => {
    const calendarsDB = new CalendarsDB(req);
    const calendar = await calendarsDB.get(req.params.id);
    if (!calendar) return res.status(404).send('Not Found');
    const deadlineOrStart = calendar.deadline || calendar.startdate;
    const pastDeadline = deadlineOrStart < new Date(new Date().getTime() + 24*60*60_000);
    let status = !calendar.active ? 'inactive'
          : calendar.ispublic ? 'public'
          : calendar.calling_public ? 'publiccall'
          : calendar.calling_users ? 'usercall'
          : 'draft';
    if (pastDeadline && status.endsWith('call')) {
        status = 'draft';
    }
    if (!req.auth || req.auth.l > 20) {
        if (!status.startsWith('public')) return res.status(403).send('Forbidden');
    }
    const canPreview = req.auth?.u && await calendarsDB.userHasShows(req.params.id, req.auth.u);
    const previewLink = canPreview ? `/calendars/events/${req.params.id}/${req.auth.u.split('')?.reverse('')?.join('')}` : null;
    if (req.headers.accept?.includes('application/json')) return res.json(calendar);
    if (pastDeadline) calendar.callforwork = null;
    calendar.name = calendar.publicname || calendar.name;
    return renderTemplate(writeLocalJsonDates({
        template: 'calendar-detail',
        calendar,
        calendarJSON: tmplJson(calendar),
        pastDeadline,
        previewLink,
        status
    }))(req, res);
});

router.get('/:id/edit', async (req, res) => {
    const calendar = await new CalendarsDB(req).get(req.params.id);
    if (!calendar) return res.status(404).send('Not Found');
    else if (!req.auth || req.auth.l > 10) return res.status(403).send('Forbidden');
    return renderTemplate(writeLocalJsonDates({
        template: 'calendar-edit',
        calendar,
        calendarJSON: tmplJson(calendar)
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
