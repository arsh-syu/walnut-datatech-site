// Service catalogue — the single source of truth for the Solutions pages and the configurator.
// Reorganised from the original services CSV: grouped into a programme lifecycle,
// duplicates merged, and the loose marketing rows gathered into their own service area.
//
// Pricing: set `revSharePct` (number, % of programme revenue) and/or `oneTimePrice`
// (number, INR) on any module. While they are null the site shows "shared in your proposal";
// once every selected module has a value the configurator totals them automatically.

const m = (id, title, desc, pricing = {}) => ({
  id,
  title,
  desc,
  revSharePct: pricing.revSharePct ?? null,
  oneTimePrice: pricing.oneTimePrice ?? null,
});

export const stages = [
  { id: 'setup', n: '01', name: 'Set up', line: 'Build the digital campus' },
  { id: 'enrol', n: '02', name: 'Enrol', line: 'Reach, advise and admit students' },
  { id: 'run', n: '03', name: 'Run', line: 'Assess, support and stay compliant' },
  { id: 'outcomes', n: '04', name: 'Outcomes', line: 'Turn learning into careers' },
];

export const areas = [
  {
    slug: 'infrastructure',
    stage: 'setup',
    name: 'Infrastructure Set-up',
    short: 'Infrastructure',
    tagline: 'The cloud foundation your online campus runs on.',
    summary:
      'We set up, host and manage the full technology stack for your online programmes — data centre, core systems, website, mobile app, payments, messaging and virtual classrooms.',
    items: [
      m('cloud', 'Cloud data centre', 'Cloud-based data centre set-up and ongoing maintenance.'),
      m('core-systems', 'Integrated admissions, student and learning systems', 'Admissions Management and Student Management Systems, integrated with the Learning Management System and managed day to day.'),
      m('website', 'University website for online programmes', 'A dedicated website for your online programmes, set up and maintained.'),
      m('mobile', 'Mobile learning platform', 'A mobile learning platform that we set up, maintain and upgrade.'),
      m('payments', 'Admission and fee payment gateway', 'Payment gateway for admissions and fees, set up and managed day to day.'),
      m('messaging', 'Messaging platform', 'SMS, email and WhatsApp-style messaging for your online programmes.'),
      m('virtual-classroom', 'Virtual classroom infrastructure', 'The infrastructure your faculty need to teach live online.'),
      m('data', 'Data storage on your terms', 'Data stored in accordance with the University’s requirements and mutually agreed terms.'),
    ],
  },
  {
    slug: 'content',
    stage: 'setup',
    name: 'Content Creation & Set-up',
    short: 'Content',
    tagline: 'Faculty knowledge, turned into digital learning.',
    summary:
      'From raw material to a complete online course — we digitise, record, customise and host learning content built with your own faculty and aligned to your syllabus.',
    items: [
      m('digitise', 'Content digitisation', 'Raw content provided by University faculty, converted into digital learning material.'),
      m('access', 'Access through LMS and mobile app', 'Digital content delivered through the LMS and mobile application, in accordance with UGC Regulations.'),
      m('video', 'Video recording and production', 'Recording, editing, uploading and management of video content using University faculty resources.'),
      m('existing-video', 'Existing video, made available', 'Your existing video content published to students through digital platforms.'),
      m('customise', 'Syllabus-aligned customisation', 'Video content customised to the University syllabus and curriculum.'),
      m('assessment', 'Self-assessment and practice', 'Self-assessment quizzes and practice tests, integrated with online and video lectures.'),
      m('forums', 'Discussion forums and engagement', 'Discussion forums and learning engagement systems for students.'),
      m('tracking', 'Learning progress tracking', 'Tracking mechanisms that monitor each student’s learning progress.'),
      m('live', 'Live lectures', 'Facilities for virtual classes and live lectures by University professors.'),
      m('hosting', 'Content hosting and management', 'Management and hosting support for all digital learning content.'),
    ],
  },
  {
    slug: 'marketing',
    stage: 'enrol',
    name: 'Marketing & Brand Outreach',
    short: 'Marketing',
    tagline: 'Put your programmes in front of the right students.',
    summary:
      'Awareness and student enquiries for your online programmes — across digital, social, influencer and broadcast channels.',
    items: [
      m('digital', 'Digital marketing', 'Digital marketing campaigns for your online programmes.'),
      m('lead-generation', 'Student lead generation', 'Generating enquiries from prospective students for your programmes.'),
      m('social-marketing', 'Social media marketing', 'Campaigns that promote your online programmes across social platforms.'),
      m('social-management', 'Social media management', 'Day-to-day management of your programmes’ social media presence.'),
      m('influencer', 'Influencer marketing', 'Campaigns with micro, mini and mega influencers.'),
      m('tv', 'TV branding', 'Branding on news channels and television advertising.'),
      m('radio', 'Radio advertising', 'Radio ads for your online programmes.'),
    ],
  },
  {
    slug: 'counselling',
    stage: 'enrol',
    name: 'Counselling & Admission Support',
    short: 'Counselling',
    tagline: 'A trained counsellor for every prospective student.',
    summary:
      'Online and telephonic counselling that helps prospective students choose the right programme — and supports them through to admission.',
    items: [
      m('advising', 'Counselling and programme advising', 'Online and telephonic counselling and programme advising services for prospective students.'),
      m('counsellors', 'Trained counsellors', 'Professional counselling and admission support through trained counsellors.'),
      m('outreach', 'Promotion and outreach', 'Promotional and outreach support, including national and international student engagement initiatives.'),
    ],
  },
  {
    slug: 'admissions',
    stage: 'enrol',
    name: 'Admission Management',
    short: 'Admissions',
    tagline: 'Admissions, automated and verified end to end.',
    summary:
      'An automated admission process for online programmes — from application and verification to fees, scrutiny and entrance examinations.',
    items: [
      m('automation', 'Admission automation', 'Automation of the admission management system for online programmes.'),
      m('verification', 'Student verification', 'Verification support for national and international students, as per applicable norms and regulations.'),
      m('fees', 'Online fees management', 'An online fees management system for your programmes.'),
      m('reconciliation', 'Fee reconciliation', 'Reconciliation systems for fees collected through the payment gateway.'),
      m('scrutiny', 'Online scrutiny and reports', 'Online scrutiny of admissions, with report generation.'),
      m('entrance', 'Entrance examination support', 'Support for the entrance examination process for online programmes.'),
    ],
  },
  {
    slug: 'examinations',
    stage: 'run',
    name: 'Online Examination Management',
    short: 'Examinations',
    tagline: 'Online examinations, from enrolment to results.',
    summary:
      'A complete online examination operation built on our Exam Module — question banks, enrolment, fees, proctoring, results and marks lists.',
    items: [
      m('platform', 'Online examination platform', 'An online examination platform set up for your online programmes.'),
      m('question-bank', 'Question bank digitisation', 'Digitisation of question banks provided by the University.'),
      m('exam-data', 'Examination data management', 'Consolidation and management of student examination data.'),
      m('notifications', 'Examination notifications', 'Notifications through website, email, SMS and WhatsApp.'),
      m('self-enrolment', 'Self-enrolment', 'Students enrol themselves for examinations online.'),
      m('exam-fees', 'Examination fees', 'Examination fee payment and reconciliation.'),
      m('results', 'Post-examination and results', 'Post-examination management and result consolidation.'),
      m('cml', 'Consolidated marks list', 'Provision for downloading the consolidated marks list (CML).'),
      m('proctoring', 'Proctored examinations', 'Proctored examinations conducted as per prevailing UGC Regulations.'),
    ],
  },
  {
    slug: 'student-support',
    stage: 'run',
    name: 'Student Support Services',
    short: 'Student Support',
    tagline: 'Help for every student, on every channel.',
    summary:
      'A dedicated support operation for your online students — people, systems and an AI-enabled chatbot working together.',
    items: [
      m('support-centre', 'Dedicated support centre', 'Call centre-based support infrastructure with phone and email support and dedicated student support teams.'),
      m('continuous', 'Continuous assistance', 'Ongoing support by call, email and AI-enabled chatbot systems.'),
      m('interaction', 'Student–faculty interaction', 'Chat and discussion forums that connect students with faculty.'),
      m('ticketing', 'Ticketing and grievance handling', 'Ticket raising, grievance handling and issue resolution mechanisms for students.'),
    ],
  },
  {
    slug: 'compliance',
    stage: 'run',
    name: 'Reporting & Regulatory Support',
    short: 'Reporting & Compliance',
    tagline: 'The reports your regulators ask for, ready when needed.',
    summary:
      'Institutional reporting for the University and its regulators — including UGC, DEB and the Academic Bank of Credit.',
    items: [
      m('reports', 'Institutional reports', 'Reports on admissions, fees collection, student backlogs, examination data and academic records, as required by the University and regulatory authorities including UGC/DEB.'),
      m('abc', 'Academic Bank of Credit (ABC)', 'Support for registration and data sharing with the Academic Bank of Credit.'),
      m('regulatory', 'Regulatory compliance reporting', 'Institutional reporting in compliance with UGC/DEB and other applicable regulatory requirements.'),
      m('integration', 'UGC/DEB technology integration', 'Technology integration and support for UGC/DEB-related systems.'),
    ],
  },
  {
    slug: 'automation',
    stage: 'run',
    name: 'Automation & AI',
    short: 'Automation & AI',
    tagline: 'Let routine work run itself.',
    summary:
      'Automation and agentic AI that take repetitive work off your teams, so people can focus on students.',
    items: [
      m('process', 'Process automation', 'Automation of routine programme operations.'),
      m('agentic', 'Agentic AI automation', 'AI agents that carry out multi-step tasks for your teams.'),
    ],
  },
  {
    slug: 'careers',
    stage: 'outcomes',
    name: 'Apprenticeship & Placement Assistance',
    short: 'Apprenticeship & Placement',
    tagline: 'From enrolled student to employed graduate.',
    summary:
      'Industry connections that carry your students beyond the degree — apprenticeships, placement drives and job fairs.',
    items: [
      m('apprenticeship', 'Apprenticeship opportunities', 'Facilitating apprenticeship opportunities for enrolled students.'),
      m('placement', 'Placement assistance', 'Placement assistance support for graduating students.'),
      m('tie-ups', 'Industry tie-ups', 'Tie-ups with employers, apprenticeship providers and aggregators.'),
      m('drives', 'Placement drives and job fairs', 'Placement drives, apprenticeship support programmes and job fairs.'),
      m('monitoring', 'Monitoring and reporting', 'Monitoring and reporting support for apprenticeship and on-job learning activities.'),
    ],
  },
];

// Engagement models (the CSV's "select one option" columns).
export const models = [
  {
    id: 'revenue',
    name: 'Revenue sharing',
    line: 'Pay as your programmes grow.',
    desc: 'Each service is priced as a percentage of programme revenue.',
    unit: 'Percentage of revenue, per service',
  },
  {
    id: 'onetime',
    name: 'One-time payment',
    line: 'A fixed price, agreed up front.',
    desc: 'Each service is priced once, with no share of revenue.',
    unit: 'Fixed price, per service',
  },
];

// Starting points for the configurator. `areas` is what gets pre-selected.
export const goals = [
  {
    id: 'launch',
    name: 'Launch online programmes',
    desc: 'Start from scratch with the complete stack.',
    areas: areas.map((a) => a.slug),
  },
  {
    id: 'admissions',
    name: 'Grow admissions',
    desc: 'Reach, counsel and admit more students.',
    areas: ['marketing', 'counselling', 'admissions'],
  },
  {
    id: 'exams',
    name: 'Run examinations online',
    desc: 'Proctored exams, results and reporting.',
    areas: ['examinations', 'compliance'],
  },
  {
    id: 'experience',
    name: 'Improve the student experience',
    desc: 'Better content, support and outcomes.',
    areas: ['content', 'student-support', 'careers'],
  },
  {
    id: 'custom',
    name: 'I’ll choose myself',
    desc: 'Start with a blank slate.',
    areas: [],
  },
];

// The student journey through the connected platform (homepage "Platform" section).
export const journey = [
  { verb: 'Discover', system: 'University website', desc: 'A dedicated website for your online programmes.', area: 'infrastructure' },
  { verb: 'Apply', system: 'Admissions Management System', desc: 'Automated applications, scrutiny and student verification.', area: 'admissions' },
  { verb: 'Pay', system: 'Payment gateway and fees management', desc: 'Admission and fee payments, reconciled.', area: 'admissions' },
  { verb: 'Learn', system: 'LMS, mobile app and virtual classroom', desc: 'Digital content, live lectures, quizzes and progress tracking.', area: 'content' },
  { verb: 'Sit exams', system: 'Exam Module', desc: 'Proctored online examinations, results and marks lists.', area: 'examinations' },
  { verb: 'Get help', system: 'Support desk, AI chatbot and messaging', desc: 'Call, email, chat and tickets — with SMS, email and WhatsApp updates.', area: 'student-support' },
  { verb: 'Graduate', system: 'Student Management System and reports', desc: 'Academic records, regulatory reports and placement support.', area: 'careers' },
];
