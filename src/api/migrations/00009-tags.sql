create table tags (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    name text not null,
    emoji text not null,
    description text,
    is_visible_to_public bool not null default false,
    created_by_userid uuid null references users(id)
);

create table tags_proposals (
    tagid uuid not null references tags(id),
    proposalid uuid not null references proposals(id),
    primary key(tagid, proposalid)
);

create table tags_shows (
    tagid uuid not null references tags(id),
    showid uuid not null references shows(id),
    primary key(tagid, showid)
);

create table tags_users (
    tagid uuid not null references tags(id),
    userid uuid not null references users(id),
    primary key(tagid, userid)
);

create table tags_venues (
    tagid uuid not null references tags(id),
    venueid uuid not null references venues(id),
    primary key(tagid, venueid)
);

