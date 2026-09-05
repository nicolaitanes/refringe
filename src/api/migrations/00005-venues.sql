create table venues (
    id uuid default uuidv7() primary key,
    userid uuid not null references users(id),
    active bool not null default true,
    allcalendars bool not null default false,
    name text not null,
    owner text not null,
    address text not null,
    city text,
    state text,
    zip text,
    latitude float,
    longitude float,
    phone text,
    email text,
    contactperson text not null,
    referralphone text not null,
    website text,
    updated timestamptz not null default now()
);

create table venueanswers (
    venueid uuid not null references venues(id),
    questionid uuid not null references questions(id),
    answer text not null,
    primary key (venueid, questionid)
);
