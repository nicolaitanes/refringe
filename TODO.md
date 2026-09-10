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
- [ ] iframeable monthly fullcalendar, in seeded / and /cur-events/
    - include public callforwork deadlines
- [ ] schedule preview/admin tools

## Fix/Test

- [ ] question editor
     - [ ] saving / disabled
     - [ ] <option>text</option> selected by default
     - [ ] are public responses shown anywhere? for user/proposal/venue
     - [ ] try various field types, choices
     - [ ] what about orphaned followups?
- [ ] better breadcrumbs header

## Improvements

- [ ] "my calendar" at bottom of menu
- [ ] cancelled shows
    - [ ] by calendars_proposals.status
    - [ ] by show.iscancelled
- [ ] callforwork text/links in user, public templates (iframeable for pages?)
- [ ] "upcoming event" status prior to publishing event schedule
- [ ] caching and SSR for public event schedules
- [ ] capture venue lat/long on map
- [ ] links from calendar-detail
- [ ] proposal/venue calendars status: choices / editing / filtering
- [ ] All Proposals: include inactive ones
- [ ] sortable tables/lists
- [ ] filterable tables/lists
- [ ] csv export of proposals/users/venues with q/a, tags, notes
- [ ] combine user2 into user1 (set user1.id on proposals/venues/... and deactivate user2)
    - [ ] admin/organizer select user on proposal-edit?
- [ ] content security policy?
- [ ] proposal visibility to other users?
- [ ] venue visibility to other users?
- [ ] proposal website link
- [ ] notes on calendars?
