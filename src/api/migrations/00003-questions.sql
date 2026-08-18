create table questions (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    ispublic bool not null default false,
    required bool not null default false,
    parentid uuid references questions(id),
    forproposal bool not null default false,
    foruser bool not null default false,
    forvenue bool not null default false,
    priority int not null default 1,
    fieldname text not null,
    fieldtype text, -- "textarea", "yesno", or null for (choices ? radio : text)
    choices jsonb, -- Array<string>
    pattern text,
    question text not null
);

create table useranswers (
    questionid uuid not null references questions(id),
    userid uuid not null references users(id),
    answer text,
    primary key(questionid, userid)
);
