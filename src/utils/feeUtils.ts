import type { Student } from '../types';

/**
 * Returns the effective fee for a specific month.
 * Scans the student's feeHistory to find the most recent fee change that is <= the given month.
 * Falls back to confirmedFee if no history exists or no change is applicable yet.
 * @param month format "YYYY-MM"
 * @param student The student object
 */
export function getFeeForMonth(month: string, student: Student): number {
  const baseFee = Number(student.confirmedFee) || 0;
  
  if (!student.feeHistory || student.feeHistory.length === 0) {
    return baseFee;
  }
  
  // Sort fee history by effectiveMonth ascending
  const sorted = [...student.feeHistory].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
  
  let currentFee = baseFee;
  for (const change of sorted) {
    if (change.effectiveMonth <= month) {
      currentFee = Number(change.amount) || 0;
    }
  }
  
  return currentFee;
}
