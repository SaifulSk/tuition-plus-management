import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Student, AttendanceRecord } from '../../types';
import {
  UserCheck, CheckCircle2, XCircle, Clock, Calendar
} from 'lucide-react';
import { format, getDaysInMonth, getDay } from 'date-fns';

export default function StudentAttendance() {
  const { appUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      try {
        const userDoc = await getDoc(doc(db, 'users', appUser!.uid));
        const studentId = userDoc.data()?.studentId;
        if (!studentId) { setLoading(false); return; }

        const sSnap = await getDoc(doc(db, 'students', studentId));
        if (sSnap.exists()) setStudent({ id: sSnap.id, ...sSnap.data() } as Student);

        const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));
        const studentRecs = snap.docs
          .map(d => d.data() as AttendanceRecord)
          .filter(r => r.studentId === studentId);
        setRecords(studentRecs);
      } catch (err) {
        console.error('Failed to load student attendance:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appUser]);

  // Overall stats
  const overallStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    records.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'late') late++;
      else if (r.status === 'leave') leave++;
    });

    const total = present + absent + late + leave;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, absent, late, leave, pct };
  }, [records]);

  // Month filtered stats
  const monthStats = useMemo(() => {
    const monthFiltered = records.filter(r => r.date.startsWith(selectedMonth));
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    monthFiltered.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'late') late++;
      else if (r.status === 'leave') leave++;
    });

    const total = present + absent + late + leave;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, absent, late, leave, pct, records: monthFiltered };
  }, [records, selectedMonth]);

  // Calendar days for selected month
  const calendarDays = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const totalDays = getDaysInMonth(firstDay);
    const startDayOfWeek = getDay(firstDay); // 0 (Sun) to 6 (Sat)
    
    const dayMap = new Map<string, AttendanceRecord>();
    records.filter(r => r.date.startsWith(selectedMonth)).forEach(r => {
      dayMap.set(r.date, r);
    });

    const items: Array<{ dayNum?: number; dateStr?: string; record?: AttendanceRecord; isToday?: boolean }> = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      items.push({});
    }
    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${selectedMonth}-${String(i).padStart(2, '0')}`;
      items.push({
        dayNum: i,
        dateStr: dStr,
        record: dayMap.get(dStr),
        isToday: dStr === format(new Date(), 'yyyy-MM-dd'),
      });
    }
    return items;
  }, [selectedMonth, records]);

  if (loading) return <div className="page"><div className="loader large" /></div>;
  if (!student) return <div className="page"><p>Profile not found. Contact your teacher.</p></div>;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-sub">Track your tuition attendance, timings & session history</p>
        </div>
        <div className="page-date">
          <Calendar size={16} />
          <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="stats-grid mb-16">
        <div className="stat-card stat-green">
          <div className="stat-icon"><CheckCircle2 size={24} /></div>
          <div className="stat-body">
            <div className="stat-value">{overallStats.pct}%</div>
            <div className="stat-label">Overall Attendance</div>
            <div className="stat-sub">{overallStats.present + overallStats.late} of {overallStats.total} total sessions</div>
          </div>
        </div>

        <div className="stat-card stat-blue">
          <div className="stat-icon"><Calendar size={24} /></div>
          <div className="stat-body">
            <div className="stat-value">{monthStats.pct}%</div>
            <div className="stat-label">This Month Rate</div>
            <div className="stat-sub">{monthStats.present + monthStats.late} of {monthStats.total} sessions in {format(new Date(selectedMonth + '-01'), 'MMM yyyy')}</div>
          </div>
        </div>

        <div className="stat-card stat-orange">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-body">
            <div className="stat-value">{monthStats.late}</div>
            <div className="stat-label">Late Arrivals</div>
            <div className="stat-sub">This month</div>
          </div>
        </div>

        <div className="stat-card stat-red">
          <div className="stat-icon"><XCircle size={24} /></div>
          <div className="stat-body">
            <div className="stat-value">{monthStats.absent}</div>
            <div className="stat-label">Absences</div>
            <div className="stat-sub">{monthStats.leave} excused leaves</div>
          </div>
        </div>
      </div>

      {/* Monthly Attendance Calendar */}
      <div className="card mb-16">
        <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            📅 {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')} Calendar
          </h3>
          <input
            type="month"
            className="input"
            style={{ width: 'auto' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
        </div>

        <div className="attendance-calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="attendance-calendar-header">{d}</div>
          ))}
          {calendarDays.map((item, idx) => {
            if (!item.dayNum) {
              return <div key={`empty-${idx}`} className="attendance-calendar-day empty-day" />;
            }

            const rec = item.record;
            let dayClass = '';
            if (rec) {
              if (rec.status === 'present') dayClass = 'day-present';
              else if (rec.status === 'absent') dayClass = 'day-absent';
              else if (rec.status === 'late') dayClass = 'day-late';
              else if (rec.status === 'leave') dayClass = 'day-leave';
            }

            return (
              <div key={item.dateStr} className={`attendance-calendar-day ${dayClass} ${item.isToday ? 'day-today' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{item.dayNum}</span>
                  {rec && (
                    <span
                      className={`attendance-matrix-badge ${rec.status === 'present' ? 'p' : rec.status === 'absent' ? 'a' : rec.status === 'late' ? 'l' : 'e'}`}
                      style={{ width: '20px', height: '20px', fontSize: '10px' }}
                    >
                      {rec.status.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {rec && rec.checkInTime && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    ⏰ {rec.checkInTime}{rec.checkOutTime ? ` - ${rec.checkOutTime}` : ''}
                  </div>
                )}
                {rec && rec.remarks && (
                  <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.remarks}>
                    💬 {rec.remarks}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <h3 className="section-title mb-16">Attendance History Log</h3>
        {records.length === 0 ? (
          <div className="empty-state">
            <UserCheck size={36} />
            <p>No attendance records found yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><strong>{format(new Date(r.date), 'dd MMM yyyy')}</strong></td>
                    <td>
                      <span className={`badge ${r.status === 'present' ? 'badge-green' : r.status === 'absent' ? 'badge-red' : r.status === 'late' ? 'badge-yellow' : 'badge-blue'}`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{r.checkInTime || '—'}</td>
                    <td>{r.checkOutTime || '—'}</td>
                    <td>{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
