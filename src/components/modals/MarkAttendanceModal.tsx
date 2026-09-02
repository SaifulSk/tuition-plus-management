import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, deleteDoc, getDocs, collection, query, Timestamp, collectionGroup } from 'firebase/firestore';
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

      if (status === 'present') {
        if (!checkIn) checkIn = firstSlot?.startTime || nowTime;
        if (!checkOut && firstSlot?.endTime) checkOut = firstSlot.endTime;
      }

      return {
        ...prev,
        [studentId]: {
          ...existing,
          status,
          checkInTime: status === 'present' ? checkIn : '',
          checkOutTime: status === 'present' ? checkOut : '',
        }
      };
    });
  };

  const clearStatus = (studentId: string) => {
    if (isFutureDate) return;
    setEntries(prev => ({
      ...prev,
      [studentId]: { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' }
    }));
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

        if (status === 'present') {
          if (!checkIn) checkIn = firstSlot?.startTime || nowTime;
          if (!checkOut && firstSlot?.endTime) checkOut = firstSlot.endTime;
        }

        updated[s.id] = {
          ...existing,
          status,
          checkInTime: status === 'present' ? checkIn : '',
          checkOutTime: status === 'present' ? checkOut : '',
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
        const docId = `${selectedDate}_${s.id}`;

        if (!entry || entry.status === 'unmarked') {
          return deleteDoc(doc(db, 'attendance', docId)).catch(() => {});
        }

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
      <div className="modal large" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={18} color="var(--navy)" />
            <h2 style={{ fontSize: '17px' }}>Mark Attendance</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body" style={{ padding: '14px 18px' }}>
          {/* Controls */}
          <div className="form-grid-2 mb-12" style={{ gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px' }}>Date *</label>
              <input
                type="date"
                className="input"
                style={{ fontSize: '13px', padding: '6px 8px' }}
                value={selectedDate}
                max={todayStr}
                onChange={e => setSelectedDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px' }}>Filter by Class</label>
              <select
                className="input"
                style={{ fontSize: '13px', padding: '6px 8px' }}
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
            <div className="card mb-12" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
              <AlertCircle size={15} />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Future date selected. Cannot mark attendance.</span>
            </div>
          )}

          {/* Schedule filter toggle & bulk actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '14px',
                border: onlyScheduled ? '1px solid var(--navy, #1E3A5F)' : '1px solid var(--border)',
                background: onlyScheduled ? 'rgba(30, 58, 95, 0.08)' : 'transparent',
                fontWeight: 600,
                color: onlyScheduled ? 'var(--navy)' : 'var(--text-muted)',
              }}
              onClick={() => setOnlyScheduled(!onlyScheduled)}
            >
              {onlyScheduled ? `📅 Scheduled on ${selectedDayOfWeek} (${Object.keys(todaySlotsByStudent).length})` : '👥 All Students'}
            </button>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#15803d', border: '1px solid #bbf7d0', background: '#f0fdf4' }}
                onClick={() => handleMarkAll('present')}
                disabled={isFutureDate}
              >
                All Present
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#b91c1c', border: '1px solid #fecaca', background: '#fef2f2' }}
                onClick={() => handleMarkAll('absent')}
                disabled={isFutureDate}
              >
                All Absent
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#6d28d9', border: '1px solid #ddd6fe', background: '#f5f3ff' }}
                onClick={() => handleMarkAll('teacher_absent')}
                disabled={isFutureDate}
              >
                Teacher Absent
              </button>
            </div>
          </div>

          {/* Student list */}
          <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '2px' }}>
            {loading ? (
              <div className="skeleton-list">
                {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <p style={{ fontSize: '13px' }}>
                  {onlyScheduled
                    ? `No students have tuition slots scheduled on ${selectedDayOfWeek}.`
                    : 'No students match the selected class.'}
                </p>
                {onlyScheduled && (
                  <button
                    type="button"
                    className="btn-link mt-8"
                    style={{ fontSize: '12px' }}
                    onClick={() => setOnlyScheduled(false)}
                  >
                    Show All Students
                  </button>
                )}
              </div>
            ) : (
              filteredStudents.map(student => {
                const entry = entries[student.id] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
                const isPresent = entry.status === 'present';
                const studentSlots = todaySlotsByStudent[student.id];

                return (
                  <div key={student.id} className={`attendance-student-card status-${entry.status}`} style={{ padding: '10px 12px', marginBottom: '8px' }}>
                    <div className="attendance-row-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '150px' }}>
                        <div className="student-avatar" style={{ width: '30px', height: '30px', fontSize: '12px' }}>
                          {student.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {student.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Class {student.class}
                            {studentSlots && studentSlots.length > 0 && (
                              <span style={{ marginLeft: '4px', color: 'var(--navy)', fontWeight: 600 }}>
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
                          style={{ padding: '3px 9px', fontSize: '11px' }}
                          onClick={() => setStatus(student.id, 'present')}
                          disabled={isFutureDate}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'absent' ? 'active-absent' : ''}`}
                          style={{ padding: '3px 9px', fontSize: '11px' }}
                          onClick={() => setStatus(student.id, 'absent')}
                          disabled={isFutureDate}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'teacher_absent' ? 'active-teacher_absent' : ''}`}
                          style={{ padding: '3px 9px', fontSize: '11px' }}
                          onClick={() => setStatus(student.id, 'teacher_absent')}
                          disabled={isFutureDate}
                        >
                          TA
                        </button>
                        {entry.status !== 'unmarked' && (
                          <button
                            type="button"
                            className="attendance-status-btn"
                            style={{ padding: '3px 6px', fontSize: '11px', color: '#64748b' }}
                            onClick={() => clearStatus(student.id)}
                            disabled={isFutureDate}
                            title="Clear student mark"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isPresent && (
                      <div className="attendance-time-inputs" style={{ marginTop: '6px', paddingTop: '6px' }}>
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

          <div className="modal-footer" style={{ padding: '12px 18px' }}>
            <button type="button" className="btn-ghost" style={{ fontSize: '13px', padding: '6px 14px' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ fontSize: '13px', padding: '6px 18px' }} disabled={saving || isFutureDate}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
