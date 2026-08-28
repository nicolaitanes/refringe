create table notes (
    id uuid default uuidv7() primary key,
    content text not null,
    is_visible_to_organizers bool not null default true,
    is_visible_to_proposers bool not null default false,
    is_visible_to_public bool not null default false,
    is_hidden bool not null default false,
    created_by_userid uuid not null references users(id),
    updated timestamptz not null default now()
);

create table notes_proposals (
    noteid uuid not null references notes(id),
    proposalid uuid not null references proposals(id),
    primary key(noteid, proposalid)
);

create table notes_shows (
    noteid uuid not null references notes(id),
    showid uuid not null references shows(id),
    primary key(noteid, showid)
);

create table notes_users (
    noteid uuid not null references notes(id),
    userid uuid not null references users(id),
    primary key(noteid, userid)
);

create table notes_venues (
    noteid uuid not null references notes(id),
    venueid uuid not null references venues(id),
    primary key(noteid, venueid)
);

