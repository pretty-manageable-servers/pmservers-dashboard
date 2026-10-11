import type { ApiToken } from './api/types';
import { timeAgoLong } from './utils';

/** Client checks for API tokens. The API checks again. */

export const TOKEN_NAME_MAX = 64;
/** A project can have this many tokens. The API refuses more. */
export const TOKEN_LIMIT = 20;

export function validateTokenName(name: string): string | null {
  const text = name.trim();
  if (text === '') return 'Enter a name for the token.';
  return text.length > TOKEN_NAME_MAX ? `Use ${TOKEN_NAME_MAX} characters or less.` : null;
}

/** The expiry choices of the create dialog. The value is the select option. */
export const TOKEN_EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
] as const;

/** The `expires_in_days` of the API body. `null` means the token never expires. */
export function expiresInDays(value: string): number | null {
  return value === 'never' ? null : Number(value);
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });

export function expiresLabel(t: Pick<ApiToken, 'expires_at'>, now = Date.now()): string {
  if (!t.expires_at) return 'Never';
  return new Date(t.expires_at).getTime() <= now
    ? `Expired ${day(t.expires_at)}`
    : day(t.expires_at);
}

export const lastUsedLabel = (t: Pick<ApiToken, 'last_used_at'>, now = Date.now()) =>
  t.last_used_at ? timeAgoLong(t.last_used_at, now) : 'Never used';
