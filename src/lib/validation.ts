export const NAME_PATTERN = /^[a-z0-9-]{3,40}$/;

export function validateName(name: string): string | null {
  if (!NAME_PATTERN.test(name)) {
    return 'Use 3 to 40 lowercase letters, numbers or dashes.';
  }
  return null;
}

/** The same check as the API. Supabase checks more when it sends the invite. */
export function validateEmail(email: string): string | null {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? null : 'Enter a valid email address.';
}
