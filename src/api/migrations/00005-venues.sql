create table venues (
    id uuid default uuidv7() primary key,
    userid uuid not null references users(id),
    active bool not null default true,
    name text not null,
    status text not null default 'unconfirmed',
    address text not null,
    city text,
    state text,
    zip text,
    latitude float,
    longitude float,
    phone text,
    email text,
    website text,
    updated timestamptz not null default now()
);

create table venueanswers (
    venueid uuid not null references venues(id),
    questionid uuid not null references questions(id),
    answer text not null,
    primary key (venueid, questionid)
);
