import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { pool } from './db';

export type Role = 'admin' | 'viewer';

export interface AuthedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
}

/**
 * Session strategy: server-side sessions in Postgres, NOT JWT.
 *
 * Rationale (per spec, "documentar a escolha e o motivo diretamente no
 * código"): this app already gained a Postgres database as part of this
 * change, so there's no infrastructure cost to a DB-backed session — and a
 * governance/audit-focused tool (the whole point of this build) benefits
 * far more from being able to revoke a session *immediately* (delete the
 * row — e.g. an admin force-logging-out a compromised or departing user)
 * than from JWT's main advantage (stateless verification, useful mainly
 * when you can't afford a DB round-trip per request or need to scale
 * verification across services without shared storage — neither applies
 * here: this is a single small app with one database it already talks to
 * on every request anyway). A JWT, once issued, remains valid until it
 * expires no matter what the server does; that's the opposite of what an
 * auditable access-control system wants.
 */
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);
export const SESSION_COOKIE_NAME = 'session_token';

const BCRYPT_COST_FACTOR = 12; // ~250ms/hash on typical hardware; standard, well-tested default

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter no mínimo 8 caracteres.';
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function toAuthedUser(row: {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  must_change_password: boolean;
}): AuthedUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
}

/** Verifies credentials. Returns the user on success, or null — never distinguishes
 *  "user not found" from "wrong password" to the caller, to avoid user enumeration. */
export async function login(email: string, password: string): Promise<AuthedUser | null> {
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: Role;
    must_change_password: boolean;
    password_hash: string;
  }>('SELECT id, email, display_name, role, must_change_password, password_hash FROM users WHERE email = $1', [
    email.trim().toLowerCase(),
  ]);
  const row = rows[0];
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  return toAuthedUser(row);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    userId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

/** Returns the authenticated user for a session token, or null if missing/expired. */
export async function getUserForSession(token: string | undefined): Promise<AuthedUser | null> {
  if (!token) return null;
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: Role;
    must_change_password: boolean;
  }>(
    `SELECT u.id, u.email, u.display_name, u.role, u.must_change_password
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  );
  const row = rows[0];
  return row ? toAuthedUser(row) : null;
}

export async function setPassword(userId: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2',
    [hash, userId],
  );
}

export function sessionCookieHeader(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
