create table users (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    username text not null,
    passhash text not null,
    revocation int not null default 1,
    fullname text,
    phone text,
    email text
);

create table hats (
    id uuid default uuidv7() primary key,
    parentid uuid,
    active bool default true,
    shareable bool default false,
    hatname text,
    visible bool default true,
    voluntary bool default false
);

create table hatgrants (
    hatid uuid not null,
    grantsid uuid not null,
    primary key(hatid, grantsid)
);

create table userhats (
    userid uuid not null,
    hatid uuid not null,
    primary key(userid, hatid)
);
