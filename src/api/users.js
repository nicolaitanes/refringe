import bcrypt from 'bcrypt';
import SQL from 'sql-template-strings'
import { logged, pgdb } from './pgdb.js';

const saltRounds = 12;

export class UsersDB {
    constructor(req) {
        this.logged = logged(req);
    }
    async getByID(id) {
        const userResult = await pgdb.query(SQL`select u.*, level from users u join roles r on u.roleid = r.id where u.id=${id} limit 1`);
        return userResult.rows[0];
    }
    async getByName(username, password) {
        const userResult = await pgdb.query(SQL`select u.*, level from users u join roles r on u.roleid = r.id where u.username=${username} limit 1`);
        const user = userResult.rows[0];
        if (!user?.id) return null;
        if (password && ! await bcrypt.compare(password, user.passhash)) return null;
        user.passhash = '';
        return user;
    }
    async count() {
        const usersResult = await pgdb.query('select count(1) as n from users');
        return +usersResult.rows[0].n;
    }
    async create(userdata) {
        const passhash = await bcrypt.hash(userdata.password, saltRounds);
        return await this.logged.add('users', userdata, SQL`insert into users
            (username, roleid, passhash, fullname, phone, email, street, city, state, zip)
            values (${userdata.username}, ${userdata.roleid}, ${passhash}, ${userdata.fullname}, ${userdata.phone}, ${userdata.email}, ${userdata.street}, ${userdata.city}, ${userdata.state}, ${userdata.zip})
            returning *`);
    }
    async list() {
        const result = await pgdb.query(SQL`select u.id, u.active, r.level, u.username, u.fullname, u.phone, u.email, u.street, u.city, u.state, u.zip from users u join roles r on u.roleid = r.id order by u.active desc, u.fullname`);
        return result.rows;
    }
    async update(id, userdata) {
        const query = SQL`update users set fullname=${userdata.fullname}, phone=${userdata.phone}, email=${userdata.email}, street=${userdata.street}, city=${userdata.city}, state=${userdata.state}, zip=${userdata.zip}`;
        if ('roleid' in userdata) query.append(SQL`, roleid=${userdata.roleid}, active=${userdata.active}`);
        query.append(SQL` where id=${id}`);
        return await this.logged.update('users', id, userdata, query);
    }
    async updatePassword(id, password) {
        const passhash = await bcrypt.hash(password, saltRounds);
        await this.logged.update('users', id, { passhash }, SQL`update users set passhash=${passhash} where id = ${id}`);
    }
    async revokeOtherDevices(id) {
        const result = await this.logged.update('users', id, { revocation: "+1" }, SQL`update users set revocation = revocation + 1 where id=${id} returning revocation`);
        return result.revocation;
    }
    async findRoleID(level) {
        // TODO cache for a little while
        const result = await pgdb.query(SQL`select id from roles where level=${level} limit 1`);
        return result.rows[0]?.id;
    }
    async listRoles() {
        // TODO cache
        const result = await pgdb.query(SQL`select * from roles order by level`);
        return result.rows;
    }
}
