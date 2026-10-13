import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, getDocs, where, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, AttendanceRecord, ScheduleSlot } from '../../types';
import { format } from 'date-fns';
import { UserCheck, ArrowRight, X } from 'lucide-react';

export default function AttendanceReminderModal() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ marked: 0, total: 0 });
  const [dontShowToday, setDontShowToday] = useState(false);
  const hasCheckedRef = useRef(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayFormatted = format(new Date(), 'EEEE, dd MMMM yyyy');
  const dayOfWeek = format(new Date(), 'EEEE');

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    // Check only once on initial mount, NOT on every route change
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Clean up stale keys from previous days
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('attendance_reminder_') || key.startsWith('attendance_completed_')) &&
          !key.endsWith(todayStr)
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }

    // 1. If already on attendance page, do not show
    if (location.pathname === '/teacher/attendance') {
      setLoading(false);
      return;
    }

    // 2. Check if dismissed for current browser session
    try {
      if (sessionStorage.getItem(`attendance_reminder_dismissed_${todayStr}`)) {
        setLoading(false);
        return;
      }

      // 3. Check if user selected "Don't show again today"
      if (localStorage.getItem(`attendance_reminder_dismissed_${todayStr}`) === 'full_day') {
        setLoading(false);
        return;
      }

      // 4. Check if currently snoozed (e.g. for 3 hours)
      const snoozeUntil = localStorage.getItem(`attendance_reminder_snooze_${todayStr}`);
      if (snoozeUntil && Date.now() < Number(snoozeUntil)) {
        setLoading(false);
        return;
      }

      // 5. Check if today's attendance was already fully recorded
      if (localStorage.getItem(`attendance_completed_${todayStr}`) === 'true') {
        setLoading(false);
        return;
      }
    } catch {
      // Fallback if storage access is restricted
    }

    let isMounted = true;

    async function checkTodayAttendance() {
      try {
        setLoading(true);

        const [studentsSnap, attendanceSnap, slotsSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(query(collection(db, 'attendance'), where('date', '==', todayStr))),
          getDocs(collectionGroup(db, 'slots'))
        ]);

        if (!isMounted) return;

        const activeStudents = studentsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Student)
          .filter(s => s.active !== false);

        if (activeStudents.length === 0) {
          setIsOpen(false);
          return;
        }

        // Check tuition slots for today's day of week
        const scheduledStudentIds = new Set(
          slotsSnap.docs
            .map(d => {
              const data = d.data();
              const studentId = data.studentId || d.ref.parent.parent?.id;
              return { ...data, studentId } as ScheduleSlot;
            })
            .filter(s => s.day === dayOfWeek && s.type !== 'other_tuition')
            .map(s => s.studentId)
            .filter(Boolean)
        );

        // If timetable slots are defined in the system, only target students scheduled for today
        // If no slots exist at all in the system, fall back to all active students
        const hasAnySlotsDefined = slotsSnap.docs.length > 0;
        const targetStudents = hasAnySlotsDefined
          ? activeStudents.filter(s => scheduledStudentIds.has(s.id))
          : activeStudents;

        const totalExpected = targetStudents.length;
        // If 0 students are expected today (e.g., off day / no slots), do not show reminder
        if (totalExpected === 0) {
          setIsOpen(false);
          return;
        }

        // Count marked students
        const markedStudentIds = new Set(
          attendanceSnap.docs
            .map(d => d.data() as AttendanceRecord)
            .filter(r => r.status === 'present' || r.status === 'absent' || r.status === 'teacher_absent')
            .map(r => r.studentId)
        );

        const markedCount = targetStudents.filter(s => markedStudentIds.has(s.id)).length;

        setStats({ marked: markedCount, total: totalExpected });

        // If not all target students are marked, show reminder
        if (markedCount < totalExpected) {
          // Slight delay so the page loads cleanly first without an aggressive instant jump
          setTimeout(() => {
            if (isMounted) setIsOpen(true);
          }, 600);
        } else {
          // All marked! Save flag so we don't need to ask again today
          try {
            localStorage.setItem(`attendance_completed_${todayStr}`, 'true');
          } catch {
            // Ignore
          }
          setIsOpen(false);
        }
      } catch (err) {
        console.error('Error checking today attendance:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkTodayAttendance();

    return () => {
      isMounted = false;
    };
  }, [todayStr, dayOfWeek]);

  if (!isOpen || loading || location.pathname === '/teacher/attendance') {
    return null;
  }

  const dismissReminder = (forFullDay: boolean) => {
    setIsOpen(false);
    try {
      sessionStorage.setItem(`attendance_reminder_dismissed_${todayStr}`, 'true');
      if (forFullDay) {
        localStorage.setItem(`attendance_reminder_dismissed_${todayStr}`, 'full_day');
      } else {
        // Snooze for 3 hours across tab/browser reopens
        localStorage.setItem(
          `attendance_reminder_snooze_${todayStr}`,
          (Date.now() + 3 * 60 * 60 * 1000).toString()
        );
      }
    } catch {
      // Ignore
    }
  };

  const handleTakeAttendance = () => {
    dismissReminder(false);
    navigate('/teacher/attendance');
  };

  const handleDoItLater = () => {
    dismissReminder(dontShowToday);
  };

  const pendingCount = stats.total - stats.marked;
  const pct = stats.total > 0 ? Math.round((stats.marked / stats.total) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={handleDoItLater}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header" style={{ paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(193, 18, 31, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #c1121f)'
              }}
            >
              <UserCheck size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Attendance Reminder</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {todayFormatted}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={handleDoItLater} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '18px 22px' }}>
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--surface-2)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Today's Status</span>
              <span
                className="badge badge-gray"
                style={{
                  background: stats.marked > 0 ? '#fef3c7' : '#fee2e2',
                  color: stats.marked > 0 ? '#b45309' : '#b91c1c',
                  fontWeight: 600
                }}
              >
                {pendingCount} {pendingCount === 1 ? 'student' : 'students'} pending
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--primary, #c1121f)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>{stats.marked} marked</span>
              <span>{stats.total} total</span>
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text)', marginTop: '14px', marginBottom: 0, lineHeight: 1.5 }}>
            Attendance has not been fully recorded for today. Please take attendance now to keep daily logs and parent records up to date.
          </p>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.84rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              marginTop: '14px',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={e => setDontShowToday(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--primary, #c1121f)' }}
            />
            <span>Don't remind me again today</span>
          </label>
        </div>

        <div className="modal-footer" style={{ padding: '14px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleDoItLater}
            style={{ minWidth: '100px' }}
          >
            Do it later
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleTakeAttendance}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserCheck size={16} />
            <span>Take attendance</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
