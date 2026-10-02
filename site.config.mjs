// Everything that is specific to the live site lives here.
// Anything left empty is simply not shown (no "coming soon" placeholders) and appears once you fill it in.

export default {
  // Public URL of the deployed site, no trailing slash. Used for canonical URLs, Open Graph and the sitemap.
  siteUrl: 'https://walnutdatatech.com',

  company: {
    name: 'Walnut Data Tech',
    legalName: 'Walnut DataTech Private Limited',
  },

  // Where enquiry forms are delivered.
  //   endpoint   — any JSON form endpoint (Web3Forms, Formspree, your own API…)
  //   accessKey  — sent as `access_key` when set (Web3Forms)
  //   email      — fallback: opens the visitor's mail app addressed here when no endpoint is set
  //   provider   — name of the delivery service, mentioned in the privacy policy
  form: {
    // FormSubmit (formsubmit.co): free, no account. The first submission triggers a one-time
    // activation email to this address. After activating, FormSubmit gives you a random alias
    // you can use here in place of the address to keep it out of the page source.
    endpoint: 'https://formsubmit.co/ajax/marketing@selectyouruniversity.com',
    accessKey: '',
    email: '',
    provider: 'FormSubmit',
  },

  links: {
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
