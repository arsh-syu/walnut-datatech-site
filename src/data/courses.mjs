// Short courses and their pricing — the single source of truth for the course pages,
// the checkout and the payment API (the build turns this into dist/api/catalog.php,
// so the server charges exactly what the site shows).
//
// To change a price: edit `price` (whole rupees).
// To add or change a coupon: edit `coupons` — `finalPrice` is what the learner pays with that code.
// A coupon only ever applies to the course it is listed under.

export const currency = 'INR';

// The categories the courses are grouped under on /academy/. A course names its track by `id`;
// a track with no courses is simply not shown.
export const tracks = [
  {
    id: 'counselling',
    icon: 'counselling',
    name: 'Counselling & admissions',
    line: 'For anyone who advises students — understand online degree programmes and guide an applicant through to admission.',
  },
  {
    id: 'technology',
    icon: 'automation',
    name: 'Technology & AI',
    line: 'For anyone upgrading their technical skills — practical courses on the technology behind modern products.',
  },
];

export const courses = [
  {
    slug: 'online-programme-course',
    name: 'Online Programme Course',
    kicker: 'Short course · Certification',
    tagline: 'Understand online programmes — and guide learners to the right one.',
    summary:
      'A short certification course on how online degree programmes work, and how to counsel prospective students through to admission.',
    track: 'counselling',
    price: 999,
    coupons: [{ code: 'SYUSANDEEP', finalPrice: 499 }],
    format: 'Online',
    duration: null, // e.g. '4 weeks' — shown on the course page once set
    eligibility: 'Open to everyone — no prior qualification needed.',
    certificate: true,
    audience: ['Education counsellors', 'Students', 'Working professionals'],
    outcomes: [
      'How online programmes are structured and delivered',
      'How to advise prospective students on choosing a programme',
      'How to guide an applicant through to admission',
    ],
  },
  {
    slug: 'agentic-ai',
    name: 'Agentic AI Short Course',
    kicker: 'Short course',
    tagline: 'Build with AI agents and retrieval-augmented generation.',
    summary:
      'A short, practical introduction to agentic AI — how AI agents work, and how retrieval-augmented generation (RAG) grounds them in real information.',
    track: 'technology',
    price: 1999,
    coupons: [],
    format: 'Online',
    duration: null,
    eligibility: 'Open to everyone. Basic computer skills help; no coding experience is assumed.',
    certificate: false,
    audience: ['Students', 'Working professionals', 'Anyone upgrading their technology skills'],
    outcomes: [
      'What agentic AI is and where it is useful',
      'How AI agents plan and carry out tasks',
      'How retrieval-augmented generation (RAG) works',
    ],
  },
];

export const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// The best advertised offer for a course, or null when there is no discount.
export function offerOf(course) {
  const coupon = course.coupons[0];
  return coupon ? { code: coupon.code, finalPrice: coupon.finalPrice, saving: course.price - coupon.finalPrice } : null;
}
