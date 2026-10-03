// Everything that is specific to the live site lives here.
// Anything left empty is simply not shown (no "coming soon" placeholders) and appears once you fill it in.

export default {
  // Public URL of the deployed site, no trailing slash. Used for canonical URLs, Open Graph and the sitemap.
  siteUrl: 'https://walnutdatatech.com',

  company: {
    name: 'Walnut Data Tech',
    legalName: 'Walnut DataTech Private Limited',
  },

  // Email. Enquiries and enrolment confirmations are sent by the site's own API through this
  // provider; the sending address and API key live in .env, never here.
  email: {
    provider: 'Twilio',
  },

  links: {
    // The Walnut account portal (the Onboarding Tool's public address, no trailing slash), e.g.
    // https://account.walnutdatatech.com — switches on "Sign in" and "Create account" across the site.
    account: '',
    studentLogin: '',
    selectYourUniversity: 'https://selectyouruniversity.com',
    youtube: '',
    linkedin: '',
    facebook: '',
    instagram: '',
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

  // { name, logo } — logo is a path inside src/assets/img. The "Our clients" section appears once this has entries.
  clients: [],

  // { name, detail } — e.g. { name: 'ISO 27001', detail: 'Information security management' }
  // The "Certifications" section appears once this has entries.
  certifications: [],

  // Legal and contact details shown in the Privacy Policy and Terms & Conditions.
  // NEEDS BUSINESS / LEGAL CONFIRMATION — the pages say so plainly where a value is empty.
  legal: {
    // Date the legal pages were last reviewed, e.g. '2 October 2026'. Update it whenever the wording changes.
    lastUpdated: '2 October 2026',
    // Where privacy requests, complaints and refund queries should be sent.
    contactEmail: '',
    // Registered office address of the company.
    registeredAddress: '',
    // Name of the grievance / data-protection contact, if one is appointed.
    grievanceOfficer: '',
    // Refund and cancellation terms for paid courses, in plain sentences.
    // Live payments cannot be deployed while this is empty (see scripts/deploy.mjs).
    refundPolicy: '',
    // How and when course access is delivered after payment, e.g. 'by email within 24 hours'.
    courseAccess: '',
    // How long enquiry and enrolment records are kept, e.g. 'for 24 months after our last contact'.
    retention: '',
    // Governing law and the courts that have jurisdiction, e.g. 'India' and 'Pune, Maharashtra'.
    governingLaw: '',
    jurisdiction: '',
  },

  // Analytics. Nothing is loaded and no consent banner is shown while this is empty.
  // With a Google Analytics 4 measurement ID (G-XXXXXXXXXX), visitors are asked first and
  // analytics only runs after they accept. Events are listed in src/assets/js/analytics.js.
  analytics: {
    gaMeasurementId: '',
  },
};
