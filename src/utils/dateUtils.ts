export function getCurrentSession(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)

  // In India, academic sessions usually start in April
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

export function getNextSession(currentSession: string): string {
  const parts = currentSession.split('-');
  if (parts.length !== 2) return currentSession;
  
  const start = parseInt(parts[0], 10);
  const end = parseInt(parts[1], 10);
  
  if (isNaN(start) || isNaN(end)) return currentSession;
  return `${start + 1}-${end + 1}`;
}
