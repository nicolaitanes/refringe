insert into questions (required, ispublic, forproposal, foruser, priority, fieldname, fieldtype, choices, pattern, question) values
    (true, false, true, false, 1, 'firstName', null, null, null, 'First Name'),
    (true, false, true, false, 2, 'lastName', null, null, null, 'Last Name'),
    (true, false, true, false, 3, 'email', null, null, '^\S+@\S+$', 'Email'),
    (true, false, true, false, 4, 'disciplines', 'textarea', null, null, 'Discipline(s)
e.g.: Music, Theatre, Visual Arts, Film/Video, Movement/Dance, Literary, Workshop, Improv, Other (list all that apply)'),
    (true, false, true, false, 5, 'genres', 'textarea', null, null, 'Genre(s) Within Your Discipline(s) e.g.: ballet or fire spinning for movement; R&B or jazz for music; live painting, watercolors for visual art. If you work across multiple disciplines--such as movement/theatre or music/visual art--please list the genre and sub-genre for each discipline.'),
    (true, true, true, false, 6, 'description', 'textarea', null, null, 'Proposal Description'),
    (false, false, true, false, 7, 'workSamples', 'textarea', null, null, 'Work Sample Links (1-3)
Share one to three links to examples of your work (if available).'),
    (true, false, true, false, 8, 'equipUsed', 'textarea', null, null, 'Equipment You Use -- Describe the equipment you use to present your work. Be specific.'),
    (true, false, true, false, 9, 'equipNeeds', 'textarea', null, null, 'Equipment You Need Provided by Us e.g.: electricity, sound setup, lighting, Wi-Fi, wall space, floor space, carpet, projector, amplifier, etc.'),
    (false, false, true, false, 10, 'canProvide', 'textarea', null, null, 'Equipment You Could Provide
e.g.: sound gear, lighting gear, pop-up tent.'),
    (true, false, true, false, 11, 'spacereq', 'textarea', null, null, 'How much space do you need to present your work?'),
    (true, false, true, false, 12, 'wantcollab', 'yesno', null, null, 'Open to Collaboration?'),
    (false, false, true, false, 13, 'whichcollab', null, null, null, 'If Yes, What Collaborations Interest You?
Only answer this if you selected YES on the previous question.'),
    (true, false, true, false, 14, 'availability', 'textarea', null, null, 'AVAILABILITY -- Be as specific as possible.'),

    (true, true, false, true, 1, 'bio', 'textarea', null, null, 'Bio (public)');
