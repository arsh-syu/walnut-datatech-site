// The questions an agent / partner answers when applying from their dashboard. They are data: add,
// reword, reorder or switch one off (`active: false`) here — the application form, its validation
// (api/account-lib.php) and the team's email all follow.
//
//   type      text | tel | url | textarea | select | choice (pick one) | multi (pick several)
//   showIf    { all: [...], any: [...] } of { field, op, value } — op: equals | notEquals | contains | answered

const organisation = { all: [{ field: 'applyingAs', op: 'equals', value: 'Organisation' }] };

export const agentQuestions = [
  { id: 'designation', group: 'About you', label: 'Designation', type: 'text' },
  { id: 'applyingAs', group: 'About you', label: 'Are you applying as an individual or an organisation?', type: 'choice', options: ['Individual', 'Organisation'], required: true },

  { id: 'organisationName', group: 'Your organisation', label: 'Organisation name', type: 'text', required: true, showIf: organisation },
  { id: 'organisationType', group: 'Your organisation', label: 'Organisation type', type: 'select', options: ['Education consultancy', 'Coaching or training institute', 'School or college', 'Recruitment or staffing firm', 'Other'], showIf: organisation },
  { id: 'organisationWebsite', group: 'Your organisation', label: 'Website', type: 'url', placeholder: 'https://', showIf: organisation },

  { id: 'city', group: 'Where you work', label: 'City', type: 'text', required: true },
  { id: 'state', group: 'Where you work', label: 'State', type: 'text', required: true },
  { id: 'coverage', group: 'Where you work', label: 'Areas you cover', type: 'text', wide: true, placeholder: 'e.g. Pune district, all of Maharashtra' },

  { id: 'experience', group: 'Your experience', label: 'Experience in student counselling or admissions', type: 'select', required: true, options: ['None yet', 'Less than 1 year', '1 to 3 years', '3 to 5 years', 'More than 5 years'] },
  { id: 'studentReach', group: 'Your experience', label: 'Students you can reach in a year', type: 'select', required: true, options: ['Fewer than 50', '50 to 200', '200 to 1,000', 'More than 1,000'] },
  { id: 'institutions', group: 'Your experience', label: 'Universities or institutions you already work with', type: 'textarea', wide: true, showIf: { all: [{ field: 'experience', op: 'notEquals', value: 'None yet' }] } },

  { id: 'interests', group: 'Working with Walnut', label: 'What are you interested in?', type: 'multi', wide: true, required: true, options: ['Online degree programmes', 'Short courses', 'Referring universities'] },
  { id: 'engagement', group: 'Working with Walnut', label: 'How much time can you give?', type: 'choice', options: ['Full time', 'Part time', 'Occasional referrals'] },
  { id: 'notes', group: 'Working with Walnut', label: 'Anything else we should know?', type: 'textarea', wide: true },
];
