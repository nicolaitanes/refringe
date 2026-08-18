create table proposals (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    userid uuid not null references users(id),
    title text not null,
    status text not null default 'draft',
    updated timestamptz not null default now()
);

create table proposalanswers (
    proposalid uuid not null references proposals(id),
    questionid uuid not null references questions(id),
    answer text not null,
    primary key (proposalid, questionid)
);
