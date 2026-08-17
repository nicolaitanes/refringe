create table questions (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    ispublic bool not null default false,
    required bool not null default false,
    parentid uuid references questions(id),
    forproposal bool not null default true,
    foruser bool not null default true,
    forvenue bool not null default false,
    priority int not null default 1,
    fieldname text not null,
    fieldtype text,
    choices jsonb,
    pattern text,
    question text not null
);

create table useranswers (
    questionid uuid not null references question(id),
    userid uuid not null references users(id),
    answer text,
    primary key(questionid, userid)
);
