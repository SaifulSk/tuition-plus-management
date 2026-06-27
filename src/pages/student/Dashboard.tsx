import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Student, FeePayment, SyllabusTopic, SchoolExam } from '../../types';
import { Wallet, BookOpen, BarChart3, CalendarCheck, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function StudentDashboard() {
  const { appUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<FeePayment[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusTopic[]>([]);
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      // Get student profile via uid
      // First find studentId from users doc
      const userDoc = await getDoc(doc(db, 'users', appUser!.uid));
      const studentId = userDoc.data()?.studentId;
      if (!studentId) { setLoading(false); return; }

      const sSnap = await getDoc(doc(db, 'students', studentId));
      if (sSnap.exists()) setStudent({ id: sSnap.id, ...sSnap.data() } as Student);

      const fSnap = await getDocs(query(collection(db,'fees',studentId,'payments'), orderBy('datePaid','desc')));
      setFees(fSnap.docs.map(d => ({ id: d.id, ...d.data() }) as FeePayment));

      const sylSnap = await getDocs(collection(db,'syllabus',studentId,'topics'));
      setSyllabus(sylSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SyllabusTopic));

      const exSnap = await getDocs(query(collection(db,'schoolExams',studentId,'exams'), orderBy('date','desc')));
      setExams(exSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SchoolExam));

      setLoading(false);
    }
    load();
  }, [appUser]);

  if (loading) return <div className="page"><div className="loader large" /></div>;
  if (!student) return <div className="page"><p>Profile not set up yet. Contact your teacher.</p></div>;

  const completed = syllabus.filter(t => t.status === 'completed').length;
  const progress = syllabus.length ? Math.round((completed / syllabus.length) * 100) : 0;
  const totalPaid = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const lastExam = exams[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {student.name.split(' ')[0]} 👋</h1>
          <p className="page-sub">Here's your learning overview</p>
        </div>
        <div className="page-date">
          <CalendarCheck size={16}/>
          <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
        </div>
      </div>

      {/* Profile info */}
      <div className="profile-card student">
        <div className="profile-avatar">{student.name.charAt(0)}</div>
        <div className="profile-info">
          <h2 className="profile-name">{student.name}</h2>
          <div className="profile-meta">
            <span><GraduationCap size={14}/> Class {student.class}{student.section && ` - ${student.section}`}</span>
            <span>{student.school}</span>
          </div>
          <div className="profile-meta">
            <span>Joined: {student.joiningDate ? format(student.joiningDate.toDate(), 'dd MMMM yyyy') : '—'}</span>
          </div>
          <div className="profile-chips">
            {student.subjects?.map(s => <span key={s} className="chip">{s}</span>)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-icon"><Wallet size={24}/></div>
          <div className="stat-body">
            <div className="stat-value">₹{totalPaid.toLocaleString()}</div>
            <div className="stat-label">Total Paid</div>
            <div className="stat-sub">{fees.length} transactions</div>
          </div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-icon"><BookOpen size={24}/></div>
          <div className="stat-body">
            <div className="stat-value">{progress}%</div>
            <div className="stat-label">Syllabus Done</div>
            <div className="stat-sub">{completed}/{syllabus.length} topics</div>
          </div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-icon"><BarChart3 size={24}/></div>
          <div className="stat-body">
            <div className="stat-value">{lastExam ? Math.round((lastExam.marksObtained/lastExam.maxMarks)*100)+'%' : '—'}</div>
            <div className="stat-label">Last Exam</div>
            <div className="stat-sub">{lastExam ? lastExam.examName : 'No results yet'}</div>
          </div>
        </div>
        <div className="stat-card stat-orange">
          <div className="stat-icon"><GraduationCap size={24}/></div>
          <div className="stat-body">
            <div className="stat-value">{student.subjects?.length || 0}</div>
            <div className="stat-label">Subjects</div>
            <div className="stat-sub">Being taught</div>
          </div>
        </div>
      </div>

      {/* Syllabus progress */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><BookOpen size={18}/> Syllabus Progress</div>
          <Link to="/student/syllabus" className="card-link">View details →</Link>
        </div>
        <div className="syllabus-progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}/>
        </div>
        <div className="progress-stats">
          <span>✅ {completed} completed</span>
          <span>🔄 {syllabus.filter(t=>t.status==='in_progress').length} in progress</span>
          <span>⏳ {syllabus.filter(t=>t.status==='not_started').length} not started</span>
        </div>
      </div>

      {/* Recent fees */}
      <div className="card mt-16">
        <div className="card-header">
          <div className="card-title"><Wallet size={18}/> Recent Payments</div>
          <Link to="/student/fees" className="card-link">View all →</Link>
        </div>
        {fees.slice(0, 3).map(f => (
          <div key={f.id} className="event-row">
            <div>
              <div className="fw-600">₹{f.amount?.toLocaleString()}</div>
              <div className="text-muted text-sm">{f.monthsPaid?.map(m => {
                const [y,mo] = m.split('-');
                return new Date(Number(y),Number(mo)-1).toLocaleString('en-US',{month:'short',year:'numeric'});
              }).join(', ')}</div>
            </div>
            <span className="badge badge-blue">{f.mode}</span>
          </div>
        ))}
        {fees.length === 0 && <div className="empty-state"><Wallet size={32}/><p>No payments recorded</p></div>}
      </div>
    </div>
  );
}
