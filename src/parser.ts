export function parseTimer(timerStr: string): number | null {
  const parts = timerStr.trim().split(':').map(Number);

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return parts[0] * 60 + parts[1];
  }

  return null;
}
