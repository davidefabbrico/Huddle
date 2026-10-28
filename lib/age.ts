// Huddle is for people aged 18 or older (declared at signup; the database checks it too: handle_new_user,
// check_adult_birth_year). The birth year is optional and private.

export const MIN_AGE = 18;
export const MAX_AGE = 99;

// The birth year typed in a form ('' = not given): null if it's fine, else what's wrong
export function birthYearError(text: string, now = new Date()): string | null {
  if (!text.trim()) return null;
  const year = Number(text);
  if (!Number.isInteger(year) || year < 1900 || year > now.getFullYear()) return 'Scrivi l’anno di nascita per intero, es. 1994';
  if (year > now.getFullYear() - MIN_AGE) return `Huddle è per chi ha almeno ${MIN_AGE} anni`;
  return null;
}
