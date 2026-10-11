/** Helpers for the Sandboxes page. The API keeps the times. The page shows them. */

/** The first 8 characters of the id. The full id is copied. */
export const shortSandboxId = (id: string) => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

/** Time left until the end. `null` end time means the sandbox has no timeout. */
export function endsIn(endAt: string | null, now = Date.now()): string {
  if (!endAt) return 'No end time';
  const s = Math.round((new Date(endAt).getTime() - now) / 1000);
  if (s <= 0) return 'Ending now';
  if (s < 60) return 'Less than 1 min';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}
