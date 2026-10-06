// Attachment rules shared by the upload route and the UI.

/** What can be uploaded. SVG is deliberately not allowed (it can carry scripts). */
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
export const MAX_BYTES = 10 * 1024 * 1024;

export const isImage = (mimeType: string) => mimeType.startsWith("image/");

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
