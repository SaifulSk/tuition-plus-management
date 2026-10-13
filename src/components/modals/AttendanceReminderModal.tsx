import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, getDocs, where, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, AttendanceRecord, ScheduleSlot } from '../../types';
import { format } from 'date-fns';
import { UserCheck, ArrowRight, X } from 'lucide-react';

// Tracks whether the reload check has already executed for this browser page lifecycle
let hasCheckedForThisPageLifecycle = false;

function isPageReload(): boolean {
  try {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries && navEntries.length > 0) {
      const navEntry = navEntries[0] as PerformanceNavigationTiming;
      return navEntry.type === 'reload';
    }
    // Fallback for older browsers
    const perfNav = (performance as unknown as { navigation?: { type?: number } }).navigation;
    if (perfNav) {
      return perfNav.type === 1; // 1 = TYPE_RELOAD
    }
  } catch {
    // Ignore error
  }
  return false;
}

export default function AttendanceReminderModal() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ marked: 0, total: 0 });

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
    // Only check once per browser page lifecycle
    if (hasCheckedForThisPageLifecycle) return;

    // Check conditions:
    // 1. Must be in the dashboard page (/teacher or /teacher/)
    const isDashboard = location.pathname.replace(/\/$/, '') === '/teacher';
    // 2. Page must have been reloaded by the browser
    const reloaded = isPageReload();

    if (!isDashboard || !reloaded) {
      hasCheckedForThisPageLifecycle = true;
      return;
    }

    hasCheckedForThisPageLifecycle = true;
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
          setTimeout(() => {
            if (isMounted) setIsOpen(true);
          }, 400);
        } else {
          setIsOpen(false);
        }
      } catch (err) {
        console.error('Error checking today attendance on reload:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkTodayAttendance();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, todayStr, dayOfWeek]);

  if (!isOpen || loading) {
    return null;
  }

  const pendingCount = stats.total - stats.marked;
  const pct = stats.total > 0 ? Math.round((stats.marked / stats.total) * 100) : 0;

  const handleTakeAttendance = () => {
    setIsOpen(false);
    navigate('/teacher/attendance');
  };

  const handleDoItLater = () => {
    setIsOpen(false);
  };

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
