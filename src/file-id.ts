export function parseFileId(input: string): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  const withoutSuffix = value
    .split(/[?#]/, 1)[0]
    .replace(/\/+$/, '');

  const lastSegment = withoutSuffix.split('/').pop() ?? withoutSuffix;
  let decoded = lastSegment.trim();

  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    // Keep the original text if decoding fails.
  }

  const exact = decoded.match(/^(?:file)?(\d+)$/i);
  if (exact) return exact[1];

  const suffixed = decoded.match(/file(\d+)$/i);
  return suffixed?.[1] ?? null;
}

export function requireFileId(input: string): string {
  const fileId = parseFileId(input);
  if (!fileId) {
    throw new Error(`Invalid file ID or URL: ${input}`);
  }
  return fileId;
}
