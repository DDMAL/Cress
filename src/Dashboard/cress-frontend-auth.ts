/**
 * Cress GitHub OAuth -- frontend integration.
 *
 * Pairs with the Cloudflare Worker in cress-auth-poc/src/index.ts.
 * The Worker handles the server-side token exchange and posts the token
 * back to the opener window via window.opener.postMessage(...).
 *
 * Storage note: Cress is a multi-page app (landing / dashboard / editor are
 * three separate documents). sessionStorage is per-document and would not be
 * shared between them, so the token is kept in localStorage, which is shared
 * across same-origin pages. The token persists until logout (or the user
 * clears site data). A "storage" event listener keeps open pages in sync when
 * login/logout happens in another tab.
 *
 * Required DOM elements (present on whichever page shows the login UI):
 *   #github-login-btn      - the "Login with GitHub" button
 *   #github-logout-btn     - the "Logout" button
 *   #github-auth-status    - text element showing the logged-in username
 *
 * Any page may omit some of these; initGithubAuth() handles missing elements.
 * Call initGithubAuth() once per page after the DOM is ready.
 */

/**
 * The deployed Worker URL.
 *
 * PoC (personal account): https://cress-auth.kyuchia.workers.dev
 * When the Worker moves to the lab Cloudflare account, change this to the
 * lab subdomain (e.g. https://cress-auth.ddmal.workers.dev). Code is otherwise
 * unchanged.
 */
const WORKER_URL = 'https://cress-auth.kyuchia.workers.dev';

/**
 * The origin we expect token messages to come from. We verify event.origin
 * against this so a token is never accepted from an arbitrary window.
 */
const WORKER_ORIGIN = new URL(WORKER_URL).origin;

/** Message type sent by the Worker success page. Must match index.ts. */
const TOKEN_MESSAGE_TYPE = 'cress-github-token';

/**
 * localStorage keys. Shared across landing / dashboard / editor pages.
 */
const TOKEN_KEY = 'cress_github_token';
const USERNAME_KEY = 'cress_github_username';

let messageListenerAttached = false;
let storageListenerAttached = false;
let authPopup: Window | null = null;

/** Read the stored token, or null if not logged in. */
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Read the stored username, or null. */
function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

/**
 * Fetch the authenticated user's GitHub login name.
 * The Worker only returns a token, so the username is fetched here.
 */
async function fetchGithubUsername(token: string): Promise<string | null> {
  try {
    const resp = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!resp.ok) {
      console.error('GitHub /user failed:', resp.status, resp.statusText);
      return null;
    }
    const data = await resp.json();
    return typeof data.login === 'string' ? data.login : null;
  } catch (e) {
    console.error('GitHub /user request errored:', e);
    return null;
  }
}

/** Update the auth UI elements based on current login state. */
function renderAuthState(): void {
  const loginBtn = document.getElementById('github-login-btn');
  const logoutBtn = document.getElementById('github-logout-btn');
  const status = document.getElementById('github-auth-status');

  const username = getUsername();
  const loggedIn = !!getToken();

  if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : '';
  if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';

  if (status) {
    if (loggedIn && username) {
      status.textContent = username;
      status.style.display = '';
    } else if (loggedIn) {
      status.textContent = 'Logged in';
      status.style.display = '';
    } else {
      status.textContent = '';
      status.style.display = 'none';
    }
  }
}

/**
 * Store a freshly received token, fetch the username, then update the UI.
 */
async function handleNewToken(token: string): Promise<void> {
  localStorage.setItem(TOKEN_KEY, token);
  renderAuthState(); // show "Logged in" immediately

  const username = await fetchGithubUsername(token);
  if (username) {
    localStorage.setItem(USERNAME_KEY, username);
  }
  renderAuthState(); // now show the username
}

/**
 * Window message handler. Only acts on messages that come from the Worker's
 * origin, have the expected type, and carry a non-empty string token.
 */
function onAuthMessage(event: MessageEvent): void {
  if (event.origin !== WORKER_ORIGIN) return;
  const data = event.data;
  if (!data || data.type !== TOKEN_MESSAGE_TYPE) return;
  if (typeof data.token !== 'string' || data.token.length === 0) return;

  void handleNewToken(data.token);
}

/**
 * Keep this page's UI in sync when login/logout happens on another page.
 * Fires only in OTHER documents of the same origin, which is exactly the
 * multi-page case we care about.
 */
function onStorageEvent(event: StorageEvent): void {
  if (event.key === TOKEN_KEY || event.key === USERNAME_KEY) {
    renderAuthState();
  }
}

/** Open the Worker popup to start the OAuth flow. */
function startLogin(): void {
  if (authPopup && !authPopup.closed) {
    authPopup.focus();
    return;
  }
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const loginUrl = `${WORKER_URL}?origin=${encodeURIComponent(window.location.origin)}`;
  authPopup = window.open(
    loginUrl,
    'cress-github-login',
    `width=${width},height=${height},left=${left},top=${top}`,
  );
}

/** Clear the stored token/username and update the UI. */
function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  renderAuthState();
}

/**
 * Wire up the buttons and listeners. Safe to call once per page after the DOM
 * elements exist. Missing elements are tolerated (not every page has all
 * three). If a token is already stored, the UI reflects it immediately.
 */
export function initGithubAuth(): void {
  const loginBtn = document.getElementById('github-login-btn');
  const logoutBtn = document.getElementById('github-logout-btn');

  if (loginBtn) loginBtn.addEventListener('click', startLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  if (!messageListenerAttached) {
    window.addEventListener('message', onAuthMessage);
    messageListenerAttached = true;
  }
  if (!storageListenerAttached) {
    window.addEventListener('storage', onStorageEvent);
    storageListenerAttached = true;
  }

  // If we have a token but no username yet, backfill it; otherwise just render.
  const token = getToken();
  if (token && !getUsername()) {
    void handleNewToken(token);
  } else {
    renderAuthState();
  }
}

/** Exported for the save-to-GitHub feature (separate issue). */
export function getGithubToken(): string | null {
  return getToken();
}
