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
  subject: string;
  type: SlotType;
  notes?: string;
}

// ─── Fees ──────────────────────────────────────────────────────────────────
export type PaymentMode = 'Cash' | 'PhonePe' | 'Google Pay' | 'Paytm' | 'Online';

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
  subject: string;
  chapter: string;
  topic: string;
  status: SyllabusStatus;
  completedDate?: Timestamp;
}

// ─── Tuition Tests ─────────────────────────────────────────────────────────
export interface TuitionTest {
  id: string;
  title: string;
  subject: string;
  date: Timestamp;
  maxMarks: number;
  studentMarks: Record<string, number>;  // { [studentId]: marks }
}

// ─── School Exams ──────────────────────────────────────────────────────────
export interface SchoolExam {
  id: string;
  studentId: string;
  examName: string;       // SA1, SA2, Unit Test 1…
  subject: string;
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
