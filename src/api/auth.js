import { renderTemplate } from './templates.js';
import { questionsDB } from './questions.js';
import { usersDB } from './users.js';
import multer from 'multer';

const upload = multer();

const noauthAllowList = new Set([
    '/',
    '/auth',
    '/index',
    '/login',
    '/logout',
    '/setup',
    '/signup',
    '/user',
    '/welcome'
]);

const levelRestricted = {
    '/calendars': 10, // organizer+
    '/calendars/public': 10, // organizer+
    '/config': 10,
    '/pages': 10,
    '/questions': 10,
    '/tags': 10,
    '/testdb': 0, // admin+
    '/users': 10,
    '/venues': 10
};

const issueCookie = (req, res, body) => {
    const auth = {
        ...body,
        d: new Date().getTime()
    };
    const cookie = JSON.stringify(auth);
    res.cookie('rfa', cookie, { signed: true });
    req.auth = auth;
    return auth;
};

export const initAuth = app => {
    app.use(async (req, res) => {
        const cookie = req.signedCookies.rfa;
        if (cookie) {
            try {
                const auth = JSON.parse(cookie);
                // TODO check user in cache etc.
                req.auth = auth;
                if (noauthAllowList.has(req.path)) return req.next();
        
                if (!auth?.u) return res.redirect(303, '/');
                
                if (!auth?.d || (auth.d + 5 * 60 * 1000) < new Date().getTime()) {
                    try {
                        const user = await usersDB.getByID(auth.u);
                        if (!user || user.revocation > auth.r) return res.redirect(303, '/logout');
                        req.auth = issueCookie(req, res, auth);
                    } catch (err) {
                        console.log(err);
                    }
                }
                const reqLevel = levelRestricted[req.path];
                if (reqLevel !== undefined && (auth.l ?? 999999) > reqLevel) {
                    return res.redirect(303, '/');
                }
                // TODO re-cache user details
                return req.next();
            } catch (err) {
                console.log(err);
            }
        }
        
        if (noauthAllowList.has(req.path)) return req.next();
        res.redirect(303, '/');
    });
    
    app.post('/auth', upload.none(), async (req, res) => {
        if (!req.body.password) return res.redirect(303, '/login');
        
        const user = await usersDB.getByName(req.body.username, req.body.password);
        if (!user?.active) return res.redirect(303, '/login');
        
        issueCookie(req, res, {
            u: user.id,
            l: user.level,
            n: user.username,
            r: user.revocation
        });
        res.redirect(303, '/menu');
    });
    
    app.post('/revoke', async (req, res) => {
        req.auth.r = await usersDB.revokeOtherDevices(req.auth.u);
        issueCookie(req, res, req.auth);
        res.redirect(303, '/menu');
    });

    app.get('/login', (req, res) => {
        if (req.auth?.u) return res.redirect(303, '/menu');
        return renderTemplate({ template: 'login' })(req, res);
    });
    
    app.get('/logout', (req, res) => {
        issueCookie(req, res, {});
        res.redirect(303, '/');
    });
    
    app.get('/signup', (req, res) => {
        if (req.auth?.u) return res.redirect(303, '/menu');
        return renderTemplate({ template: 'signup' })(req, res);
    });
    
    // TODO update revocation on user password change
    
    app.get('/welcome', async (req, res) => {
        if (await usersDB.count()) return res.redirect(303, '/login');
        return renderTemplate({ template: 'welcome' })(req, res);
    });
    
    app.post('/setup', upload.none(), async (req, res) => {
        if (await usersDB.count()) return res.redirect(303, '/login');
        const roleid = await usersDB.findRoleID(0);
        const user = await usersDB.create({
            username: req.body.username,
            password: req.body.password,
            fullname: 'Admin',
            roleid
        });
        if (!user) return res.redirect(303, '/login');
        
        req.auth = issueCookie(req, res, {
            u: user.id,
            n: user.username,
            l: 0,
            r: user.revocation
        });
        res.redirect(303, '/menu');
    });
    
    app.get('/users', async (req, res) => {
        if (req.auth.l > 10) return res.status(403).send('Forbidden');
        const users = await usersDB.list();
        for (const u of users) {
            u.role = u.level === 0 ? 'Admin' : u.level === 10 ? 'Organizer' : 'Proposer';
            u.phone = u.phone || '';
            u.email = u.email || '';
        }
        await Promise.all(users.map(async u => {
            u.questions = await questionsDB.listAnswers({ userid: u.id });
        }));
        return renderTemplate({ users, template: 'users' })(req, res);
    });
    
    app.get('/user/:id', async (req, res) => {
        const user = await usersDB.getByID(req.params.id);
        if (!user) return res.status(404).send('Not found');
        const roles = await usersDB.listRoles();
        const answers = await questionsDB.listAnswers({ userid: user.id });
        const isSelf = req.params.id === req.auth.u;
        const canEdit = req.auth.l === 0 || isSelf;
        return renderTemplate({
            isSelf,
            user,
            roles,
            answers,
            message: req.query.saved ? 'Changes saved successfully' : '',
            severity: 'success',
            template: canEdit ? 'user-edit' : 'user-detail'
        })(req, res);
    });
    
    app.post('/user', upload.none(), async (req, res) => {
        const questions = await questionsDB.list({ active: true, foruser: true });
        const renderError = message => renderTemplate({
            message,
            severity: 'error',
            template: 'signup',
            user: req.body,
            answers: questions.map(q => ({ ...q, answer: req.body[q.fieldname] }))
        })(req, res);
        
        if (req.body.robot !== 'decal') return renderError('Are you a robot?');

        if (await usersDB.getByName(req.body.username)) return renderError(`The username ${req.body.username} is already taken.`);
        
        const roleid = req.auth.l === 0 && req.roleid
              ? req.body.roleid
              : await usersDB.findRoleID(20);
        const user = await usersDB.create({
            username: req.body.username,
            password: req.body.password,
            fullname: req.body.fullname,
            roleid
        });
        if (!user) return res.status(500).send('Error');
        if (!req.auth.u) {
            req.auth = issueCookie(req, res, {
                u: user.id,
                n: user.username,
                l: 20,
                r: user.revocation
            });
        }

        await Promise.all(questions.map(async (q) => {
            if (q.fieldname in req.body && req.body[q.fieldname]) {
                await questionsDB.addOrUpdateAnswer({ questionid: q.id, userid: user.id, answer: req.body[q.fieldname] });
            }
        }));

        res.redirect(303, '/menu');
    });
    
    app.post('/user/:id', upload.none(), async (req, res) => {
        const id = req.params.id ?? null;
        if (req.auth.l > 0 && id !== req.auth.u) return res.status(403).send('Forbidden');
        
        const isAdmin = req.body.id !== req.auth.u; // meaning here: administering another user -- can't change own roleid or active
        const answers = await questionsDB.listAnswers({ userid: id });
        const roles = await usersDB.listRoles();
        const renderError = message => {
            const { passwordChange, confirmPassword, ...user } = req.body;
            user.id = id;
            return renderTemplate({
                message,
                severity: 'error',
                template: 'user-edit',
                isAdmin,
                user,
                roles,
                answers: answers.map(q => ({ ...q, answer: req.body[q.fieldname] }))
            })(req, res);
        };
        
        if (!req.body.fullname.trim()) return renderError('Name is required');
        
        if (id && (req.body.passwordChange || req.body.passwordConfirm)) {
            if (req.body.passwordChange !== req.body.passwordConfirm) return renderError('Passwords do not match');
            await usersDB.updatePassword(id, req.body.passwordChange);
            if (req.auth.u === id) {
                req.auth.r = await usersDB.revokeOtherDevices(req.auth.u);
                issueCookie(req, res, req.auth);
            }
        }
        
        await usersDB.update(id, {
            fullname: req.body.fullname.trim(),
            phone: req.body.phone || null,
            email: req.body.email || null,
            ...(req.auth.l === 0
                ? {
                    active: ['true', 'on'].includes(req.body.active),
                    roleid: req.body.roleid
                }
                : {}
               )
        });

        await Promise.all(answers.map(async (q) => {
            if (q.fieldname in req.body && (req.body[q.fieldname] || null) !== q.answer) {
                await questionsDB.addOrUpdateAnswer({ questionid: q.id, userid: id, answer: req.body[q.fieldname] });
            }
        }));
        
        res.redirect(303, '/user/' + id + '?saved=1');
    });
};
