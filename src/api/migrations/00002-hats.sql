create table hats (
    id uuid default uuidv7() primary key,
    active bool default true,
    name text,
    level int not null default 0,
    visible bool default true
);

create table userhats (
    userid uuid not null references users(id),
    hatid uuid not null references hats(id),
    primary key(userid, hatid)
);
