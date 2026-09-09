# TODO

## Deploy test site

- [x] nginx conf
- [ ] dns for refringe.mandelics.com
- [ ] publish to github
- [ ] clone sxs with mandelics-site
- [ ] deploy mandelics-site/docker-compose with customizations

## Features

- [ ] email
    - [ ] new users: confirmation
        - [ ] add user.email_confirmed
        - [ ] policy for id (created) + days should/must confirm
    - [ ] proposals to proposers
    - [ ] venues to creator
    - [ ] email a single proposer, e.g. draft schedule, when status changes, etc.
    - [ ] mass email to proposers on a calendar
- [ ] iframeable monthly fullcalendar, in seeded / and /cur-events/
    - include public callforwork deadlines
- [ ] schedule preview/admin tools
    
## Fix

- [ ] test and improve question editor
     - [ ] fix followups
     - [ ] layout
     - [ ] saving / disabled
     - [ ] !q.active / strikethrough
     - [ ] <option>text</option> selected by default
     - [ ] are public responses shown anywhere? for user/proposal/venue
     - [ ] try various field types, choices
     - [ ] what about orphaned followups?

## Improvements

- [ ] cancelled shows
    - [ ] by calendars_proposals.status
    - [ ] by show.iscancelled
- [ ] callforwork text/links in user, public templates (iframeable for pages?)
- [ ] "upcoming event" status prior to publishing event schedule
- [ ] caching and SSR for public event schedules
- [ ] capture venue lat/long on map
- [ ] better breadcrumbs
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
