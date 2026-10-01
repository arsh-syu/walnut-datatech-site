// Everything that is specific to the live site and not yet known lives here.
// Empty values render as tasteful placeholders — fill them in and run `npm run build`.

export default {
  // Public URL of the deployed site, no trailing slash. Used for canonical URLs, Open Graph and the sitemap.
  siteUrl: '',

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
      careers: '',
    },
  },

  // { name, logo } — logo is a path inside src/assets/img. Leave empty to show placeholder slots.
  clients: [],

  // { name, detail } — e.g. { name: 'ISO 27001', detail: 'Information security management' }
  certifications: [],
};
