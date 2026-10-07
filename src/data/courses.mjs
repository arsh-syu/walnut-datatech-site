// The courses this website used to sell itself, before courses moved to Walnut LMS. They are kept so old
// links and past purchases still resolve: /academy/<slug>/ now redirects (to the same course on Walnut LMS
// where there is one, otherwise to /academy/), and receipts and enrolment records name these slugs.
//
// `lms` is the course's slug on Walnut LMS, or null when the LMS has no matching course.

export const legacyCourses = [
  { slug: 'online-programme-course', name: 'Online Programme Course', lms: 'online-counselling-course' },
  { slug: 'agentic-ai', name: 'Agentic AI Short Course', lms: null },
];
