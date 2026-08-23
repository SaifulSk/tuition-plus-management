import { useEffect, useState, useCallback } from 'react';
import { collection, query, getDocs, orderBy, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { getFeeForMonth } from '../../utils/feeUtils';
import {
  Users, Wallet, ClipboardList, TrendingDown,
  TrendingUp, BookOpen, CalendarCheck, CalendarPlus, ArrowRight, Eye, EyeOff, PartyPopper,
  UserPlus, Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Student, FeePayment, TuitionTest, CenterEvent } from '../../types';
import { format } from 'date-fns';

// Modal imports
import AddStudentModal from '../../components/modals/AddStudentModal';
import RecordPaymentModal from '../../components/modals/RecordPaymentModal';
import LogTestModal from '../../components/modals/LogTestModal';
import AssignHomeworkModal from '../../components/modals/AssignHomeworkModal';
import AddExamResultModal from '../../components/modals/AddExamResultModal';
import AddScheduleSlotModal from '../../components/modals/AddScheduleSlotModal';
import AddSyllabusTopicModal from '../../components/modals/AddSyllabusTopicModal';
import AddEventModal from '../../components/modals/AddEventModal';

interface Stats {
  totalStudents: number;
  activeStudents: number;
  feesThisMonth: number;
  pendingFees: number;
  recentTests: TuitionTest[];
  upcomingEvents: CenterEvent[];
}

export default function TeacherDashboard() {
  const { appUser } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0, activeStudents: 0,
    feesThisMonth: 0, pendingFees: 0,
    recentTests: [], upcomingEvents: []
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeesCollected, setShowFeesCollected] = useState(false);
  const [showFeesDue, setShowFeesDue] = useState(false);

  // Modal open states
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showLogTest, setShowLogTest] = useState(false);
  const [showAssignHomework, setShowAssignHomework] = useState(false);
  const [showAddExamResult, setShowAddExamResult] = useState(false);
  const [showAddScheduleSlot, setShowAddScheduleSlot] = useState(false);
  const [showAddSyllabusTopic, setShowAddSyllabusTopic] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Students
      const studSnap = await getDocs(query(collection(db, 'students')));
      const studs = studSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Student).filter(s => s.active !== false);
      
      // Sort students by joiningDate descending for the Recent Students view
      studs.sort((a, b) => {
        const tA = a.joiningDate ? a.joiningDate.toDate().getTime() : 0;
        const tB = b.joiningDate ? b.joiningDate.toDate().getTime() : 0;
        return tB - tA;
      });
      
      setStudents(studs);

      // Payments
      const paymentsSnap = await getDocs(collectionGroup(db, 'payments'));
      let feesThisMonth = 0;
      const allPayments: Record<string, Set<string>> = {};
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      paymentsSnap.docs.forEach(d => {
        const p = d.data() as FeePayment;
        const studentId = d.ref.parent.parent?.id;
        
        if (p.datePaid) {
          const pd = p.datePaid.toDate();
          if (pd.getFullYear() === currentYear && pd.getMonth() === currentMonth) {
            feesThisMonth += p.amount || 0;
          }
        }
        
        if (studentId) {
          if (!allPayments[studentId]) allPayments[studentId] = new Set();
          p.monthsPaid?.forEach((m: string) => allPayments[studentId].add(m));
        }
      });

      // Calculate pending fees
      const activeStuds = studs.filter(s => s.active);
      let pendingFees = 0;
      activeStuds.forEach(s => {
        if (!s.joiningDate) return;
        const start = s.joiningDate.toDate();
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        
        let d = new Date(startYear, startMonth, 1);
        const end = new Date(currentYear, currentMonth, 1);
        while (d < end) {
          const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!allPayments[s.id] || !allPayments[s.id].has(mStr)) {
            pendingFees += getFeeForMonth(mStr, s);
          }
          d.setMonth(d.getMonth() + 1);
        }
      });

      // Tests
      const testSnap = await getDocs(query(collection(db, 'tests'), orderBy('date', 'desc')));
      const tests = testSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }) as TuitionTest);

      // Events
      const evSnap = await getDocs(query(collection(db, 'events'), orderBy('date', 'desc')));
      const events = evSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }) as CenterEvent);

      setStats({
        totalStudents: studs.length,
        activeStudents: activeStuds.length,
        feesThisMonth,
        pendingFees,
        recentTests: tests,
        upcomingEvents: events,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {appUser?.name?.split(' ')[0]} !!</h1>
          <p className="page-sub">Here's what's happening at Tuition Plus today</p>
        </div>
        <div className="page-date">
          <CalendarCheck size={16} />
          <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '—' : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
            <div className="stat-sub">{stats.activeStudents} active</div>
          </div>
        </div>

        <div className="stat-card stat-green">
          <div className="stat-icon"><Wallet size={24} /></div>
          <div className="stat-body">
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {loading ? '₹—' : (showFeesCollected ? `₹${stats.feesThisMonth.toLocaleString()}` : '₹****')}
              <button onClick={() => setShowFeesCollected(!showFeesCollected)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {showFeesCollected ? <EyeOff size={16} color="var(--text-muted)" /> : <Eye size={16} color="var(--text-muted)" />}
              </button>
            </div>
            <div className="stat-label">Fees Collected</div>
            <div className="stat-sub">This month</div>
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-icon"><ClipboardList size={24} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '—' : stats.recentTests.length}</div>
            <div className="stat-label">Recent Tests</div>
            <div className="stat-sub">Last logged</div>
          </div>
        </div>

        <div className="stat-card stat-orange">
          <div className="stat-icon"><TrendingDown size={24} /></div>
          <div className="stat-body">
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {loading ? '₹—' : (showFeesDue ? `₹${stats.pendingFees.toLocaleString()}` : '₹****')}
              <button onClick={() => setShowFeesDue(!showFeesDue)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {showFeesDue ? <EyeOff size={16} color="var(--text-muted)" /> : <Eye size={16} color="var(--text-muted)" />}
              </button>
            </div>
            <div className="stat-label">Fees Due</div>
            <div className="stat-sub">This month</div>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="dashboard-grid">
        {/* Recent Students */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Users size={18} /> Recent Students</div>
            <Link to="/teacher/students" className="card-link">View all <ArrowRight size={14} /></Link>
          </div>
          <div className="student-list">
            {loading ? (
              <div className="skeleton-list">
                {[1,2,3].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : students.slice(0, 5).map(s => (
              <Link key={s.id} to={`/teacher/students/${s.id}`} className="student-row">
                <div className="student-avatar">{s.name.charAt(0)}</div>
                <div className="student-info">
                  <div className="student-name">{s.name}</div>
                  <div className="student-meta">Class {s.class} • {s.subjects?.length || 0} subjects</div>
                </div>
                <div className={`badge ${s.active ? 'badge-green' : 'badge-red'}`}>
                  {s.active ? 'Active' : 'Inactive'}
                </div>
              </Link>
            ))}
            {!loading && students.length === 0 && (
              <div className="empty-state">
                <Users size={32} />
                <p>No students yet. <button type="button" className="btn-link" onClick={() => setShowAddStudent(true)}>Add one!</button></p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-title"><TrendingUp size={18} /> Quick Actions</div>
          <div className="quick-actions">
            <button type="button" className="quick-action-btn" onClick={() => setShowAddStudent(true)}>
              <UserPlus size={20} /><span>Add Student</span>
            </button>
            <button type="button" className="quick-action-btn" onClick={() => setShowRecordPayment(true)}>
              <Wallet size={20} /><span>Record Fee</span>
            </button>
            <button type="button" className="quick-action-btn" onClick={() => setShowLogTest(true)}>
              <ClipboardList size={20} /><span>Log Test</span>
            </button>
            <button type="button" className="quick-action-btn" onClick={() => setShowAssignHomework(true)}>
              <BookOpen size={20} /><span>Assign HW</span>
            </button>
            <button type="button" className="quick-action-btn" onClick={() => setShowAddExamResult(true)}>
              <TrendingUp size={20} /><span>Exam Result</span>
            </button>
            <button type="button" className="quick-action-btn" onClick={() => setShowAddScheduleSlot(true)}>
              <CalendarPlus size={20} /><span>Add Slot</span>
            </button>
            <button type="button" className="quick-action-btn" onClick={() => setShowAddSyllabusTopic(true)}>
              <Layers size={20} /><span>Add Topic</span>
            </button>
            <button type="button" className="quick-action-btn" onClick={() => setShowAddEvent(true)}>
              <PartyPopper size={20} /><span>Add Event</span>
            </button>
          </div>
        </div>

        {/* Recent Tests */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><ClipboardList size={18} /> Recent Tests</div>
            <Link to="/teacher/tests" className="card-link">View all <ArrowRight size={14} /></Link>
          </div>
          {loading ? <div className="skeleton-list">{[1,2,3].map(i=><div key={i} className="skeleton-row"/>)}</div>
          : stats.recentTests.length === 0
            ? <div className="empty-state"><ClipboardList size={32}/><p>No tests logged yet</p></div>
            : stats.recentTests.map(t => (
            <div key={t.id} className="test-row">
              <div>
                <div className="test-title">{t.title}</div>
                <div className="test-meta">{t.subjects?.join(', ')} • Max: {t.maxMarks}</div>
              </div>
              <div className="test-date">
                {t.date ? format(t.date.toDate(), 'dd MMM') : '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Events */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><PartyPopper size={18} /> Recent Events</div>
            <Link to="/teacher/events" className="card-link">View all <ArrowRight size={14} /></Link>
          </div>
          {loading ? <div className="skeleton-list">{[1,2,3].map(i=><div key={i} className="skeleton-row"/>)}</div>
          : stats.upcomingEvents.length === 0
            ? <div className="empty-state"><PartyPopper size={32}/><p>No events yet</p></div>
            : stats.upcomingEvents.map(ev => (
            <div key={ev.id} className="event-row">
              <div className="event-type-badge">{ev.type}</div>
              <div>
                <div className="event-title">{ev.title}</div>
                <div className="event-date">{ev.date ? format(ev.date.toDate(), 'dd MMM yyyy') : '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals rendered directly on Dashboard */}
      <AddStudentModal
        isOpen={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onSuccess={loadData}
      />

      <RecordPaymentModal
        isOpen={showRecordPayment}
        onClose={() => setShowRecordPayment(false)}
        onSuccess={loadData}
        students={students}
      />

      <LogTestModal
        isOpen={showLogTest}
        onClose={() => setShowLogTest(false)}
        onSuccess={loadData}
        students={students}
      />

      <AssignHomeworkModal
        isOpen={showAssignHomework}
        onClose={() => setShowAssignHomework(false)}
        onSuccess={loadData}
        students={students}
      />

      <AddExamResultModal
        isOpen={showAddExamResult}
        onClose={() => setShowAddExamResult(false)}
        onSuccess={loadData}
        students={students}
      />

      <AddScheduleSlotModal
        isOpen={showAddScheduleSlot}
        onClose={() => setShowAddScheduleSlot(false)}
        onSuccess={loadData}
        students={students}
      />

      <AddSyllabusTopicModal
        isOpen={showAddSyllabusTopic}
        onClose={() => setShowAddSyllabusTopic(false)}
        onSuccess={loadData}
        students={students}
      />

      <AddEventModal
        isOpen={showAddEvent}
        onClose={() => setShowAddEvent(false)}
        onSuccess={loadData}
        students={students}
      />
    </div>
  );
}

