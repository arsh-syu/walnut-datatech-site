// The questions each journey asks. Nothing about them is written into the pages or scripts:
// add, reword, reorder, switch off (`active: false`) or make one conditional here, then rebuild.
//
//   id        the key the answer is stored and sent under (camelCase; the Onboarding Tool shows it as a label)
//   audience  'university' | 'student' | 'agent' — who is asked
//   section   groups questions into a step or a block of the form
//   type      text | email | tel | url | number | textarea | select | choice (pick one) | multi (pick several)
//   options   for select / choice / multi
//   required  true to insist on an answer (only while the question is shown); `error` / `invalid` reword the messages
//   showIf / hideIf   { all: [...], any: [...] } of { field, op, value }
//             op: equals | notEquals | contains | notContains | answered
//             field: another question's id, or `services` (the service areas the university selected)
//   order     position inside its section
//
// The `university` and `contact` sections map onto the Onboarding Tool's request record
// (organisation → universityName, institutionType → universityType, name → contactName, email, phone);
// every other answer travels in the request's `form` data, so no answer is dropped.

const has = (slug) => ({ all: [{ field: 'services', op: 'contains', value: slug }] });
const YES_NO_UNSURE = ['Yes', 'No', 'Not sure yet'];

const university = [
  /* ---- requirements: asked after the services are chosen ---- */
  { id: 'onlineStatus', section: 'requirements', group: 'Your online programmes', label: 'Where are you with online programmes today?', type: 'select', required: true,
    options: ['We already run online programmes', 'We have approval and are preparing to launch', 'We are applying for approval', 'We are exploring the idea'] },
  { id: 'expectedStudents', section: 'requirements', group: 'Your online programmes', label: 'Expected students in the first year', type: 'select', required: true,
    options: ['Fewer than 500', '500 to 2,000', '2,000 to 10,000', 'More than 10,000', 'Not sure yet'] },
  { id: 'programmesPlanned', section: 'requirements', group: 'Your online programmes', label: 'Programmes you plan to offer online', type: 'text', wide: true, placeholder: 'e.g. MBA, BBA, MCA' },
  { id: 'launchTimeline', section: 'requirements', group: 'Your online programmes', label: 'When would you like to start?', type: 'choice',
    options: ['Within 3 months', '3 to 6 months', '6 to 12 months', 'Not decided'] },

  { id: 'lmsStatus', section: 'requirements', group: 'Infrastructure', label: 'Do you have a learning management system (LMS)?', type: 'select', showIf: has('infrastructure'),
    options: ['No, we need one', 'Yes, and we want to keep it', 'Yes, but we want to replace it'] },
  { id: 'lmsName', section: 'requirements', group: 'Infrastructure', label: 'Which LMS do you use?', type: 'text',
    showIf: { all: [{ field: 'services', op: 'contains', value: 'infrastructure' }, { field: 'lmsStatus', op: 'contains', value: 'Yes' }] } },

  { id: 'contentScope', section: 'requirements', group: 'Content', label: 'How much course content needs producing?', type: 'select', showIf: has('content'),
    options: ['All of it', 'Some courses', 'We have content that needs digitising', 'Not sure yet'] },

  { id: 'marketingSupport', section: 'requirements', group: 'Marketing', label: 'Which marketing support do you need?', type: 'multi', wide: true, showIf: has('marketing'),
    options: ['Digital advertising', 'Social media', 'Website and landing pages', 'Search (SEO)', 'Brand and creative'] },
  { id: 'marketingRegions', section: 'requirements', group: 'Marketing', label: 'Regions you want to reach', type: 'text', wide: true, placeholder: 'e.g. Maharashtra, pan-India, international', showIf: has('marketing') },

  { id: 'applicationsPerIntake', section: 'requirements', group: 'Admissions', label: 'Expected applications per intake', type: 'select',
    showIf: { any: [{ field: 'services', op: 'contains', value: 'admissions' }, { field: 'services', op: 'contains', value: 'counselling' }] },
    options: ['Fewer than 1,000', '1,000 to 5,000', '5,000 to 25,000', 'More than 25,000', 'Not sure yet'] },

  { id: 'examStudents', section: 'requirements', group: 'Online examinations', label: 'Students sitting each examination session', type: 'select', showIf: has('examinations'),
    options: ['Fewer than 500', '500 to 2,000', '2,000 to 10,000', 'More than 10,000', 'Not sure yet'] },
  { id: 'examFrequency', section: 'requirements', group: 'Online examinations', label: 'How often are examinations held?', type: 'select', showIf: has('examinations'),
    options: ['Every semester', 'Every trimester', 'Once a year', 'On demand'] },
  { id: 'examProctoring', section: 'requirements', group: 'Online examinations', label: 'Do you need proctored examinations?', type: 'choice', options: YES_NO_UNSURE, showIf: has('examinations') },
  { id: 'examProctoringType', section: 'requirements', group: 'Online examinations', label: 'Which kind of proctoring?', type: 'choice', options: ['AI proctoring', 'Live proctoring', 'Both'],
    showIf: { all: [{ field: 'services', op: 'contains', value: 'examinations' }, { field: 'examProctoring', op: 'equals', value: 'Yes' }] } },
  { id: 'examQuestionBank', section: 'requirements', group: 'Online examinations', label: 'Do your question banks need digitising?', type: 'choice', options: YES_NO_UNSURE, showIf: has('examinations') },
  { id: 'examResults', section: 'requirements', group: 'Online examinations', label: 'Do you need result processing and marks lists?', type: 'choice', options: YES_NO_UNSURE, showIf: has('examinations') },

  { id: 'supportChannels', section: 'requirements', group: 'Student support', label: 'How should students be able to reach support?', type: 'multi', wide: true, showIf: has('student-support'),
    options: ['Phone', 'Email', 'Chat', 'WhatsApp', 'Helpdesk tickets'] },

  { id: 'regulatoryBodies', section: 'requirements', group: 'Reporting and compliance', label: 'Which bodies do you report to?', type: 'multi', wide: true, showIf: has('compliance'),
    options: ['UGC-DEB', 'AICTE', 'NAAC', 'Academic Bank of Credits', 'Other'] },

  { id: 'automationAreas', section: 'requirements', group: 'Automation and AI', label: 'Which processes would you like to automate?', type: 'textarea', wide: true, showIf: has('automation') },

  { id: 'careerSupport', section: 'requirements', group: 'Careers', label: 'Which career support do you need?', type: 'multi', wide: true, showIf: has('careers'),
    options: ['Apprenticeships', 'Internships', 'Placements'] },

  { id: 'message', section: 'requirements', group: 'Anything else', label: 'Other requirements', type: 'textarea', wide: true, maxLength: 4000 },

  /* ---- the university ---- */
  { id: 'organisation', section: 'university', label: 'University name', type: 'text', required: true, autocomplete: 'organization', maxLength: 160, wide: true },
  { id: 'institutionType', section: 'university', label: 'University type', type: 'select', required: true,
    options: ['Central university', 'State university', 'Private university', 'Deemed-to-be university', 'Autonomous college', 'Affiliated college', 'Institute of national importance', 'Other'] },
  { id: 'establishedYear', section: 'university', label: 'Year established', type: 'number', min: 1700, max: 2100, placeholder: 'e.g. 1996', invalid: 'Please enter a four-digit year.' },
  { id: 'website', section: 'university', label: 'University website', type: 'url', autocomplete: 'url', placeholder: 'https://', wide: true },
  { id: 'address', section: 'university', label: 'Address', type: 'text', autocomplete: 'street-address', wide: true },
  { id: 'city', section: 'university', label: 'City', type: 'text', required: true, autocomplete: 'address-level2' },
  { id: 'state', section: 'university', label: 'State', type: 'text', required: true, autocomplete: 'address-level1' },
  { id: 'country', section: 'university', label: 'Country', type: 'text', required: true, autocomplete: 'country-name', value: 'India' },
  { id: 'postalCode', section: 'university', label: 'PIN / postal code', type: 'text', autocomplete: 'postal-code', maxLength: 12 },
  { id: 'accreditation', section: 'university', label: 'Accreditation and approvals', type: 'textarea', wide: true, placeholder: 'e.g. NAAC A+, UGC-DEB approval for online programmes' },

  /* ---- the primary point of contact ---- */
  { id: 'name', section: 'contact', label: 'Full name', type: 'text', required: true, autocomplete: 'name', maxLength: 120, error: 'Please enter your name.' },
  { id: 'designation', section: 'contact', label: 'Designation', type: 'text', required: true, autocomplete: 'organization-title', maxLength: 120, error: 'Please enter your designation.' },
  { id: 'email', section: 'contact', label: 'Official email', type: 'email', required: true, autocomplete: 'email', maxLength: 254, wide: true, error: 'Please enter your official email address.',
    help: 'Please provide an active official email address. This email will be used for all university onboarding communication.' },
  { id: 'phone', section: 'contact', label: 'Mobile number', type: 'tel', required: true, autocomplete: 'tel', maxLength: 40, error: 'Please enter your mobile number.' },
  { id: 'alternatePhone', section: 'contact', label: 'Alternate contact number', type: 'tel', maxLength: 40 },
];

export const questions = university.map((q, i) => ({ audience: 'university', order: i, active: true, ...q }));

// What a page embeds: the active questions for one audience, in order.
export const questionsFor = (audience) =>
  questions
    .filter((q) => q.audience === audience && q.active)
    .sort((a, b) => a.order - b.order)
    .map(({ audience: _audience, active: _active, order: _order, ...q }) => q);
