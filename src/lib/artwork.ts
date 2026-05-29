export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
