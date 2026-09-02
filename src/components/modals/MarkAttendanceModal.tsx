import { useState, useEffect } from 'react';
import { doc, setDoc, getDocs, collection, query, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, AttendanceRecord, AttendanceStatus } from '../../types';
import { X, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

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
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [filterClass, setFilterClass] = useState<string>('');
  const [entries, setEntries] = useState<Record<string, StudentDailyEntry>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadDateAttendance() {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'attendance')));
        const map: Record<string, StudentDailyEntry> = {};
        snap.docs.forEach(d => {
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
      } catch (err) {
        console.error('Failed to load date attendance in modal:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDateAttendance();
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => s.active !== false && (!filterClass || s.class === filterClass));

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    const nowTime = format(new Date(), 'HH:mm');
    setEntries(prev => {
      const existing = prev[studentId] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
      return {
        ...prev,
        [studentId]: {
          ...existing,
          status,
          checkInTime: (status === 'present' || status === 'late') ? (existing.checkInTime || nowTime) : '',
          checkOutTime: (status === 'absent' || status === 'leave') ? '' : existing.checkOutTime,
        }
      };
    });
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const nowTime = format(new Date(), 'HH:mm');
    setEntries(prev => {
      const updated = { ...prev };
      filteredStudents.forEach(s => {
        const existing = updated[s.id] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
        updated[s.id] = {
          ...existing,
          status,
          checkInTime: (status === 'present' || status === 'late') ? (existing.checkInTime || nowTime) : '',
          checkOutTime: (status === 'absent' || status === 'leave') ? '' : existing.checkOutTime,
        };
      });
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Students ({filteredStudents.length})
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '4px 10px', height: 'auto', color: '#15803d' }}
                onClick={() => handleMarkAll('present')}
              >
                Mark All Present
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '4px 10px', height: 'auto', color: '#b91c1c' }}
                onClick={() => handleMarkAll('absent')}
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
                <p>No students match the selected class.</p>
              </div>
            ) : (
              filteredStudents.map(student => {
                const entry = entries[student.id] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
                const isPresentOrLate = entry.status === 'present' || entry.status === 'late';

                return (
                  <div key={student.id} className={`attendance-student-card status-${entry.status}`} style={{ padding: '12px', marginBottom: '8px' }}>
                    <div className="attendance-row-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="student-avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{student.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Class {student.class}</div>
                        </div>
                      </div>

                      <div className="attendance-status-group">
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'present' ? 'active-present' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'present')}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'absent' ? 'active-absent' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'absent')}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'late' ? 'active-late' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'late')}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${entry.status === 'leave' ? 'active-leave' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setStatus(student.id, 'leave')}
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
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
