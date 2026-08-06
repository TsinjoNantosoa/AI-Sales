export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

export const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

export const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

export const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

/** Shift an ISO date relative to a fixed anchor so seed data stays fresh. */
export function relativeToNow(
  isoDate: string,
  anchorIso = "2024-01-15T12:00:00Z"
): string {
  const original = new Date(isoDate).getTime();
  const anchor = new Date(anchorIso).getTime();
  const delta = original - anchor;
  return new Date(Date.now() + delta).toISOString();
}

export function dateOnlyFromNow(days: number): string {
  return daysFromNow(days).slice(0, 10);
}
