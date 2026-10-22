// How people are shown: a name when they have one, else one made from their email.

/** "b.colegrove@…" → "B. Colegrove" when there's no name. */
export function displayName(u: { name?: string | null; email: string }): string {
  if (u.name?.trim()) return u.name.trim();
  return u.email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => (w.length === 1 ? `${w.toUpperCase()}.` : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}
