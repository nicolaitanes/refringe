create table pages (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    urlpath text not null,
    content text not null,
    updated timestamptz not null default now()
);
