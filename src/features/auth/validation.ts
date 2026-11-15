/** Parses "DD/MM/YYYY" (also "-" or "."). Returns null for impossible dates. */
export function parseBirthdate(input: string): Date | null {
  const m = input.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

/** True if someone born on `birthdate` is at least 18 on `now`. */
export function isAdult(birthdate: Date, now: Date = new Date()): boolean {
  const eighteenth = new Date(
    Date.UTC(birthdate.getUTCFullYear() + 18, birthdate.getUTCMonth(), birthdate.getUTCDate()),
  );
  return eighteenth.getTime() <= now.getTime();
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(input: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(normalizeUsername(input));
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}
