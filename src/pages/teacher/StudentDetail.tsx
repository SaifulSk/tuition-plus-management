import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, FeePayment, SyllabusTopic, SchoolExam } from '../../types';
import { ArrowLeft, Mail, Phone, BookOpen, Wallet, BarChart3, GraduationCap, User, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

type Tab = 'overview' | 'fees' | 'syllabus' | 'exams';

const getMarksBadgeClass = (pct: number) => {
  if (pct >= 90) return 'badge-excel-dark-green';
  if (pct >= 71) return 'badge-excel-light-green';
  if (pct >= 51) return 'badge-excel-yellow';
  if (pct >= 31) return 'badge-excel-pink';
  return 'badge-excel-red';
};

const getMarksColor = (pct: number) => {
  if (pct >= 90) return '#00B050';
  if (pct >= 71) return '#C6EFCE';
  if (pct >= 51) return '#FFEB9C';
  if (pct >= 31) return '#FFC7CE';
  return '#FF5050';
};

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<FeePayment[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusTopic[]>([]);
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [showFees, setShowFees] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const sSnap = await getDoc(doc(db, 'students', id!));
      if (sSnap.exists()) setStudent({ id: sSnap.id, ...sSnap.data() } as Student);

      const fSnap = await getDocs(query(collection(db, 'fees', id!, 'payments'), orderBy('datePaid', 'desc')));
      setFees(fSnap.docs.map(d => ({ id: d.id, ...d.data() }) as FeePayment));

      const sylSnap = await getDocs(collection(db, 'syllabus', id!, 'topics'));
      setSyllabus(sylSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SyllabusTopic));

      const exSnap = await getDocs(query(collection(db, 'schoolExams', id!, 'exams'), orderBy('date')));
      setExams(exSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SchoolExam));

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="page"><div className="loader large" /></div>;
  if (!student) return <div className="page"><p>Student not found.</p></div>;

  const totalFeesPaid = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const completedTopics = syllabus.filter(t => t.status === 'completed').length;
  const syllabusProgress = syllabus.length ? Math.round((completedTopics / syllabus.length) * 100) : 0;

  // Build exam chart data grouped by subject
  const subjects = [...new Set(exams.flatMap(e => e.subjects || []))];
  const examNames = [...new Set(exams.map(e => e.examName))];
  const chartData = examNames.map(en => {
    const row: Record<string, string | number> = { exam: en };
    subjects.forEach(sub => {
      const found = exams.find(e => e.examName === en && e.subjects?.includes(sub));
      if (found) row[sub] = Math.round((found.marksObtained / found.maxMarks) * 100);
    });
    return row;
  });

  
  return (
    <div className="page">
      <div className="page-header">
        <Link to="/teacher/students" className="back-btn"><ArrowLeft size={18} /> Back</Link>
      </div>

      {/* Profile card */}
      <div className="profile-card">
        <div className="profile-avatar">{student.name.charAt(0)}</div>
        <div className="profile-info">
          <h2 className="profile-name">{student.name}</h2>
          <div className="profile-meta">
            <span><GraduationCap size={14}/> Class {student.class}{student.section && ` - ${student.section}`}</span>
            <span><BookOpen size={14}/> {student.subjects?.length || 0} subjects</span>
            {student.phone && <span><Phone size={14}/> {student.phone}</span>}
            {student.email && <span><Mail size={14}/> {student.email}</span>}
          </div>
          <div className="profile-chips">
            {student.subjects?.map(s => <span key={s} className="chip">{s}</span>)}
          </div>
        </div>
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-val" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              {showFees ? `₹${student.confirmedFee?.toLocaleString()}` : '₹****'}
              <button onClick={() => setShowFees(!showFees)} style={{ background:'none', border:'none', cursor:'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                {showFees ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            <div className="profile-stat-label">Monthly Fee</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              {showFees ? `₹${totalFeesPaid.toLocaleString()}` : '₹****'}
            </div>
            <div className="profile-stat-label">Total Paid</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val">{syllabusProgress}%</div>
            <div className="profile-stat-label">Syllabus Done</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(['overview','fees','syllabus','exams'] as Tab[]).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="card">
          <h3 className="section-title"><User size={18}/> Student Details</h3>
          <div className="detail-grid">
            <div className="detail-row"><span>School</span><strong>{student.school || '—'}</strong></div>
            <div className="detail-row"><span>Parent Phone</span><strong>{student.parentPhone || '—'}</strong></div>
            <div className="detail-row"><span>Joined</span><strong>{student.joiningDate ? format(student.joiningDate.toDate(), 'dd MMMM yyyy') : '—'}</strong></div>
            <div className="detail-row"><span>Status</span><span className={`badge ${student.active ? 'badge-green' : 'badge-red'}`}>{student.active ? 'Active' : 'Inactive'}</span></div>
          </div>
          {student.notes && (
            <div className="notes-box">
              <strong>Notes:</strong> {student.notes}
            </div>
          )}
        </div>
      )}

      {/* Fees Tab */}
      {tab === 'fees' && (
        <div className="card">
          <h3 className="section-title"><Wallet size={18}/> Payment History</h3>
          {fees.length === 0 ? (
            <div className="empty-state"><Wallet size={32}/><p>No payments recorded</p></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Months</th><th>Mode</th></tr>
                </thead>
                <tbody>
                  {fees.map(f => (
                    <tr key={f.id}>
                      <td>{f.datePaid ? format(f.datePaid.toDate(), 'dd MMM yyyy') : '—'}</td>
                      <td>{showFees ? `₹${f.amount?.toLocaleString()}` : '₹****'}</td>
                      <td>
                        <div className="subject-chips">
                          {f.monthsPaid?.map(m => {
                            const [y,mo] = m.split('-');
                            return <span key={m} className="chip">{new Date(Number(y),Number(mo)-1).toLocaleString('en-US',{month:'short',year:'numeric'})}</span>;
                          })}
                        </div>
                      </td>
                      <td><span className="badge badge-blue">{f.mode}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Syllabus Tab */}
      {tab === 'syllabus' && (
        <div className="card">
          <h3 className="section-title"><BookOpen size={18}/> Syllabus Progress</h3>
          <div className="syllabus-progress-bar">
            <div className="progress-fill" style={{ width: `${syllabusProgress}%` }} />
          </div>
          <p className="text-muted">{completedTopics} of {syllabus.length} topics completed ({syllabusProgress}%)</p>
          <div className="syllabus-list">
            {syllabus.map(t => (
              <div key={t.id} className={`syllabus-item status-${t.status}`}>
                <div>
                  <div className="fw-600">{t.topic}</div>
                  <div className="text-muted text-sm">{t.subjects?.join(', ')} — {t.chapter}</div>
                </div>
                <span className={`badge badge-${t.status === 'completed' ? 'green' : t.status === 'in_progress' ? 'orange' : 'gray'}`}>
                  {t.status.replace('_',' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exams Tab */}
      {tab === 'exams' && (
        <div className="card">
          <h3 className="section-title"><BarChart3 size={18}/> School Exam Results</h3>
          {exams.length === 0 ? (
            <div className="empty-state"><BarChart3 size={32}/><p>No exam results recorded</p></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <defs>
                    {subjects.map(sub => {
                      const validPoints = chartData.map((row, index) => ({ val: row[sub] as number | undefined, index })).filter(d => d.val !== undefined);
                      if (validPoints.length === 0) return null;
                      const minIdx = validPoints[0].index;
                      const maxIdx = validPoints[validPoints.length - 1].index;
                      const range = maxIdx - minIdx;
                      return (
                        <linearGradient key={`grad-${sub}`} id={`colorPerf-${sub.replace(/\s+/g, '')}`} x1="0" y1="0" x2="1" y2="0">
                          {validPoints.map((d, i) => {
                            const offset = range > 0 ? ((d.index - minIdx) / range) * 100 : 0;
                            return <stop key={i} offset={`${offset}%`} stopColor={getMarksColor(d.val!)} />;
                          })}
                          {validPoints.length === 1 && (
                            <stop offset="100%" stopColor={getMarksColor(validPoints[0].val!)} />
                          )}
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="exam" tick={{ fontSize: 12 }} padding={{ left: 30, right: 30 }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend />
                  {subjects.map((sub) => {
                    const renderCustomDot = (props: any) => {
                      const { cx, cy, value, index } = props;
                      if (cx == null || cy == null || value == null) return null;
                      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill={getMarksColor(value)} stroke="#fff" strokeWidth={2} />;
                    };
                    return (
                      <Line key={sub} type="monotone" dataKey={sub} stroke={`url(#colorPerf-${sub.replace(/\s+/g, '')})`} strokeWidth={2.5} dot={renderCustomDot} activeDot={{ r: 7 }} />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
              <div className="table-wrap mt-16">
                <table className="data-table">
                  <thead>
                    <tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Max</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {exams.map(ex => (
                      <tr key={ex.id}>
                        <td>{ex.examName}</td>
                        <td>{ex.subjects?.join(', ')}</td>
                        <td>{ex.marksObtained}</td>
                        <td>{ex.maxMarks}</td>
                        <td>
                          <span className={`badge ${getMarksBadgeClass(ex.marksObtained/ex.maxMarks * 100)}`}>
                            {Math.round((ex.marksObtained / ex.maxMarks) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
