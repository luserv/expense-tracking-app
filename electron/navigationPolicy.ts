import type { WebPreferences } from 'electron';

// URL classification for windows and navigation. Hosts are compared after
// parsing, never by substring, so "https://evil.tld/?accounts.google.com"
// is not mistaken for Google.

const GOOGLE_ACCOUNTS_HOST = 'accounts.google.com';
const FIREBASE_AUTH_HOST = 'segast0.firebaseapp.com';
const FIREBASE_AUTH_PATH = '/__/auth/';
const EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);
export const DEV_SERVER_ORIGIN = 'http://localhost:8081';

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isGoogleAccountsUrl(raw: string): boolean {
  const url = parseUrl(raw);
  return !!url && url.protocol === 'https:' && url.hostname === GOOGLE_ACCOUNTS_HOST;
}

export function isOAuthPopupUrl(raw: string): boolean {
  const url = parseUrl(raw);
  if (!url || url.protocol !== 'https:') return false;
  if (url.hostname === GOOGLE_ACCOUNTS_HOST) return true;
  return url.hostname === FIREBASE_AUTH_HOST && url.pathname.startsWith(FIREBASE_AUTH_PATH);
}

export function isAppUrl(raw: string): boolean {
  const url = parseUrl(raw);
  if (!url) return false;
  return url.protocol === 'app:' || url.origin === DEV_SERVER_ORIGIN;
}

export function isExternalLink(raw: string): boolean {
  const url = parseUrl(raw);
  return !!url && EXTERNAL_PROTOCOLS.has(url.protocol);
}

// Popups get no preload and full isolation: they show third-party pages.
export const ISOLATED_WEB_PREFERENCES: Readonly<WebPreferences> = Object.freeze({
  preload: undefined,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
});
