import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Wallet, ClipboardList, PartyPopper,
  TrendingUp, BookOpen, CalendarCheck, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Student, FeePayment, TuitionTest, CenterEvent } from '../../types';
import { format } from 'date-fns';

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
  const [showFees, setShowFees] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Students
        const studSnap = await getDocs(query(collection(db, 'students'), orderBy('name')));
        const studs = studSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Student);
        setStudents(studs);

        // Fees this month
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let feesThisMonth = 0;
        for (const s of studs) {
          const fSnap = await getDocs(collection(db, 'fees', s.id, 'payments'));
          fSnap.docs.forEach(d => {
            const p = d.data() as FeePayment;
            if (p.datePaid) {
              const pd = p.datePaid.toDate();
              if (pd.getFullYear() === now.getFullYear() && pd.getMonth() === now.getMonth()) {
                feesThisMonth += p.amount || 0;
              }
            }
          });
        }

        // Tests
        const testSnap = await getDocs(query(collection(db, 'tests'), orderBy('date', 'desc')));
        const tests = testSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }) as TuitionTest);

        // Events
        const evSnap = await getDocs(query(collection(db, 'events'), orderBy('date', 'desc')));
        const events = evSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }) as CenterEvent);

        setStats({
          totalStudents: studs.length,
          activeStudents: studs.filter(s => s.active).length,
          feesThisMonth,
          pendingFees: studs.filter(s => s.active).length,
          recentTests: tests,
          upcomingEvents: events,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {appUser?.name?.split(' ')[0]} 👋</h1>
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
              {loading ? '₹—' : (showFees ? `₹${stats.feesThisMonth.toLocaleString()}` : '₹****')}
              <button onClick={() => setShowFees(!showFees)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {showFees ? <EyeOff size={16} color="var(--text-muted)" /> : <Eye size={16} color="var(--text-muted)" />}
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
          <div className="stat-icon"><PartyPopper size={24} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '—' : stats.upcomingEvents.length}</div>
            <div className="stat-label">Events</div>
            <div className="stat-sub">Total recorded</div>
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
                <p>No students yet. <Link to="/teacher/students">Add one!</Link></p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-title"><TrendingUp size={18} /> Quick Actions</div>
          <div className="quick-actions">
            <Link to="/teacher/students" className="quick-action-btn">
              <Users size={20} /><span>Add Student</span>
            </Link>
            <Link to="/teacher/fees" className="quick-action-btn">
              <Wallet size={20} /><span>Record Fee</span>
            </Link>
            <Link to="/teacher/tests" className="quick-action-btn">
              <ClipboardList size={20} /><span>Log Test</span>
            </Link>
            <Link to="/teacher/syllabus" className="quick-action-btn">
              <BookOpen size={20} /><span>Update Syllabus</span>
            </Link>
            <Link to="/teacher/exams" className="quick-action-btn">
              <TrendingUp size={20} /><span>School Exams</span>
            </Link>
            <Link to="/teacher/events" className="quick-action-btn">
              <PartyPopper size={20} /><span>Add Event</span>
            </Link>
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
                <div className="test-meta">{t.subject} • Max: {t.maxMarks}</div>
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
    </div>
  );
}
