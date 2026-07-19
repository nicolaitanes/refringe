create table roles (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    name text not null,
    level int not null
);

create table users (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    roleid uuid not null references roles(id),
    username text not null,
    passhash text not null,
    revocation int not null default 1,
    fullname text,
    phone text,
    email text
);
