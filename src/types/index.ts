import { Timestamp } from 'firebase/firestore';

// ─── User ──────────────────────────────────────────────────────────────────
export interface AppUser {
  uid: string;
  role: 'teacher' | 'student';
  name: string;
  email: string;
}

// ─── Student ───────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  class: string;
  session?: string;
  section: string;
  school: string;
  phone: string;
  parentPhone: string;
  subjects: string[];       // custom per student
  joiningDate: Timestamp;
  confirmedFee: number;
  notes: string;
  uid: string;              // Firebase Auth uid for student login
  email: string;
  active: boolean;
  leavingMonth?: string;
  feeHistory?: FeeChange[];
}

export interface FeeChange {
  amount: number;
  effectiveMonth: string; // "YYYY-MM"
  subjects?: string[];    // optional: subjects in effect from this month
  note?: string;          // optional: reason/note for the change
}

// ─── Schedule ──────────────────────────────────────────────────────────────
export type SlotType = 'tuition' | 'other_tuition';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface ScheduleSlot {
  id: string;
  studentId: string;
  day: DayOfWeek;
  startTime: string;  // "HH:mm"
  endTime: string;
  subjects: string[];
  type: SlotType;
  notes?: string;
}

// ─── Fees ──────────────────────────────────────────────────────────────────
export type PaymentMode = 'Cash' | 'PhonePe' | 'Google Pay' | 'Paytm' | 'Online' | 'Waived / Leave';

export interface FeePayment {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  amount: number;
  monthsPaid: string[];   // ["2026-05", "2026-06"]
  datePaid: Timestamp;
  mode: PaymentMode;
}

// ─── Syllabus ──────────────────────────────────────────────────────────────
export type SyllabusStatus = 'not_started' | 'in_progress' | 'completed';

export interface SyllabusTopic {
  id: string;
  studentId: string;
  subjects: string[];
  chapter: string;
  topic: string;
  status: SyllabusStatus;
  completedDate?: Timestamp;
}

// ─── Tuition Tests ─────────────────────────────────────────────────────────
export interface TuitionTest {
  id: string;
  title: string;
  subjects: string[];
  date: Timestamp;
  maxMarks: number;
  studentMarks: Record<string, number>;  // { [studentId]: marks }
}

// ─── School Exams ──────────────────────────────────────────────────────────
export interface SchoolExam {
  id: string;
  studentId: string;
  examName: string;       // SA1, SA2, Unit Test 1…
  session?: string;
  className?: string;
  subjects: string[];
  maxMarks: number;
  marksObtained: number;
  date: Timestamp;
  percentage?: number;
}

// ─── Events ────────────────────────────────────────────────────────────────
export type EventType = 'picnic' | 'farewell' | 'feast' | 'study_trip' | 'other';

export interface CenterEvent {
  id: string;
  title: string;
  type: EventType;
  date: Timestamp;
  description: string;
  attendees: string[];    // student IDs
  photoUrls: string[];
}

// ─── Homework ──────────────────────────────────────────────────────────────
export interface Homework {
  id: string;
  title: string;
  description: string;
  subject: string;
  targetClass: string; // e.g., "9"
  dueDate: Timestamp;
  assignedDate: Timestamp;
  completedBy: string[]; // Array of student IDs
}
