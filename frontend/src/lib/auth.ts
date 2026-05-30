// ─── Token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'hawkeye_token';
const USER_KEY  = 'hawkeye_user';

export interface AuthUser {
  userId: string;
  email:  string;
  name:   string;
  role:   'ADMIN' | 'ANALYST' | 'VIEWER';
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const RANK = { VIEWER: 0, ANALYST: 1, ADMIN: 2 } as const;

export function hasRole(user: AuthUser | null, minRole: 'ADMIN' | 'ANALYST' | 'VIEWER'): boolean {
  if (!user) return false;
  return RANK[user.role] >= RANK[minRole];
}
