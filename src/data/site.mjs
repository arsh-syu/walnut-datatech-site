// Content for the pages around the service catalogue: who Walnut serves, and the partner applications.

export const nav = [
  { label: 'Universities', href: 'solutions/' },
  { label: 'Courses', href: 'academy/' },
  { label: 'Partners', href: 'partners/' },
  { label: 'About', href: 'about/' },
  { label: 'Contact', href: 'contact/' },
];

// The three kinds of people Walnut serves. Each has its own journey — they are never merged into one flow.
export const audiences = [
  {
    id: 'universities',
    icon: 'building',
    who: 'I’m from a university or institution',
    title: 'Work with Walnut',
    line: 'Technology and services to launch, run and grow your online programmes.',
    steps: ['Explore solutions', 'Select services', 'Review your solution', 'Request a consultation'],
  },
  {
    id: 'learners',
    icon: 'cap',
    who: 'I want to learn and upgrade my career',
    title: 'Upgrade your skills',
    line: 'Short online courses for counsellors, students and professionals.',
    steps: ['Explore courses', 'View course details', 'Apply your coupon', 'Enrol and pay'],
  },
  {
    id: 'partners',
    icon: 'handshake',
    who: 'I want to become a Walnut agent or partner',
    title: 'Join Walnut',
    line: 'Onboard as an agent and use Walnut’s applications to grow.',
    steps: ['Explore the partnership', 'Select an application', 'Open it and get started'],
  },
];

// Walnut's connected applications. Exactly one can be selected at a time; the action opens `url`.
export const externalApps = [
  {
    id: 'agent-onboard',
    icon: 'handshake',
    name: 'Agent Onboard',
    desc: 'Register as a Walnut agent and complete your onboarding.',
    action: 'Open Agent Onboarding',
    url: 'https://syuapptracker.softsolanalytics.com',
  },
  {
    id: 'course-finder',
    icon: 'cap',
    name: 'Course Finder',
    desc: 'Search and compare online programmes for the students you advise.',
    action: 'Open Course Finder',
    url: 'https://syu-course-finder.vercel.app',
  },
  {
    id: 'online-leads',
    icon: 'marketing',
    name: 'Online Leads',
    desc: 'Access leads from students who are looking for online programmes.',
    action: 'Open Online Leads',
    url: 'https://syu-leads.vercel.app',
  },
];

export const compliancePoints = [
  { label: 'Content delivery', text: 'Digital content delivered through LMS and mobile app in accordance with UGC Regulations.' },
  { label: 'Examinations', text: 'Proctored examinations conducted as per prevailing UGC Regulations.' },
  { label: 'Reporting', text: 'Institutional reporting for UGC/DEB, with Academic Bank of Credit registration and data sharing.' },
];
