import { promises as fsp } from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

const templates = {};
export const initTemplates = async (templatePath) => {
    const templateDir = await fsp.readdir('./templates');
    for (const fn of templateDir) {
        const { name } = /^(?<name>.*).html$/.exec(fn)?.groups ?? {};
        if (!name) continue;
        const txt = await fsp.readFile(path.join('./templates', fn), { encoding: 'utf-8' });
        templates[name] = Handlebars.compile(txt);
        Handlebars.registerPartial(name, templates[name]);
    }
};

export const renderTemplate = context => (req, res) => {
    let template = templates[context?.template || req.params.template || 'index'];
    if (!template) return res.redirect(303, '/');
    const status = template ? 200 : 404;
    template ??= templates['404'];
    const fullContext = {
        isAdmin: req.auth && req.auth.l === 0,
        isOrg: req.auth && req.auth.l <= 10,
        ...(context ?? {}),
        path: req.params.template,
        auth: req.auth
    };
    const html = template(fullContext);
    res.set('Content-Type', 'text/html');
    res.status(status).send(Buffer.from(html));
};

