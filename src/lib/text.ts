// Normalize a part name for duplicate-proof matching: lowercase, strip everything but a–z/0–9.
// So "ABC-123", "abc 123", and "abc123" all collapse to the same key.
export function normalizeKey(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
