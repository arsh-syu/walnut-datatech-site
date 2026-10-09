// Everything that is specific to the live site lives here.
// Anything left empty is simply not shown (no "coming soon" placeholders) and appears once you fill it in.

export default {
  // Public URL of the deployed site, no trailing slash. Used for canonical URLs, Open Graph and the sitemap.
  siteUrl: 'https://walnutdatatech.com',

  company: {
    name: 'Walnut Data Tech',
    legalName: 'Walnut DataTech Private Limited',
    gstin: '09AADCW6322K1Z1',
    // The address people write to — shown in the footer, on the contact page and in the legal pages.
    email: 'support@walnutdatatech.com',
    address: 'Graphix Tower - 1, A 13 A, Block A, Industrial Area, Sector 62, Noida, Uttar Pradesh 201309',
  },

  // Email. Enquiries and enrolment confirmations are sent by the site's own API through this
  // provider; the sending address and API key live in .env, never here.
  email: {
    provider: 'Twilio',
  },

  links: {
    // The Onboarding Tool's own address, where an approved university continues its onboarding and
    // a password is reset. Optional: without it those two links are simply not shown.
    portal: '',
    studentLogin: '',
    selectYourUniversity: 'https://selectyouruniversity.com',
    youtube: '',
    linkedin: '',
    facebook: '',
    instagram: '',
  },

  // Walnut accounts: login/ and dashboard/ on this site, with "Sign in" in the header.
  // The pages talk only to this site's own API (api/account.php), which relays to the account
  // service set as ONBOARDING_API_URL in .env — so that must be set before switching this on.
  accounts: false,
  // The payment gateway: /pay/, where every Walnut product's buyers pay. Built only when the server has it
  // set up (scripts/deploy.mjs passes PAY=1); otherwise there is no pay page to link to.
  payments: false,

  // Walnut LMS, where courses are sold and taken. /academy/ lists its public catalogue (a snapshot taken
  // by scripts/fetch-catalogue.mjs, refreshed in the browser) and every course links to it.
  // `sso` is switched on by the build (LMS_SSO=1) once the LMS sign-in secret is in .env: Enrol then
  // goes through api/sso.php so the learner arrives signed in with their Walnut account. Without it,
  // Enrol opens the course on Walnut LMS. WALNUT_LMS_URL in the environment overrides `url`.
  lms: {
    url: 'https://walnut-lms.vercel.app',
    sso: false,
  },

  // YouTube / Vimeo embed URLs, e.g. https://www.youtube.com/embed/VIDEO_ID
  videos: {
    company: '',
    partnerOnboarding: '',
    services: {
      infrastructure: '',
      content: '',
      marketing: '',
      counselling: '',
      admissions: '',
      examinations: '',
      'student-support': '',
      compliance: '',
      automation: '',
      careers: '',
    },
  },

  // The universities Walnut works with: { name, place, logo, width, height }. `logo` is a file in
  // src/assets/img (WebP); width and height are its size in pixels. The "Clientele" section — the
  // last section of the home page, and on the about page — appears once this has entries.
  clients: [
    { name: 'Savitribai Phule Pune University', place: 'Pune, Maharashtra', logo: 'client-sppu.webp', width: 360, height: 346 },
    { name: 'Guru Ghasidas Vishwavidyalaya', place: 'Bilaspur, Chhattisgarh', logo: 'client-ggv.webp', width: 360, height: 353 },
    { name: 'Profi University', place: '', logo: 'client-profi.webp', width: 512, height: 213 },
    { name: 'MIT Art, Design and Technology University', place: 'Pune, Maharashtra', logo: 'client-mitadt.webp', width: 534, height: 285 },
  ],

  // { name, detail } — e.g. { name: 'ISO 27001', detail: 'Information security management' }
  // The "Certifications" section appears once this has entries.
  certifications: [],

  // Legal and contact details shown in the Privacy Policy and Terms & Conditions.
  // NEEDS BUSINESS / LEGAL CONFIRMATION — the pages say so plainly where a value is empty.
  legal: {
    // Date the legal pages were last reviewed, e.g. '2 October 2026'. Update it whenever the wording changes.
    lastUpdated: '8 October 2026',
    // Where privacy requests, complaints and refund queries should be sent.
    contactEmail: 'support@walnutdatatech.com',
    // Registered office address of the company.
    registeredAddress: 'Graphix Tower - 1, A 13 A, Block A, Industrial Area, Sector 62, Noida, Uttar Pradesh 201309',
    // Name of the grievance / data-protection contact, if one is appointed.
    grievanceOfficer: '',
    // Refund and cancellation terms for paid courses, in plain sentences.
    // Live payments cannot be deployed while this is empty (see scripts/deploy.mjs).
    // The business's decision (8 October 2026): 7 days, under 25% of the course completed. The full policy is
    // the /refund-policy/ page, built from these settings.
    refundPolicy: 'You can have a full refund of a course if you ask within 7 days of paying and have completed less than 25% of it. Refunds go back to the original payment method within 5–7 working days.',
    refundDays: 7,
    refundMaxCompleted: 25,
    // How and when course access is delivered after payment, e.g. 'by email within 24 hours'.
    courseAccess: 'on Walnut LMS as soon as your payment is confirmed',
    // How long enquiry and enrolment records are kept, e.g. 'for 24 months after our last contact'.
    retention: '',
    // Governing law and the courts that have jurisdiction, e.g. 'India' and 'Pune, Maharashtra'.
    governingLaw: 'India',
    jurisdiction: 'Gautam Buddh Nagar, Uttar Pradesh',
  },

  // Analytics. Nothing is loaded and no consent banner is shown while this is empty.
  // With a Google Analytics 4 measurement ID (G-XXXXXXXXXX), visitors are asked first and
  // analytics only runs after they accept. Events are listed in src/assets/js/analytics.js.
  analytics: {
    gaMeasurementId: '',
  },
};
