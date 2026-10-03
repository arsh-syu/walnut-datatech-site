// The Walnut account session, shared by the login page, the profile page and the header.
//
// The account service holds the session: a short-lived access token (kept in memory only) and a
// refresh cookie that the browser cannot read. Nothing secret is ever stored by this script —
// the only thing kept in localStorage is the person's first name, so the header can greet them.

const config = (() => {
  try {
    return JSON.parse(document.getElementById('site-config').textContent);
  } catch {
    return {};
  }
})();

export const accountApi = config.account || '';
export const portal = config.portal || '';
export const siteRoot = config.root ?? '';
const HINT = 'walnut-user';

let accessToken = null;
let refreshing = null;

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function hint() {
  try {
    return JSON.parse(localStorage.getItem(HINT));
  } catch {
    return null;
  }
}
function remember(user) {
  try {
    if (user) localStorage.setItem(HINT, JSON.stringify({ name: user.name }));
    else localStorage.removeItem(HINT);
  } catch {}
}

// An error from the account service, with the sentence it wrote for the person.
export class AccountError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Something went wrong. Please try again.');
    this.status = status;
    this.reason = body?.error?.details?.reason || '';
    this.details = body?.error?.details;
    this.network = status === 0;
  }
}

async function request(path, { method, body, auth = true } = {}) {
  let res;
  try {
    res = await fetch(accountApi + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      credentials: 'include', // the refresh cookie belongs to the account service
      signal: AbortSignal.timeout(25000),
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AccountError(0, { error: { message: 'We couldn’t reach the server. Please check your internet connection and try again.' } });
  }
  const reply = await res.json().catch(() => null);
  if (!res.ok) throw new AccountError(res.status, reply);
  return reply;
}

// Takes over a session the service just issued (login, OTP, new account).
export function adopt(session) {
  accessToken = session.accessToken;
  remember(session.user);
  return session.user;
}

// Picks the session back up after a page load. Resolves with the user, or null when signed out.
export function restore() {
  refreshing ??= request('/auth/refresh', { method: 'POST', auth: false })
    .then(adopt)
    .catch((err) => {
      // Only a clear "no session" forgets the name; a network blip does not sign anyone out.
      if (!err.network) remember(null);
      accessToken = null;
      return null;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

// A call as the signed-in person. An expired access token is renewed once, silently.
export async function call(path, options = {}) {
  try {
    return await request(path, options);
  } catch (err) {
    if (err.status !== 401 || options.auth === false) throw err;
    if (!(await restore())) throw err;
    return request(path, options);
  }
}

export async function signOut() {
  await request('/auth/logout', { method: 'POST', auth: false }).catch(() => null);
  accessToken = null;
  remember(null);
}

// Header: "Sign in" becomes the person's first name and leads to their profile.
export function paintHeader() {
  const link = document.querySelector('[data-account-link]');
  const user = hint();
  if (!link || !user?.name) return;
  link.href = link.dataset.profile;
  link.querySelector('span').textContent = user.name.trim().split(/\s+/)[0];
  link.classList.add('is-signed-in');
  link.dataset.track = 'account_open';
}
