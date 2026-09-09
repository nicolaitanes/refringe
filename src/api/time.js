export function readLocalJsonDates(obj) {
    if (!obj) return obj;
    const result = { ...obj };
    for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) {
            result[k] = v.map(vv => vv && typeof vv === 'object' ? readLocalJsonDates(vv) : vv);
        } else if (v && typeof v === 'object') {
            result[k] = readLocalJsonDates(v);
        } else if (/^\d\d\d\d-\d\d-\d\d/.test(v)) {
            result[k] = Date.parse(v);
        }
    }
    return result;
}

export function writeLocalJsonDates(obj) {
    if (Array.isArray(obj)) return obj.map(writeLocalJsonDates);
    const result = { ...obj };
    for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) {
            result[k] = v.map(vv => vv && typeof vv === 'object' ? writeLocalJsonDates(vv) : vv);
        } else if (v instanceof Date) {
            const cutPoint = k.includes('updated') ? undefined : k.toLowerCase().includes('date') || k.toLowerCase().includes('deadline') ? 10 : 19;
            result[k] = v.toISOString().slice(0, cutPoint);
        } else if (v && typeof v === 'object') {
            result[k] = writeLocalJsonDates(v);
        }
    }
    return result;
}

export function localJsonDates(req, res) {
    req.body = readLocalJsonDates(req.body);
    const resJson = res.json.bind(res);
    res.json = obj => resJson(writeLocalJsonDates(obj));
    req.next();
}

export const tmplJson = x => typeof x === 'string' ? x : JSON.stringify(writeLocalJsonDates(x)).replace(/\\/g, '\\\\');

export const tmplJsonFields = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, tmplJson(v)]));

