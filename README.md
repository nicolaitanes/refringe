# Refringe Festival Scheduler

Built for Infringement-style community festivals: a week(end) of events proposed by community members, scheduled at various venues and communicated to artists and the public.jk;

## What's not included (yet -- exercises for the reader)

- Painless image hosting: You could add assets by committing them under `src/static/`, but there's no way to e.g. configure and use blob storage.
- Social media: at least you can enter embed codes in custom pages.

## Local development

Prerequisites:

- docker / podman

```
docker compose up -d
```

- gnu make (optional): more useful shell commands in the Makefile

## Deployment (TODO fill this out)

- get a (sub-)domain name
- get smtp credentials
- TODO: howto configure?
- visit /welcome, create the admin account
- menu -> configure -> Pages -> (site-name): rename the site
- css in the header
- opengraph tags (link previews)

## Data structure

0. Migrations and Seeds
    - pgsql is initalized (sql-initdb.d/) with `migrations` and `seeds` tables
    - at startup, the nodejs server looks for new .sql files in `src/api/migrations`, runs them, and adds them to the table
        - e.g. adding tables or columns
    - same thing for `src/api/seeds` -- initial data rows
1. Users
    - with role of level 0:Admin / 10:Organizer / 20:User (/ 30+:Public)
    - cached with `revocation` that gets incremented on edit (logs out stale sessions)
3. Questions
    - custom fields for various types (user, proposal, venue)
    - `fieldtype: 'textarea'` is interpreted as (safe) markdown
4. Proposals
    - users can propose multiple (templates for) events
5. Venues
    - users can propose multiple venues (that they can vouch for)
6. Pages
    - Organizers can edit the home page and add other pages with a mix of markdown and html
    - Organizers can also customize the site name, header and footer html, and opengraph markdown
7. Calendars
    - Organizers can set up festival schedules ("calendars")
    - and manage public visibility and deadlines
    - and email artists
    - users can opt their proposals and/or venues in for some or all available calendars
    - organizers can schedule instances of proposals ("shows") at venues
    - a show can be a "group show" with member shows
    - and/or an "installation" with no set times
8. Notes
    - Organizers can leave running comments on any proposal, show, user, venue
    - click the icon to expand the sidebar
    - notes can be marked "visible to public" and they'll show up on the public schedule
9. Tags:
    - Organizers can mark proposals, shows, users, venues with a tag (label and/or emoji)
    - a tag can be public, or for organizers only
    - a tag can be a filter (e.g. Music, or a private category used while building the schedule)
    - a tag can be a "dispersed group show" if it matches the name of a group show, to link shows at different venues

## API structure

1. index.mjs: entrypoint

    - `--origin https://myorigin.com`, `-o https://myorigin.com`
    
2. pages.js: renders matching paths from the `pages` table

- e.g. the front page (`/`) and a few other basic ones (`/about/`, `/contact/`, `/cur-events/`)

3. auth.js: login token management for all endpoints except the `pages`

    - `rfa`: signed cookie
        - u: user id
        - d: timestamp issued; expires after 5 minutes
        - l: user.role.level
        - r: revocation; expires if database user's revocation is greater
    - makes cookie fields available as `req.auth`
    - noauthAllowList: urls that can be requested without login
    - levelRestricted: urls that require advanced role.level
    -  Endpoints:
        - login form: GET /login
        - log in: POST /auth (multipart/mime) { username, password }
        - log out: GET /logout
        - invalidate other device logins: POST /revoke
        - first time admin signup form: GET /welcome
        - first time admin: POST /setup
        - new user form: GET /signup
        - new user: POST /user (multipart/mime)
        - user management: GET /users
        - user edit form: GET /users/:id
        - user edit: POST /user/:id (multipart/mime)

4. sub-routers: calendars/, notes/, pages/, proposals/, questions/, tags/, venues/

5. templates.js: renders pages (and fragments) via handlebars, from src/api/templates/

- header.html has common prefix imported by (most) template pages
- for non-organizer forms and schedules we prefer js-optional standard forms with multipart/mime request bodies

6. vue.js templates for interactive controls

- mainly for organizers; e.g. configuration and scheduling
- "no-build" (CDN) style -- `.js` files with `export default { setup, ... }` instead of `<script setup>`, `.html`, or `.vue`; and `snake-cased` attributes where JS is `camelCased`
- all components/utils registered in the import map in src/api/templates/header.html
- use `delimiters: ['[[', ']]']` to avoid clashing with handlebars api-side templates
- use `<template v-if>` / `<template v-for>` to avoid a flash of half-empty content

## Dependencies

### nginx

Public server for static files, reverse proxy for dynamic pages.

### letsencrypt

HTTPS certificate (TODO)

### pgsql

Database

### node.js

Server runtime; packages:

- bcrypt: user passwords
- compression: gzip
- cookie-parser: session cookies
- cors
- date-fns
- express: http server
- handlebars: html templates
- multer: forms
- pg: database connection
- showdown: markdown formatting
- sql-template-strings: injection protection
- yargs: command line args

### vue.js

Interactive templates

