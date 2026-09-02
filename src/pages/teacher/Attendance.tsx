import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, getDocs, doc, setDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, AttendanceRecord, AttendanceStatus } from '../../types';
import {
  UserCheck, Calendar, Users, CheckCircle2, XCircle, Clock,
  AlertCircle, ChevronLeft, ChevronRight, Download, Search,
  BarChart3, AlertTriangle, Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays, subDays, getDaysInMonth, getDay } from 'date-fns';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

type ViewTab = 'daily' | 'register' | 'insights';

interface DailyStudentState {
  status: AttendanceStatus | 'unmarked';
  checkInTime: string;
  checkOutTime: string;
  remarks: string;
}

export default function Attendance() {
  const [activeTab, setActiveTab] = useState<ViewTab>('daily');
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Daily View State
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [filterClass, setFilterClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dailyStates, setDailyStates] = useState<Record<string, DailyStudentState>>({});
  const [savingDaily, setSavingDaily] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // Register View State
  const [registerMonth, setRegisterMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [registerClass, setRegisterClass] = useState<string>('');
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRegister, setLoadingRegister] = useState(false);

  // Insights / Student View State
  const [insightClass, setInsightClass] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [insightMonth, setInsightMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  // Load active students
  useEffect(() => {
    async function fetchStudents() {
      try {
        const snap = await getDocs(query(collection(db, 'students'), orderBy('name')));
        const active = snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Student)
          .filter(s => s.active !== false);
        setStudents(active);
      } catch (err) {
        console.error('Failed to load students:', err);
        toast.error('Failed to load students');
      } finally {
        setLoadingStudents(false);
      }
    }
    fetchStudents();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DAILY ATTENDANCE LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  const loadDailyAttendance = useCallback(async (dateStr: string) => {
    setLoadingDaily(true);
    try {
      // Query attendance for this date
      const snap = await getDocs(query(collection(db, 'attendance')));
      const map: Record<string, DailyStudentState> = {};

      snap.docs.forEach(d => {
        const data = d.data() as AttendanceRecord;
        if (data.date === dateStr) {
          map[data.studentId] = {
            status: data.status,
            checkInTime: data.checkInTime || '',
            checkOutTime: data.checkOutTime || '',
            remarks: data.remarks || '',
          };
        }
      });

      setDailyStates(map);
    } catch (err) {
      console.error('Failed to load daily attendance:', err);
      toast.error('Failed to load attendance for selected date');
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyAttendance(selectedDate);
    }
  }, [activeTab, selectedDate, loadDailyAttendance]);

  const filteredDailyStudents = useMemo(() => {
    return students.filter(s => {
      const matchClass = !filterClass || s.class === filterClass;
      const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.school.toLowerCase().includes(searchQuery.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [students, filterClass, searchQuery]);

  const dailyStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    let unmarked = 0;

    filteredDailyStudents.forEach(s => {
      const st = dailyStates[s.id]?.status;
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'leave') leave++;
      else unmarked++;
    });

    const total = filteredDailyStudents.length;
    const marked = total - unmarked;
    const presentPct = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;

    return { total, present, absent, late, leave, unmarked, presentPct };
  }, [filteredDailyStudents, dailyStates]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setDailyStates(prev => {
      const existing = prev[studentId] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
      const nowTime = format(new Date(), 'HH:mm');
      
      let checkIn = existing.checkInTime;
      if ((status === 'present' || status === 'late') && !checkIn) {
        checkIn = nowTime;
      }

      return {
        ...prev,
        [studentId]: {
          ...existing,
          status,
          checkInTime: status === 'absent' || status === 'leave' ? '' : checkIn,
          checkOutTime: status === 'absent' || status === 'leave' ? '' : existing.checkOutTime,
        }
      };
    });
  };

  const setStudentCheckIn = (studentId: string, time: string) => {
    setDailyStates(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'present', checkInTime: '', checkOutTime: '', remarks: '' }),
        checkInTime: time,
      }
    }));
  };

  const setStudentCheckOut = (studentId: string, time: string) => {
    setDailyStates(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'present', checkInTime: '', checkOutTime: '', remarks: '' }),
        checkOutTime: time,
      }
    }));
  };

  const setStudentRemarks = (studentId: string, remarks: string) => {
    setDailyStates(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' }),
        remarks,
      }
    }));
  };

  const handleBulkMark = (status: AttendanceStatus) => {
    const nowTime = format(new Date(), 'HH:mm');
    setDailyStates(prev => {
      const updated = { ...prev };
      filteredDailyStudents.forEach(s => {
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
    toast.success(`Marked all as ${status.toUpperCase()}`);
  };

  const handleClearAll = () => {
    setDailyStates(prev => {
      const updated = { ...prev };
      filteredDailyStudents.forEach(s => {
        delete updated[s.id];
      });
      return updated;
    });
    toast.success('Cleared marks for selected students');
  };

  const handleSaveDaily = async () => {
    setSavingDaily(true);
    try {
      const batchPromises = filteredDailyStudents.map(async s => {
        const st = dailyStates[s.id];
        if (!st || st.status === 'unmarked') return Promise.resolve();

        const docId = `${selectedDate}_${s.id}`;
        const record: AttendanceRecord = {
          id: docId,
          date: selectedDate,
          timestamp: Timestamp.fromDate(new Date(selectedDate)),
          studentId: s.id,
          studentName: s.name,
          studentClass: s.class,
          status: st.status as AttendanceStatus,
          checkInTime: st.checkInTime || '',
          checkOutTime: st.checkOutTime || '',
          remarks: st.remarks || '',
          markedAt: Timestamp.now(),
        };

        return setDoc(doc(db, 'attendance', docId), record);
      });

      await Promise.all(batchPromises);
      toast.success('Attendance saved successfully!');
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save attendance');
    } finally {
      setSavingDaily(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MONTHLY REGISTER LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  const loadMonthRecords = useCallback(async (monthStr: string) => {
    setLoadingRegister(true);
    try {
      const snap = await getDocs(query(collection(db, 'attendance')));
      const records = snap.docs
        .map(d => d.data() as AttendanceRecord)
        .filter(r => r.date && r.date.startsWith(monthStr));
      setMonthRecords(records);
    } catch (err) {
      console.error('Failed to load month attendance:', err);
      toast.error('Failed to load month register');
    } finally {
      setLoadingRegister(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'register') {
      loadMonthRecords(registerMonth);
    }
  }, [activeTab, registerMonth, loadMonthRecords]);

  const daysInRegisterMonth = useMemo(() => {
    const [y, m] = registerMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const totalDays = getDaysInMonth(date);
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dayDate = new Date(y, m - 1, dayNum);
      const dateStr = `${registerMonth}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = format(dayDate, 'EEE');
      const isWeekend = dayOfWeek === 'Sun';
      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
      return { dayNum, dateStr, dayOfWeek, isWeekend, isToday };
    });
  }, [registerMonth]);

  const filteredRegisterStudents = useMemo(() => {
    return students.filter(s => !registerClass || s.class === registerClass);
  }, [students, registerClass]);

  const registerMatrix = useMemo(() => {
    const recordMap: Record<string, AttendanceRecord> = {};
    monthRecords.forEach(r => {
      recordMap[`${r.studentId}_${r.date}`] = r;
    });

    return filteredRegisterStudents.map(student => {
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;

      const dayCells = daysInRegisterMonth.map(d => {
        const record = recordMap[`${student.id}_${d.dateStr}`];
        if (record) {
          if (record.status === 'present') presentCount++;
          else if (record.status === 'absent') absentCount++;
          else if (record.status === 'late') lateCount++;
          else if (record.status === 'leave') leaveCount++;
        }
        return {
          dateStr: d.dateStr,
          status: record?.status || null,
          checkIn: record?.checkInTime,
          checkOut: record?.checkOutTime,
          remarks: record?.remarks,
        };
      });

      const totalMarked = presentCount + absentCount + lateCount + leaveCount;
      const pct = totalMarked > 0 ? Math.round(((presentCount + lateCount) / totalMarked) * 100) : 0;

      return {
        student,
        dayCells,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        totalMarked,
        pct,
      };
    });
  }, [filteredRegisterStudents, monthRecords, daysInRegisterMonth]);

  const exportToCSV = () => {
    const header = ['Student Name', 'Class', 'School', ...daysInRegisterMonth.map(d => `${d.dayNum} (${d.dayOfWeek})`), 'Present', 'Absent', 'Late', 'Leave', 'Attendance %'];
    const rows = registerMatrix.map(row => {
      const dayCols = row.dayCells.map(c => {
        if (!c.status) return '-';
        if (c.status === 'present') return c.checkIn ? `P (${c.checkIn})` : 'P';
        if (c.status === 'absent') return 'A';
        if (c.status === 'late') return c.checkIn ? `L (${c.checkIn})` : 'L';
        if (c.status === 'leave') return 'E';
        return '-';
      });

      return [
        `"${row.student.name}"`,
        `"Class ${row.student.class}"`,
        `"${row.student.school}"`,
        ...dayCols,
        row.presentCount,
        row.absentCount,
        row.lateCount,
        row.leaveCount,
        `${row.pct}%`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Register_${registerMonth}_Class_${registerClass || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Attendance CSV exported!');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. INSIGHTS & STUDENT LOOKUP LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  const loadStudentRecords = useCallback(async (studentId: string) => {
    if (!studentId) return;
    try {
      const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));
      const list = snap.docs
        .map(d => d.data() as AttendanceRecord)
        .filter(r => r.studentId === studentId);
      setStudentRecords(list);
    } catch (err) {
      console.error('Failed to load student history:', err);
      toast.error('Failed to load student history');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'insights' && selectedStudentId) {
      loadStudentRecords(selectedStudentId);
    }
  }, [activeTab, selectedStudentId, loadStudentRecords]);

  const studentMonthStats = useMemo(() => {
    const monthFiltered = studentRecords.filter(r => r.date.startsWith(insightMonth));
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
  }, [studentRecords, insightMonth]);

  // Calendar for individual student month
  const studentCalendarDays = useMemo(() => {
    const [y, m] = insightMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const totalDays = getDaysInMonth(firstDay);
    const startDayOfWeek = getDay(firstDay); // 0 (Sun) to 6 (Sat)
    
    // Day maps
    const dayMap = new Map<string, AttendanceRecord>();
    studentRecords.filter(r => r.date.startsWith(insightMonth)).forEach(r => {
      dayMap.set(r.date, r);
    });

    const items: Array<{ dayNum?: number; dateStr?: string; record?: AttendanceRecord; isToday?: boolean }> = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      items.push({});
    }
    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${insightMonth}-${String(i).padStart(2, '0')}`;
      items.push({
        dayNum: i,
        dateStr: dStr,
        record: dayMap.get(dStr),
        isToday: dStr === format(new Date(), 'yyyy-MM-dd'),
      });
    }
    return items;
  }, [insightMonth, studentRecords]);

  // Low attendance warning list across center for current month
  const lowAttendanceStudents = useMemo(() => {
    if (registerMatrix.length === 0) return [];
    return registerMatrix.filter(row => row.totalMarked >= 3 && row.pct < 75);
  }, [registerMatrix]);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="page-sub">Track daily student attendance, monthly registers, check-in times & analytics</p>
        </div>
        <div className="flex-gap-8" style={{ alignItems: 'center' }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button
              className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              <Calendar size={16} /> Daily Attendance
            </button>
            <button
              className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              <Users size={16} /> Monthly Register
            </button>
            <button
              className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('insights')}
            >
              <BarChart3 size={16} /> Student Insights
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: DAILY ATTENDANCE MARKING
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <>
          {/* Controls Bar */}
          <div className="card mb-16" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
              
              {/* Date selector with Prev / Next */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}
                  title="Previous Day"
                >
                  <ChevronLeft size={18} />
                </button>
                <input
                  type="date"
                  className="input"
                  style={{ width: 'auto', fontWeight: 600 }}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}
                  title="Next Day"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '13px', padding: '6px 12px', height: 'auto' }}
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                >
                  Today
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ minWidth: '150px' }}>
                  <select
                    className="input"
                    value={filterClass}
                    onChange={e => setFilterClass(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>

                <div className="search-box" style={{ width: '220px' }}>
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Daily Summary Bar */}
          <div className="attendance-summary-bar">
            <div className="attendance-stat-pill total">
              <Users size={16} /> Total: {dailyStats.total}
            </div>
            <div className="attendance-stat-pill present">
              <CheckCircle2 size={16} /> Present: {dailyStats.present}
            </div>
            <div className="attendance-stat-pill absent">
              <XCircle size={16} /> Absent: {dailyStats.absent}
            </div>
            <div className="attendance-stat-pill late">
              <Clock size={16} /> Late: {dailyStats.late}
            </div>
            <div className="attendance-stat-pill leave">
              <AlertCircle size={16} /> Leave: {dailyStats.leave}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Rate: <strong style={{ color: dailyStats.presentPct >= 75 ? '#15803d' : '#b91c1c' }}>{dailyStats.presentPct}%</strong>
              </span>
              <div style={{ width: '100px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${dailyStats.presentPct}%`,
                    height: '100%',
                    background: dailyStats.presentPct >= 75 ? '#10b981' : '#ef4444',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick Bulk Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '6px 12px', color: '#15803d', border: '1px solid #bbf7d0', background: '#f0fdf4' }}
                onClick={() => handleBulkMark('present')}
              >
                <Check size={14} /> Mark All Present
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '6px 12px', color: '#b91c1c', border: '1px solid #fecaca', background: '#fef2f2' }}
                onClick={() => handleBulkMark('absent')}
              >
                <X size={14} /> Mark All Absent
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--text-muted)' }}
                onClick={handleClearAll}
              >
                Clear Marks
              </button>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveDaily}
              disabled={savingDaily || loadingDaily}
              style={{ padding: '8px 24px' }}
            >
              {savingDaily ? <span className="btn-spinner" /> : <UserCheck size={16} />}
              {savingDaily ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>

          {/* Students Daily Marking List */}
          {loadingStudents || loadingDaily ? (
            <div className="skeleton-list">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          ) : filteredDailyStudents.length === 0 ? (
            <div className="empty-state">
              <Users size={36} />
              <p>No students found matching your class or search filters.</p>
            </div>
          ) : (
            <div>
              {filteredDailyStudents.map(student => {
                const state = dailyStates[student.id] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
                const currentStatus = state.status;
                const isPresentOrLate = currentStatus === 'present' || currentStatus === 'late';

                return (
                  <div key={student.id} className={`attendance-student-card status-${currentStatus}`}>
                    <div className="attendance-row-header">
                      {/* Student Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="student-avatar" style={{ width: '38px', height: '38px', fontSize: '15px' }}>
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                            {student.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Class {student.class} • {student.school}
                          </div>
                        </div>
                      </div>

                      {/* Status Segmented Buttons */}
                      <div className="attendance-status-group">
                        <button
                          type="button"
                          className={`attendance-status-btn ${currentStatus === 'present' ? 'active-present' : ''}`}
                          onClick={() => setStudentStatus(student.id, 'present')}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${currentStatus === 'absent' ? 'active-absent' : ''}`}
                          onClick={() => setStudentStatus(student.id, 'absent')}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${currentStatus === 'late' ? 'active-late' : ''}`}
                          onClick={() => setStudentStatus(student.id, 'late')}
                        >
                          Late
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${currentStatus === 'leave' ? 'active-leave' : ''}`}
                          onClick={() => setStudentStatus(student.id, 'leave')}
                        >
                          Leave
                        </button>
                      </div>
                    </div>

                    {/* Timepickers & Remarks (when marked) */}
                    {currentStatus !== 'unmarked' && (
                      <div className="attendance-time-inputs">
                        {isPresentOrLate && (
                          <>
                            <div className="attendance-time-box">
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Check-in:</span>
                              <input
                                type="time"
                                value={state.checkInTime}
                                onChange={e => setStudentCheckIn(student.id, e.target.value)}
                              />
                            </div>

                            <div className="attendance-time-box">
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Check-out:</span>
                              <input
                                type="time"
                                value={state.checkOutTime}
                                onChange={e => setStudentCheckOut(student.id, e.target.value)}
                              />
                            </div>
                          </>
                        )}

                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <input
                            type="text"
                            placeholder="Add remarks (e.g. excused, left early, informed)..."
                            className="input"
                            style={{ height: '32px', fontSize: '12px', padding: '4px 10px' }}
                            value={state.remarks}
                            onChange={e => setStudentRemarks(student.id, e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: MONTHLY REGISTER MATRIX
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'register' && (
        <>
          {/* Register Filter Controls */}
          <div className="card mb-16" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Month:</label>
                  <input
                    type="month"
                    className="input"
                    style={{ width: 'auto' }}
                    value={registerMonth}
                    onChange={e => setRegisterMonth(e.target.value)}
                  />
                </div>

                <div style={{ minWidth: '160px' }}>
                  <select
                    className="input"
                    value={registerClass}
                    onChange={e => setRegisterClass(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={exportToCSV}
                disabled={registerMatrix.length === 0}
              >
                <Download size={16} /> Export to CSV
              </button>
            </div>
          </div>

          {/* Monthly Matrix Grid Table */}
          {loadingRegister ? (
            <div className="skeleton-list">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          ) : registerMatrix.length === 0 ? (
            <div className="empty-state">
              <Users size={36} />
              <p>No students enrolled for the selected class filter.</p>
            </div>
          ) : (
            <div className="attendance-matrix-container">
              <table className="attendance-matrix-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Student</th>
                    {daysInRegisterMonth.map(d => (
                      <th key={d.dateStr} className={`${d.isWeekend ? 'weekend-col' : ''} ${d.isToday ? 'today-col' : ''}`}>
                        <div>{d.dayNum}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{d.dayOfWeek}</div>
                      </th>
                    ))}
                    <th className="sticky-col-right" style={{ minWidth: '70px' }}>P</th>
                    <th className="sticky-col-right" style={{ minWidth: '70px' }}>A</th>
                    <th className="sticky-col-right" style={{ minWidth: '70px' }}>L/E</th>
                    <th className="sticky-col-right" style={{ minWidth: '80px' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {registerMatrix.map(({ student, dayCells, presentCount, absentCount, lateCount, leaveCount, pct }) => (
                    <tr key={student.id}>
                      <td className="sticky-col">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>{student.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({student.class})</span>
                        </div>
                      </td>

                      {dayCells.map(c => {
                        let badgeClass = 'empty';
                        let label = '-';
                        if (c.status === 'present') { badgeClass = 'p'; label = 'P'; }
                        else if (c.status === 'absent') { badgeClass = 'a'; label = 'A'; }
                        else if (c.status === 'late') { badgeClass = 'l'; label = 'L'; }
                        else if (c.status === 'leave') { badgeClass = 'e'; label = 'E'; }

                        const titleText = c.status
                          ? `${student.name}: ${c.status.toUpperCase()}${c.checkIn ? ` (${c.checkIn}${c.checkOut ? ` - ${c.checkOut}` : ''})` : ''}${c.remarks ? ` • ${c.remarks}` : ''}`
                          : '';

                        return (
                          <td key={c.dateStr} title={titleText}>
                            <span className={`attendance-matrix-badge ${badgeClass}`}>
                              {label}
                            </span>
                          </td>
                        );
                      })}

                      <td className="sticky-col-right" style={{ fontWeight: 600, color: '#15803d' }}>
                        {presentCount}
                      </td>
                      <td className="sticky-col-right" style={{ fontWeight: 600, color: '#b91c1c' }}>
                        {absentCount}
                      </td>
                      <td className="sticky-col-right" style={{ fontWeight: 600, color: '#b45309' }}>
                        {lateCount + leaveCount}
                      </td>
                      <td className="sticky-col-right">
                        <span
                          className={`badge ${pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-yellow' : 'badge-red'}`}
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                        >
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: STUDENT INSIGHTS & ANALYTICS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'insights' && (
        <>
          {/* Low Attendance Warning Banner */}
          {lowAttendanceStudents.length > 0 && (
            <div className="card mb-16" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '8px' }}>
                <AlertTriangle size={18} />
                <h3 style={{ margin: 0, fontSize: '15px' }}>Low Attendance Warning (&lt; 75%)</h3>
              </div>
              <p style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '12px' }}>
                The following students have fallen below the 75% attendance threshold for {registerMonth}:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {lowAttendanceStudents.map(row => (
                  <button
                    key={row.student.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(row.student.id);
                      setInsightClass(row.student.class);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#fff',
                      border: '1px solid #fca5a5',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      color: '#991b1b',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{row.student.name} ({row.student.class})</span>
                    <strong style={{ color: '#dc2626' }}>{row.pct}%</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Student Selector Card */}
          <div className="card mb-16">
            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Filter by Class</label>
                <select
                  value={insightClass}
                  onChange={e => {
                    setInsightClass(e.target.value);
                    if (selectedStudentId) {
                      const st = students.find(s => s.id === selectedStudentId);
                      if (st && e.target.value && st.class !== e.target.value) {
                        setSelectedStudentId('');
                      }
                    }
                  }}
                >
                  <option value="">All Classes</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Select Student *</label>
                <select
                  value={selectedStudentId}
                  onChange={e => {
                    setSelectedStudentId(e.target.value);
                    const st = students.find(s => s.id === e.target.value);
                    if (st && !insightClass) setInsightClass(st.class);
                  }}
                >
                  <option value="">— Select a student to inspect —</option>
                  {students.filter(s => !insightClass || s.class === insightClass).map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!selectedStudentId ? (
            <div className="empty-state">
              <UserCheck size={48} />
              <p>Select a student above to view their detailed attendance calendar and history.</p>
            </div>
          ) : (
            <>
              {/* Student Summary Stats */}
              <div className="stats-grid mb-16">
                <div className="stat-card stat-green">
                  <div className="stat-icon"><CheckCircle2 size={24} /></div>
                  <div className="stat-body">
                    <div className="stat-value">{studentMonthStats.pct}%</div>
                    <div className="stat-label">Attendance Rate</div>
                    <div className="stat-sub">{studentMonthStats.present} of {studentMonthStats.total} sessions</div>
                  </div>
                </div>

                <div className="stat-card stat-blue">
                  <div className="stat-icon"><Calendar size={24} /></div>
                  <div className="stat-body">
                    <div className="stat-value">{studentMonthStats.total}</div>
                    <div className="stat-label">Classes Held</div>
                    <div className="stat-sub">In {insightMonth}</div>
                  </div>
                </div>

                <div className="stat-card stat-orange">
                  <div className="stat-icon"><Clock size={24} /></div>
                  <div className="stat-body">
                    <div className="stat-value">{studentMonthStats.late}</div>
                    <div className="stat-label">Late Arrivals</div>
                    <div className="stat-sub">With check-in time</div>
                  </div>
                </div>

                <div className="stat-card stat-red">
                  <div className="stat-icon"><XCircle size={24} /></div>
                  <div className="stat-body">
                    <div className="stat-value">{studentMonthStats.absent}</div>
                    <div className="stat-label">Unexcused Absences</div>
                    <div className="stat-sub">{studentMonthStats.leave} excused leaves</div>
                  </div>
                </div>
              </div>

              {/* Monthly Visual Calendar Heatmap */}
              <div className="card mb-16">
                <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    📅 {format(new Date(insightMonth + '-01'), 'MMMM yyyy')} Attendance Calendar
                  </h3>
                  <input
                    type="month"
                    className="input"
                    style={{ width: 'auto' }}
                    value={insightMonth}
                    onChange={e => setInsightMonth(e.target.value)}
                  />
                </div>

                <div className="attendance-calendar-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="attendance-calendar-header">{d}</div>
                  ))}
                  {studentCalendarDays.map((item, idx) => {
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

              {/* Detailed Date-by-date History Log */}
              <div className="card">
                <h3 className="section-title mb-16">Detailed Attendance Log</h3>
                {studentRecords.length === 0 ? (
                  <div className="empty-state">
                    <p>No attendance records logged for this student yet.</p>
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
                        {studentRecords.map(r => (
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
            </>
          )}
        </>
      )}
    </div>
  );
}
