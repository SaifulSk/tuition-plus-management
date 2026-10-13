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

export function getRecentSessions(count = 6): string[] {
  const current = getCurrentSession();
  const baseYear = parseInt(current.split('-')[0], 10);
  const sessions: string[] = [];
  for (let i = -2; i <= count - 3; i++) {
    const yr = baseYear + i;
    sessions.push(`${yr}-${yr + 1}`);
  }
  return sessions.reverse();
}

export function getSessionFromDate(date: any): string {
  if (!date) return getCurrentSession();
  let d: Date;
  if (typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    return getCurrentSession();
  }
  if (isNaN(d.getTime())) return getCurrentSession();
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

export function getSessionFromMonthStr(monthStr: string): string {
  if (!monthStr || typeof monthStr !== 'string' || !monthStr.includes('-')) return getCurrentSession();
  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10) - 1; // 0-indexed
  if (isNaN(year) || isNaN(month)) return getCurrentSession();
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}


