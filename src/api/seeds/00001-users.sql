insert into hats (hatname, shareable, visible) values ('Admin', true, false);
-- Admin can grant Admin
insert into hatgrants (hatid, grantsid) select id, id from hats where hatname = 'Admin' limit 1;
