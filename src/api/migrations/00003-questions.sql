create table questions (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    required bool not null default false,
    forproposal bool not null default true,
    forvenue bool not null default false,
    priority int not null default 1,
    fieldname text not null,
    fieldtype text,
    choices jsonb,
    pattern text,
    question text not null
);
