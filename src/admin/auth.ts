import { Bindings } from '../types';

const COOKIE_NAME = 'cal_admin_session';
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getPassword(bindings: Pick<Bindings, 'ADMIN_DASHBOARD_PASSWORD'>): string {
  const configured = bindings.ADMIN_DASHBOARD_PASSWORD?.trim();
  return configured && configured.length > 0 ? configured : 'pqg-bros';
}

function parseCookies(cookieHeader: string | null | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) {
      continue;
    }

    cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
  }

  return cookies;
}

async function sha256Base64Url(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const buffer = new Uint8Array(digest);
  let binary = '';

  for (const value of buffer) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function buildSessionToken(bindings: Pick<Bindings, 'WEBHOOK_SECRET' | 'ADMIN_DASHBOARD_PASSWORD'>): Promise<string> {
  return sha256Base64Url(`${getPassword(bindings)}:${bindings.WEBHOOK_SECRET || 'admin-session'}`);
}

export function verifyAdminPassword(
  bindings: Pick<Bindings, 'ADMIN_DASHBOARD_PASSWORD'>,
  candidate: string | null | undefined,
): boolean {
  return (candidate ?? '') === getPassword(bindings);
}

export async function isAdminAuthenticated(
  bindings: Pick<Bindings, 'WEBHOOK_SECRET' | 'ADMIN_DASHBOARD_PASSWORD'>,
  cookieHeader: string | null | undefined,
): Promise<boolean> {
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies.get(COOKIE_NAME);
  if (!sessionToken) {
    return false;
  }

  const expected = await buildSessionToken(bindings);
  return sessionToken === expected;
}

export async function createAdminSessionCookie(
  bindings: Pick<Bindings, 'WEBHOOK_SECRET' | 'ADMIN_DASHBOARD_PASSWORD'>,
): Promise<string> {
  const token = await buildSessionToken(bindings);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/admin; SameSite=Strict`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Max-Age=0; Path=/admin; SameSite=Strict`;
}
