create table proposals (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    allcalendars bool not null default false,
    userid uuid not null references users(id),
    title text not null,
    updated timestamptz not null default now()
);

create table proposalanswers (
    proposalid uuid not null references proposals(id),
    questionid uuid not null references questions(id),
    answer text not null,
    primary key (proposalid, questionid)
);
