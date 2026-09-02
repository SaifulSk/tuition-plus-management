import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, getDocs, collection, query, Timestamp, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, AttendanceRecord, AttendanceStatus, ScheduleSlot } from '../../types';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const formatTime12h = (time24?: string) => {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  const hours = parseInt(h, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${m} ${suffix}`;
};

interface MarkAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  students: Student[];
}

interface StudentDailyEntry {
  status: AttendanceStatus | 'unmarked';
  checkInTime: string;
  checkOutTime: string;
  remarks: string;
}

export default function MarkAttendanceModal({ isOpen, onClose, onSuccess, students }: MarkAttendanceModalProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterClass, setFilterClass] = useState<string>('');
  const [onlyScheduled, setOnlyScheduled] = useState(true);
  const [allSlots, setAllSlots] = useState<ScheduleSlot[]>([]);
  const [entries, setEntries] = useState<Record<string, StudentDailyEntry>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFutureDate = selectedDate > todayStr;

  // Day of week for selected date
  const selectedDayOfWeek = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    return format(new Date(y, m - 1, d), 'EEEE');
  }, [selectedDate]);

  // Tuition slots for selected day of week grouped by studentId
  const todaySlotsByStudent = useMemo(() => {
    const map: Record<string, ScheduleSlot[]> = {};
    allSlots.forEach(s => {
      if (s.day === selectedDayOfWeek && s.type !== 'other_tuition') {
        if (!map[s.studentId]) map[s.studentId] = [];
        map[s.studentId].push(s);
      }
    });
    return map;
  }, [allSlots, selectedDayOfWeek]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      try {
        const [attSnap, slotsSnap] = await Promise.all([
          getDocs(query(collection(db, 'attendance'))),
          getDocs(collectionGroup(db, 'slots'))
        ]);

        const map: Record<string, StudentDailyEntry> = {};
        attSnap.docs.forEach(d => {
          const r = d.data() as AttendanceRecord;
          if (r.date === selectedDate) {
            map[r.studentId] = {
              status: r.status,
              checkInTime: r.checkInTime || '',
              checkOutTime: r.checkOutTime || '',
              remarks: r.remarks || '',
            };
          }
        });
        setEntries(map);

        const slots = slotsSnap.docs.map(d => {
          const studentId = d.data().studentId || d.ref.parent.parent?.id;
          return { id: d.id, ...d.data(), studentId } as ScheduleSlot;
        });
        setAllSlots(slots);
      } catch (err) {
        console.error('Failed to load data in modal:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => {
    if (s.active === false) return false;
    if (filterClass && s.class !== filterClass) return false;
    
    const hasSlotToday = Boolean(todaySlotsByStudent[s.id] && todaySlotsByStudent[s.id].length > 0);
    const isAlreadyMarked = Boolean(entries[s.id] && entries[s.id].status !== 'unmarked');
    
    return !onlyScheduled || hasSlotToday || isAlreadyMarked;
  });

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    if (isFutureDate) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    const nowTime = format(new Date(), 'HH:mm');
    const firstSlot = todaySlotsByStudent[studentId]?.[0];

    setEntries(prev => {
      const existing = prev[studentId] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
      let checkIn = existing.checkInTime;
      let checkOut = existing.checkOutTime;

      if (status === 'present' || status === 'late') {
        if (!checkIn) checkIn = firstSlot?.startTime || nowTime;
        if (!checkOut && firstSlot?.endTime) checkOut = firstSlot.endTime;
      }

      return {
        ...prev,
        [studentId]: {
          ...existing,
          status,
          checkInTime: (status === 'present' || status === 'late') ? checkIn : '',
          checkOutTime: (status === 'absent' || status === 'leave') ? '' : checkOut,
        }
      };
    });
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    if (isFutureDate) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    const nowTime = format(new Date(), 'HH:mm');
    setEntries(prev => {
      const updated = { ...prev };
      filteredStudents.forEach(s => {
        const existing = updated[s.id] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
        const firstSlot = todaySlotsByStudent[s.id]?.[0];

        let checkIn = existing.checkInTime;
        let checkOut = existing.checkOutTime;

        if (status === 'present' || status === 'late') {
          if (!checkIn) checkIn = firstSlot?.startTime || nowTime;
          if (!checkOut && firstSlot?.endTime) checkOut = firstSlot.endTime;
        }

        updated[s.id] = {
          ...existing,
          status,
          checkInTime: (status === 'present' || status === 'late') ? checkIn : '',
          checkOutTime: (status === 'absent' || status === 'leave') ? '' : checkOut,
        };
      });
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFutureDate) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    setSaving(true);
    try {
      const promises = filteredStudents.map(async s => {
        const entry = entries[s.id];
        if (!entry || entry.status === 'unmarked') return Promise.resolve();

        const docId = `${selectedDate}_${s.id}`;
        const record: AttendanceRecord = {
          id: docId,
          date: selectedDate,
          timestamp: Timestamp.fromDate(new Date(selectedDate)),
          studentId: s.id,
          studentName: s.name,
          studentClass: s.class,
          status: entry.status as AttendanceStatus,
          checkInTime: entry.checkInTime || '',
          checkOutTime: entry.checkOutTime || '',
          remarks: entry.remarks || '',
          markedAt: Timestamp.now(),
        };

        return setDoc(doc(db, 'attendance', docId), record);
      });

      await Promise.all(promises);
      toast.success('Attendance recorded successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={20} color="var(--navy)" />
            <h2>Mark Attendance</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          {/* Controls */}
          <div className="form-grid-2 mb-16">
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                className="input"
                value={selectedDate}
                max={todayStr}
                onChange={e => setSelectedDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Filter by Class</label>
              <select
                className="input"
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
              >
                <option value="">All Classes</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
          </div>

          {/* Future Date Alert */}
          {isFutureDate && (
            <div className="card mb-16" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Future date selected. Cannot mark attendance.</span>
            </div>
          )}

          {/* Schedule filter toggle & bulk actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: '16px',
                border: onlyScheduled ? '1px solid var(--navy, #1E3A5F)' : '1px solid var(--border)',
                background: onlyScheduled ? 'rgba(30, 58, 95, 0.08)' : 'transparent',
                fontWeight: 600,
                color: onlyScheduled ? 'var(--navy)' : 'var(--text-muted)',
              }}
              onClick={() => setOnlyScheduled(!onlyScheduled)}
            >
              {onlyScheduled ? `📅 Scheduled on ${selectedDayOfWeek} (${Object.keys(todaySlotsByStudent).length})` : '👥 All Students'}
            </button>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '4px 10px', height: 'auto', color: '#15803d' }}
                onClick={() => handleMarkAll('present')}
                disabled={isFutureDate}
              >
                Mark All Present
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '4px 10px', height: 'auto', color: '#b91c1c' }}
                onClick={() => handleMarkAll('absent')}
                disabled={isFutureDate}
              >
                Mark All Absent
              </button>
            </div>
          </div>

          {/* Student list */}
          <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {loading ? (
              <div className="skeleton-list">
                {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="empty-state">
                <p>
                  {onlyScheduled
                    ? `No students have tuition slots scheduled on ${selectedDayOfWeek}.`
                    : 'No students match the selected class.'}
                </p>
                {onlyScheduled && (
                  <button
                    type="button"
                    className="btn-link mt-8"
                    onClick={() => setOnlyScheduled(false)}
                  >
                    Show All Students
                  </button>
                )}
              </div>
            ) : (
              filteredStudents.map(student => {
                const entry = entries[student.id] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
                const isPresentOrLate = entry.status === 'present' || entry.status === 'late';
                const studentSlots = todaySlotsByStudent[student.id];

                return (
                  <div key={student.id} className={`attendance-student-card status-${entry.status}`} style={{ padding: '12px', marginBottom: '8px' }}>
                    <div className="attendance-row-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="student-avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{student.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Class {student.class}
                            {studentSlots && studentSlots.length > 0 && (
                              <span style={{ marginLeft: '6px', color: 'var(--navy)', fontWeight: 600 }}>
                                • ⏰ {formatTime12h(studentSlots[0].startTime)} - {formatTime12h(studentSlots[0].endTime)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="attendance-status-group">
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'present' ? 'active-present' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'present')}
                          disabled={isFutureDate}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'absent' ? 'active-absent' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'absent')}
                          disabled={isFutureDate}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'late' ? 'active-late' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'late')}
                          disabled={isFutureDate}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'leave' ? 'active-leave' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'leave')}
                          disabled={isFutureDate}
                        >
                          E
                        </button>
                      </div>
                    </div>

                    {isPresentOrLate && (
                      <div className="attendance-time-inputs" style={{ marginTop: '8px', paddingTop: '8px' }}>
                        <div className="attendance-time-box">
                          <span>In:</span>
                          <input
                            type="time"
                            value={entry.checkInTime}
                            disabled={isFutureDate}
                            onChange={e => setEntries(prev => ({
                              ...prev,
                              [student.id]: { ...(prev[student.id] || { status: 'present', checkInTime: '', checkOutTime: '', remarks: '' }), checkInTime: e.target.value }
                            }))}
                          />
                        </div>
                        <div className="attendance-time-box">
                          <span>Out:</span>
                          <input
                            type="time"
                            value={entry.checkOutTime}
                            disabled={isFutureDate}
                            onChange={e => setEntries(prev => ({
                              ...prev,
                              [student.id]: { ...(prev[student.id] || { status: 'present', checkInTime: '', checkOutTime: '', remarks: '' }), checkOutTime: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || isFutureDate}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
