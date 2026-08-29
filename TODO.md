# TODO

## Definitely

- [ ] tags
    - [x] db
    - [x] api
    - [x] tag components
    - [ ] tag editing
    - [ ] tags on proposals, users, venues
- [ ] notes
    - [x] db
    - [x] api
    - [x] note components
    - [ ] org. notes on proposals, users, venues
- [ ] calendars
    - [ ] db
        - [x] ported
        - [ ] deadline
        - [ ] call_for_work
        - [ ] calling_public
        - [ ] calling_proposers
        - [ ] calendars_proposals with status (no proposal status)
        - [ ] calendars_venues with status
        - [ ] {calendar, venue}.for_future_calendars
    - [ ] api
    - [ ] components
        - [ ] port calendar editing
        - [ ] {proposal, venue} check all events that apply
            - notpast+calling, already linked, for_future_calendars
        - [ ] iframeable monthly fullcalendar, in seeded / and /cur-events/
- [ ] schedule output
- [ ] schedule preview/admin tools
- [ ] schedule addons
    - [ ] cancelled shows
    - [ ] .
- [ ] email
    - [ ] new users
    - [ ] proposals to proposers
    - [ ] venues to creator
    - [ ] email a single proposer, e.g. draft schedule, when status changes, etc.
    - [ ] mass email to proposers on a calendar

## Refinements

- [x] toggle cleartext password
- [x] prevent double-submit
- [ ] better breadcrumbs
- [ ] question editor
     - [ ] layout
     - [ ] saving / disabled
     - [ ] !q.active / strikethrough
     - [ ] <option>text</option> selected by default
     - [ ] try various field types, choices
     - [ ] try followups
     - [ ] what about orphan followups?
     - [ ] are public responses shown anywhere? for user/proposal/venue

## Good ideas

- [ ] sortable tables/lists
- [ ] filterable tables/lists
- [ ] full table of {proposal | venue} with q/a, tags, notes
- [ ] csv export of proposals/users/venues with q/a, tags, notes
- [ ] combine user2 into user1 (set user1.id on proposals/venues/... and deactivate user2)
- [ ] capture venue lat/long on map
- [ ] constrain `pattern`
- [ ] proposal visibility to other users (by status?)
- [ ] venue visibility to other users (by status?)
- [ ] proposal website link
- [ ] .
