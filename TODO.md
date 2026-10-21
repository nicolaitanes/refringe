# TODO

## Features

- [ ] email
    - [ ] new users: confirmation
        - [ ] add user.email_confirmed
        - [ ] policy for id (created) + days should/must confirm
    - [ ] proposals to proposers (on add/edit)
    - [ ] venues to creator (on add/edit)
    - [ ] draft schedule (links) to all proposers / one proposer on a calendar
    - [ ] mass email to proposers on a calendar
    - [ ] configure which admins get bcc (all, initially?)
- [ ] schedule preview/admin tools

## Improvements

- [ ] links from calendar-detail
    - [ ] public schedule
    - [ ] "my" schedule (preview)
    - [ ] new proposal
- [ ] better breadcrumbs header
- [ ] markdown instructions / cheat sheet link (pages, question[type="textarea"])
- [ ] "my calendar" at bottom of menu
- [ ] cancelled shows
    - [ ] by calendars_proposals.status
    - [ ] by show.iscancelled
- [ ] table improvements
    - [ ] sortable tables/lists
    - [ ] filterable tables/lists
    - [ ] csv export of proposals/users/venues with q/a, tags, notes
- [ ] combine user2 into user1 (set user1.id on proposals/venues/... and deactivate user2)
    - [ ] admin/organizer select user on proposal-edit?
- [ ] "upcoming event" status prior to publishing event schedule
    - on calendar, public detail with name/notes; no schedule yet
- [ ] event logging
    - [ ] timestamps in event log
    - [ ] replace password with passhash (or just redact?) in event log?
- [ ] caching and SSR for public event schedules
- [ ] capture venue lat/long on map
- [ ] proposal/venue calendars status: choices / editing / filtering
- [ ] All Proposals: include inactive ones
- [ ] content security policy?
- [ ] proposal visibility to other users?
- [ ] venue visibility to other users?
- [ ] proposal website link
- [ ] notes on calendars?
- [ ] question editor
     - [ ] saving / disabled
     - [ ] are public responses shown anywhere? for user/proposal/venue
     - [ ] what about orphaned followups?
