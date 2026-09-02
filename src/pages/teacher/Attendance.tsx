import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, orderBy, Timestamp, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, AttendanceRecord, AttendanceStatus, ScheduleSlot } from '../../types';
import {
  UserCheck, Calendar, Users, CheckCircle2, XCircle,
  AlertCircle, ChevronLeft, ChevronRight, Download, Search,
  BarChart3, AlertTriangle, Check, X, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays, subDays, getDaysInMonth, getDay } from 'date-fns';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const formatTime12h = (time24?: string) => {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  const hours = parseInt(h, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${m} ${suffix}`;
};

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
  const [allSlots, setAllSlots] = useState<ScheduleSlot[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Daily View State
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterClass, setFilterClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyScheduled, setOnlyScheduled] = useState(true);
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

  // Load active students & slots
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [studentSnap, slotsSnap] = await Promise.all([
          getDocs(query(collection(db, 'students'), orderBy('name'))),
          getDocs(collectionGroup(db, 'slots'))
        ]);
        
        const active = studentSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Student)
          .filter(s => s.active !== false);
        setStudents(active);

        const slots = slotsSnap.docs.map(d => {
          const studentId = d.data().studentId || d.ref.parent.parent?.id;
          return { id: d.id, ...d.data(), studentId } as ScheduleSlot;
        });
        setAllSlots(slots);
      } catch (err) {
        console.error('Failed to load students/slots:', err);
        toast.error('Failed to load student data');
      } finally {
        setLoadingStudents(false);
      }
    }
    fetchInitialData();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DAILY ATTENDANCE LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  const isFutureDate = selectedDate > todayStr;

  // Day of week for selected date
  const selectedDayOfWeek = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    return format(new Date(y, m - 1, d), 'EEEE');
  }, [selectedDate]);

  // Tuition slots on the selected day of week grouped by studentId
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

  const loadDailyAttendance = useCallback(async (dateStr: string) => {
    setLoadingDaily(true);
    try {
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
      
      const hasSlotToday = Boolean(todaySlotsByStudent[s.id] && todaySlotsByStudent[s.id].length > 0);
      const isAlreadyMarked = Boolean(dailyStates[s.id] && dailyStates[s.id].status !== 'unmarked');
      const matchSchedule = !onlyScheduled || hasSlotToday || isAlreadyMarked;

      return matchClass && matchSearch && matchSchedule;
    });
  }, [students, filterClass, searchQuery, onlyScheduled, todaySlotsByStudent, dailyStates]);

  const dailyStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let teacherAbsent = 0;
    let unmarked = 0;

    filteredDailyStudents.forEach(s => {
      const st = dailyStates[s.id]?.status;
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'teacher_absent') teacherAbsent++;
      else unmarked++;
    });

    const total = filteredDailyStudents.length;
    const sessionsHeld = present + absent;
    const presentPct = sessionsHeld > 0 ? Math.round((present / sessionsHeld) * 100) : 0;

    return { total, present, absent, teacherAbsent, unmarked, presentPct };
  }, [filteredDailyStudents, dailyStates]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (isFutureDate) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    setDailyStates(prev => {
      const existing = prev[studentId] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
      const nowTime = format(new Date(), 'HH:mm');
      const firstSlot = todaySlotsByStudent[studentId]?.[0];
      
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

  const clearStudentStatus = (studentId: string) => {
    if (isFutureDate) return;
    setDailyStates(prev => ({
      ...prev,
      [studentId]: { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' }
    }));
  };

  const setStudentCheckIn = (studentId: string, time: string) => {
    if (isFutureDate) return;
    setDailyStates(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'present', checkInTime: '', checkOutTime: '', remarks: '' }),
        checkInTime: time,
      }
    }));
  };

  const setStudentCheckOut = (studentId: string, time: string) => {
    if (isFutureDate) return;
    setDailyStates(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'present', checkInTime: '', checkOutTime: '', remarks: '' }),
        checkOutTime: time,
      }
    }));
  };

  const setStudentRemarks = (studentId: string, remarks: string) => {
    if (isFutureDate) return;
    setDailyStates(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' }),
        remarks,
      }
    }));
  };

  const handleBulkMark = (status: AttendanceStatus) => {
    if (isFutureDate) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    const nowTime = format(new Date(), 'HH:mm');
    setDailyStates(prev => {
      const updated = { ...prev };
      filteredDailyStudents.forEach(s => {
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
    const label = status === 'teacher_absent' ? 'TEACHER ABSENT' : status.toUpperCase();
    toast.success(`Marked all as ${label}`);
  };

  const handleClearAll = () => {
    if (isFutureDate) return;
    setDailyStates(prev => {
      const updated = { ...prev };
      filteredDailyStudents.forEach(s => {
        delete updated[s.id];
      });
      return updated;
    });
    toast.success('Cleared marks for all students');
  };

  const handleSaveDaily = async () => {
    if (isFutureDate) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    setSavingDaily(true);
    try {
      const batchPromises = filteredDailyStudents.map(async s => {
        const docId = `${selectedDate}_${s.id}`;
        const st = dailyStates[s.id];

        if (!st || st.status === 'unmarked') {
          // If student was cleared, remove record from database
          return deleteDoc(doc(db, 'attendance', docId)).catch(() => {});
        }

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
      let teacherAbsentCount = 0;

      const dayCells = daysInRegisterMonth.map(d => {
        const record = recordMap[`${student.id}_${d.dateStr}`];
        if (record) {
          if (record.status === 'present') presentCount++;
          else if (record.status === 'absent') absentCount++;
          else if (record.status === 'teacher_absent') teacherAbsentCount++;
        }
        return {
          dateStr: d.dateStr,
          status: record?.status || null,
          checkIn: record?.checkInTime,
          checkOut: record?.checkOutTime,
          remarks: record?.remarks,
        };
      });

      const sessionsHeld = presentCount + absentCount;
      const pct = sessionsHeld > 0 ? Math.round((presentCount / sessionsHeld) * 100) : 0;

      return {
        student,
        dayCells,
        presentCount,
        absentCount,
        teacherAbsentCount,
        sessionsHeld,
        pct,
      };
    });
  }, [filteredRegisterStudents, monthRecords, daysInRegisterMonth]);

  const exportToCSV = () => {
    const header = ['Student Name', 'Class', 'School', ...daysInRegisterMonth.map(d => `${d.dayNum} (${d.dayOfWeek})`), 'Present', 'Absent', 'Teacher Absent', 'Attendance %'];
    const rows = registerMatrix.map(row => {
      const dayCols = row.dayCells.map(c => {
        if (!c.status) return '-';
        if (c.status === 'present') return c.checkIn ? `P (${c.checkIn})` : 'P';
        if (c.status === 'absent') return 'A';
        if (c.status === 'teacher_absent') return 'TA';
        return '-';
      });

      return [
        `"${row.student.name}"`,
        `"Class ${row.student.class}"`,
        `"${row.student.school}"`,
        ...dayCols,
        row.presentCount,
        row.absentCount,
        row.teacherAbsentCount,
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
    let teacherAbsent = 0;

    monthFiltered.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'teacher_absent') teacherAbsent++;
    });

    const sessionsHeld = present + absent;
    const pct = sessionsHeld > 0 ? Math.round((present / sessionsHeld) * 100) : 0;

    return { total: monthFiltered.length, present, absent, teacherAbsent, sessionsHeld, pct, records: monthFiltered };
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
    return registerMatrix.filter(row => row.sessionsHeld >= 3 && row.pct < 75);
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
                  max={todayStr}
                  onChange={e => setSelectedDate(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}
                  disabled={selectedDate >= todayStr}
                  title="Next Day"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '13px', padding: '6px 12px', height: 'auto' }}
                  onClick={() => setSelectedDate(todayStr)}
                >
                  Today
                </button>
              </div>

              {/* Filters & Schedule Toggle */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '13px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: onlyScheduled ? '1px solid var(--navy, #1E3A5F)' : '1px solid var(--border)',
                    background: onlyScheduled ? 'rgba(30, 58, 95, 0.08)' : 'var(--surface-2)',
                    fontWeight: 600,
                    color: onlyScheduled ? 'var(--navy)' : 'var(--text-muted)',
                  }}
                  onClick={() => setOnlyScheduled(!onlyScheduled)}
                >
                  {onlyScheduled ? `📅 Scheduled on ${selectedDayOfWeek} (${Object.keys(todaySlotsByStudent).length})` : '👥 All Students'}
                </button>

                <div style={{ minWidth: '140px' }}>
                  <select
                    className="input"
                    value={filterClass}
                    onChange={e => setFilterClass(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>

                <div className="search-box" style={{ width: '200px' }}>
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

          {/* Future Date Alert */}
          {isFutureDate && (
            <div className="card mb-16" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c' }}>
              <AlertCircle size={18} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Future date selected. Attendance cannot be recorded in advance.</span>
            </div>
          )}

          {/* Daily Summary Bar */}
          <div className="attendance-summary-bar">
            <div className="attendance-stat-pill total">
              <Users size={15} /> Total: {dailyStats.total}
            </div>
            <div className="attendance-stat-pill present">
              <CheckCircle2 size={15} /> Present: {dailyStats.present}
            </div>
            <div className="attendance-stat-pill absent">
              <XCircle size={15} /> Absent: {dailyStats.absent}
            </div>
            <div className="attendance-stat-pill teacher-absent">
              <ShieldAlert size={15} /> Teacher Absent: {dailyStats.teacherAbsent}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Rate: <strong style={{ color: dailyStats.presentPct >= 75 ? '#15803d' : '#b91c1c' }}>{dailyStats.presentPct}%</strong>
              </span>
              <div style={{ width: '80px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '5px 10px', color: '#15803d', border: '1px solid #bbf7d0', background: '#f0fdf4' }}
                onClick={() => handleBulkMark('present')}
                disabled={isFutureDate}
              >
                <Check size={13} /> Mark All Present
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '5px 10px', color: '#b91c1c', border: '1px solid #fecaca', background: '#fef2f2' }}
                onClick={() => handleBulkMark('absent')}
                disabled={isFutureDate}
              >
                <X size={13} /> Mark All Absent
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '5px 10px', color: '#6d28d9', border: '1px solid #ddd6fe', background: '#f5f3ff' }}
                onClick={() => handleBulkMark('teacher_absent')}
                disabled={isFutureDate}
              >
                <ShieldAlert size={13} /> Teacher Absent
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '5px 10px', color: 'var(--text-muted)' }}
                onClick={handleClearAll}
                disabled={isFutureDate}
              >
                Clear All
              </button>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveDaily}
              disabled={savingDaily || loadingDaily || isFutureDate}
              style={{ padding: '7px 18px', fontSize: '13px' }}
            >
              {savingDaily ? <span className="btn-spinner" /> : <UserCheck size={15} />}
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
              <p>
                {onlyScheduled
                  ? `No students have tuition slots scheduled on ${selectedDayOfWeek}.`
                  : 'No students found matching your filters.'}
              </p>
              {onlyScheduled && (
                <button
                  type="button"
                  className="btn-secondary mt-8"
                  onClick={() => setOnlyScheduled(false)}
                >
                  Show All Students
                </button>
              )}
            </div>
          ) : (
            <div>
              {filteredDailyStudents.map(student => {
                const state = dailyStates[student.id] || { status: 'unmarked', checkInTime: '', checkOutTime: '', remarks: '' };
                const currentStatus = state.status;
                const isPresent = currentStatus === 'present';
                const studentSlots = todaySlotsByStudent[student.id];

                return (
                  <div key={student.id} className={`attendance-student-card status-${currentStatus}`}>
                    <div className="attendance-row-header">
                      {/* Student Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '180px' }}>
                        <div className="student-avatar" style={{ width: '34px', height: '34px', fontSize: '14px' }}>
                          {student.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {student.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Class {student.class} • {student.school}
                          </div>
                          {studentSlots && studentSlots.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                              {studentSlots.map((sl, i) => (
                                <span key={i} className="chip" style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(30, 58, 95, 0.08)', color: 'var(--navy)', fontWeight: 600 }}>
                                  ⏰ {formatTime12h(sl.startTime)} - {formatTime12h(sl.endTime)}{sl.subjects?.length ? ` • ${sl.subjects.join(', ')}` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Segmented Buttons + Clear Option */}
                      <div className="attendance-status-group">
                        <button
                          type="button"
                          className={`attendance-status-btn ${currentStatus === 'present' ? 'active-present' : ''}`}
                          onClick={() => setStudentStatus(student.id, 'present')}
                          disabled={isFutureDate}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${currentStatus === 'absent' ? 'active-absent' : ''}`}
                          onClick={() => setStudentStatus(student.id, 'absent')}
                          disabled={isFutureDate}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          className={`attendance-status-btn ${currentStatus === 'teacher_absent' ? 'active-teacher_absent' : ''}`}
                          onClick={() => setStudentStatus(student.id, 'teacher_absent')}
                          disabled={isFutureDate}
                        >
                          T. Absent
                        </button>
                        {currentStatus !== 'unmarked' && (
                          <button
                            type="button"
                            className="attendance-status-btn"
                            style={{ color: '#64748b' }}
                            onClick={() => clearStudentStatus(student.id)}
                            disabled={isFutureDate}
                            title="Clear mark for this student"
                          >
                            <X size={12} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timepickers & Remarks */}
                    {currentStatus !== 'unmarked' && (
                      <div className="attendance-time-inputs">
                        {isPresent && (
                          <>
                            <div className="attendance-time-box">
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>In:</span>
                              <input
                                type="time"
                                value={state.checkInTime}
                                onChange={e => setStudentCheckIn(student.id, e.target.value)}
                              />
                            </div>

                            <div className="attendance-time-box">
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Out:</span>
                              <input
                                type="time"
                                value={state.checkOutTime}
                                onChange={e => setStudentCheckOut(student.id, e.target.value)}
                              />
                            </div>
                          </>
                        )}

                        <div style={{ flex: 1, minWidth: '160px' }}>
                          <input
                            type="text"
                            placeholder="Remarks (e.g. excused, informed, homework pending)..."
                            className="input"
                            style={{ height: '28px', fontSize: '11px', padding: '2px 8px' }}
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
          <div className="card mb-16" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Month:</label>
                  <input
                    type="month"
                    className="input"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                    value={registerMonth}
                    onChange={e => setRegisterMonth(e.target.value)}
                  />
                </div>

                <div style={{ minWidth: '130px' }}>
                  <select
                    className="input"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
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
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={exportToCSV}
                disabled={registerMatrix.length === 0}
              >
                <Download size={14} /> Export to CSV
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
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{d.dayOfWeek}</div>
                      </th>
                    ))}
                    <th className="sticky-col-right" style={{ minWidth: '42px' }}>P</th>
                    <th className="sticky-col-right" style={{ minWidth: '42px' }}>A</th>
                    <th className="sticky-col-right" style={{ minWidth: '42px' }}>TA</th>
                    <th className="sticky-col-right" style={{ minWidth: '55px' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {registerMatrix.map(({ student, dayCells, presentCount, absentCount, teacherAbsentCount, pct }) => (
                    <tr key={student.id}>
                      <td className="sticky-col">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600 }}>{student.name}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>({student.class})</span>
                        </div>
                      </td>

                      {dayCells.map(c => {
                        let badgeClass = 'empty';
                        let label = '-';
                        if (c.status === 'present') { badgeClass = 'p'; label = 'P'; }
                        else if (c.status === 'absent') { badgeClass = 'a'; label = 'A'; }
                        else if (c.status === 'teacher_absent') { badgeClass = 'ta'; label = 'TA'; }

                        const titleText = c.status
                          ? `${student.name}: ${c.status === 'teacher_absent' ? 'TEACHER ABSENT' : c.status.toUpperCase()}${c.checkIn ? ` (${c.checkIn}${c.checkOut ? ` - ${c.checkOut}` : ''})` : ''}${c.remarks ? ` • ${c.remarks}` : ''}`
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
                      <td className="sticky-col-right" style={{ fontWeight: 600, color: '#6d28d9' }}>
                        {teacherAbsentCount}
                      </td>
                      <td className="sticky-col-right">
                        <span
                          className={`badge ${pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-yellow' : 'badge-red'}`}
                          style={{ fontSize: '10px', padding: '1px 6px' }}
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
            <div className="card mb-16" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', marginBottom: '6px' }}>
                <AlertTriangle size={16} />
                <h3 style={{ margin: 0, fontSize: '14px' }}>Low Attendance Warning (&lt; 75%)</h3>
              </div>
              <p style={{ fontSize: '12px', color: '#7f1d1d', marginBottom: '8px' }}>
                The following students have fallen below 75% attendance for {registerMonth}:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                      gap: '4px',
                      background: '#fff',
                      border: '1px solid #fca5a5',
                      padding: '3px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
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
          <div className="card mb-16" style={{ padding: '12px 16px' }}>
            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px' }}>Filter by Class</label>
                <select
                  className="input"
                  style={{ fontSize: '13px', padding: '6px 10px' }}
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
                <label style={{ fontSize: '12px' }}>Select Student *</label>
                <select
                  className="input"
                  style={{ fontSize: '13px', padding: '6px 10px' }}
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
              <UserCheck size={40} />
              <p>Select a student above to view their detailed attendance calendar and history.</p>
            </div>
          ) : (
            <>
              {/* Student Summary Stats */}
              <div className="stats-grid mb-16">
                <div className="stat-card stat-green" style={{ padding: '12px 14px' }}>
                  <div className="stat-icon"><CheckCircle2 size={20} /></div>
                  <div className="stat-body">
                    <div className="stat-value" style={{ fontSize: '20px' }}>{studentMonthStats.pct}%</div>
                    <div className="stat-label">Attendance Rate</div>
                    <div className="stat-sub">{studentMonthStats.present} of {studentMonthStats.sessionsHeld} sessions</div>
                  </div>
                </div>

                <div className="stat-card stat-blue" style={{ padding: '12px 14px' }}>
                  <div className="stat-icon"><Calendar size={20} /></div>
                  <div className="stat-body">
                    <div className="stat-value" style={{ fontSize: '20px' }}>{studentMonthStats.sessionsHeld}</div>
                    <div className="stat-label">Classes Held</div>
                    <div className="stat-sub">In {insightMonth}</div>
                  </div>
                </div>

                <div className="stat-card stat-red" style={{ padding: '12px 14px' }}>
                  <div className="stat-icon"><XCircle size={20} /></div>
                  <div className="stat-body">
                    <div className="stat-value" style={{ fontSize: '20px' }}>{studentMonthStats.absent}</div>
                    <div className="stat-label">Student Absences</div>
                    <div className="stat-sub">Sessions missed</div>
                  </div>
                </div>

                <div className="stat-card stat-purple" style={{ padding: '12px 14px' }}>
                  <div className="stat-icon"><ShieldAlert size={20} color="#7c3aed" /></div>
                  <div className="stat-body">
                    <div className="stat-value" style={{ fontSize: '20px', color: '#6d28d9' }}>{studentMonthStats.teacherAbsent}</div>
                    <div className="stat-label">Teacher Absences</div>
                    <div className="stat-sub">Tuition off</div>
                  </div>
                </div>
              </div>

              {/* Monthly Visual Calendar Heatmap */}
              <div className="card mb-16" style={{ padding: '14px 16px' }}>
                <div className="flex-between mb-16" style={{ alignItems: 'center' }}>
                  <h3 className="section-title" style={{ margin: 0, fontSize: '14px' }}>
                    📅 {format(new Date(insightMonth + '-01'), 'MMMM yyyy')} Attendance Calendar
                  </h3>
                  <input
                    type="month"
                    className="input"
                    style={{ width: 'auto', fontSize: '12px', padding: '4px 8px' }}
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
                    let badgeClass = 'empty';
                    let label = '';
                    if (rec) {
                      if (rec.status === 'present') { dayClass = 'day-present'; badgeClass = 'p'; label = 'P'; }
                      else if (rec.status === 'absent') { dayClass = 'day-absent'; badgeClass = 'a'; label = 'A'; }
                      else if (rec.status === 'teacher_absent') { dayClass = 'day-teacher_absent'; badgeClass = 'ta'; label = 'TA'; }
                    }

                    return (
                      <div key={item.dateStr} className={`attendance-calendar-day ${dayClass} ${item.isToday ? 'day-today' : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{item.dayNum}</span>
                          {rec && (
                            <span
                              className={`attendance-matrix-badge ${badgeClass}`}
                              style={{ width: '18px', height: '18px', fontSize: '9px' }}
                            >
                              {label}
                            </span>
                          )}
                        </div>
                        {rec && rec.checkInTime && (
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            ⏰ {rec.checkInTime}{rec.checkOutTime ? `-${rec.checkOutTime}` : ''}
                          </div>
                        )}
                        {rec && rec.remarks && (
                          <div style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.remarks}>
                            💬 {rec.remarks}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Date-by-date History Log */}
              <div className="card" style={{ padding: '14px 16px' }}>
                <h3 className="section-title mb-16" style={{ fontSize: '14px' }}>Detailed Attendance Log</h3>
                {studentRecords.length === 0 ? (
                  <div className="empty-state">
                    <p>No attendance records logged for this student yet.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ fontSize: '12px' }}>
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
                              <span className={`badge ${r.status === 'present' ? 'badge-green' : r.status === 'absent' ? 'badge-red' : 'badge-purple'}`}>
                                {r.status === 'teacher_absent' ? 'TEACHER ABSENT' : r.status.toUpperCase()}
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
