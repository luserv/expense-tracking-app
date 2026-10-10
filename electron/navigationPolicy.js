// URL classification for windows and navigation. Hosts are compared after
// parsing, never by substring, so "https://evil.tld/?accounts.google.com"
// is not mistaken for Google.

const GOOGLE_ACCOUNTS_HOST = 'accounts.google.com';
const FIREBASE_AUTH_HOST = 'segast0.firebaseapp.com';
const FIREBASE_AUTH_PATH = '/__/auth/';
const EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);
const DEV_SERVER_ORIGIN = 'http://localhost:8081';

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isGoogleAccountsUrl(raw) {
  const url = parseUrl(raw);
  return !!url && url.protocol === 'https:' && url.hostname === GOOGLE_ACCOUNTS_HOST;
}

function isOAuthPopupUrl(raw) {
  const url = parseUrl(raw);
  if (!url || url.protocol !== 'https:') return false;
  if (url.hostname === GOOGLE_ACCOUNTS_HOST) return true;
  return url.hostname === FIREBASE_AUTH_HOST && url.pathname.startsWith(FIREBASE_AUTH_PATH);
}

function isAppUrl(raw) {
  const url = parseUrl(raw);
  if (!url) return false;
  return url.protocol === 'app:' || url.origin === DEV_SERVER_ORIGIN;
}

function isExternalLink(raw) {
  const url = parseUrl(raw);
  return !!url && EXTERNAL_PROTOCOLS.has(url.protocol);
}

// Popups get no preload and full isolation: they show third-party pages.
const ISOLATED_WEB_PREFERENCES = Object.freeze({
  preload: undefined,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
});

module.exports = {
  isGoogleAccountsUrl,
  isOAuthPopupUrl,
  isAppUrl,
  isExternalLink,
  ISOLATED_WEB_PREFERENCES,
  DEV_SERVER_ORIGIN,
};
