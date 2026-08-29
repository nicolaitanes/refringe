create table calendars (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    name text not null,
    notes text not null,
    startdate date,
    enddate date,
    deadline date,
    callforwork text,
    calling_public bool not null default false,
    calling_users bool not null default false,
    updated timestamptz not null default now()
);

create table publiccalendars (
    id uuid default uuidv7() primary key,
    publicname text not null,
    key text not null,
    calendarid uuid not null references calendars(id),
    ispublic bool not null default true,
    priority integer not null default 100,
    updated timestamptz not null default now()
);

create table calendars_proposals (
    calendarid uuid not null references calendars(id),
    proposalid uuid not null references proposals(id),
    active bool not null default true,
    status text not null default 'unconfirmed',
    primary key(calendarid, proposalid)
);

create table calendars_venues (
    calendarid uuid not null references calendars(id),
    venueid uuid not null references venues(id),
    active bool not null default true,
    status text not null default 'unconfirmed',
    primary key(calendarid, venueid)
);

create table shows (
    id uuid default uuidv7() primary key,
    active bool not null default true,
    calendarid uuid not null references calendars(id),
    proposalid uuid not null references proposals(id),
    isinstallation bool not null default false,
    isgroup bool not null default false,
    groupshowid uuid references shows(id),
    venueid uuid references venues(id),
    dateonly date,
    starttime time without time zone,
    endtime time without time zone,
    updated timestamptz not null default now()
);
