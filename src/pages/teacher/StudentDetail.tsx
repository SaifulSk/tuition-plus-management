import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, FeePayment, SyllabusTopic, SchoolExam, FeeChange } from '../../types';
import { ArrowLeft, Mail, Phone, BookOpen, Wallet, BarChart3, GraduationCap, User, Eye, EyeOff, Plus, X, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { getCurrentSession } from '../../utils/dateUtils';

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
  const [loading, setLoading] = useState(true);
  const [showFees, setShowFees] = useState(false);
  const [selectedSession, setSelectedSession] = useState('');
  
  const [showFeeConfig, setShowFeeConfig] = useState(false);
  const [newFeeAmount, setNewFeeAmount] = useState('');
  const [newFeeMonth, setNewFeeMonth] = useState('');

  useEffect(() => {
    if (!id) return;
    async function load() {
      const sSnap = await getDoc(doc(db, 'students', id!));
      if (sSnap.exists()) {
        const data = { id: sSnap.id, ...sSnap.data() } as Student;
        setStudent(data);
        setSelectedSession(data.session || getCurrentSession());
      }

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

  const handleAddFeeChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !newFeeAmount || !newFeeMonth) return;
    
    try {
      const history = student.feeHistory || [];
      const updatedHistory = [...history, { amount: Number(newFeeAmount), effectiveMonth: newFeeMonth }];
      await updateDoc(doc(db, 'students', student.id), {
        feeHistory: updatedHistory
      });
      setStudent({ ...student, feeHistory: updatedHistory });
      setNewFeeAmount('');
      setNewFeeMonth('');
      setShowFeeConfig(false);
      toast.success('Fee configuration updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update fee');
    }
  };

  const handleRemoveFeeChange = async (idx: number) => {
    if (!student) return;
    try {
      const updatedHistory = (student.feeHistory || []).filter((_, i) => i !== idx);
      await updateDoc(doc(db, 'students', student.id), {
        feeHistory: updatedHistory
      });
      setStudent({ ...student, feeHistory: updatedHistory });
      toast.success('Fee configuration removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove fee');
    }
  };

  if (loading) return <div className="page"><div className="loader large" /></div>;
  if (!student) return <div className="page"><p>Student not found.</p></div>;

  const totalFeesPaid = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const completedTopics = syllabus.filter(t => t.status === 'completed').length;
  const syllabusProgress = syllabus.length ? Math.round((completedTopics / syllabus.length) * 100) : 0;

  // Build exam chart data grouped by subject
  const distinctSessions = [...new Set([
    student?.session || getCurrentSession(),
    ...exams.map(e => e.session).filter(Boolean)
  ])].sort().reverse();

  const filteredExams = exams.filter(e => (e.session || getCurrentSession()) === selectedSession);

  const subjects = [...new Set(filteredExams.flatMap(e => e.subjects || []))];
  const examNames = [...new Set(filteredExams.map(e => e.examName))];

  const chartData = examNames.map(en => {
    const row: Record<string, string | number> = { exam: en };
    subjects.forEach(sub => {
      const found = filteredExams.find(e => e.examName === en && e.subjects?.includes(sub));
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
        
        <div className="card mt-16">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ margin: 0 }}><Settings size={18}/> Fee Configuration (Variable Fees)</h3>
            <button className="btn-secondary" onClick={() => setShowFeeConfig(!showFeeConfig)}>
              {showFeeConfig ? 'Cancel' : <><Plus size={16}/> Add Change</>}
            </button>
          </div>
          
          <p className="text-muted text-sm mb-16">
            If the student changes subjects mid-session, record the new fee amount and the month it becomes effective from here. This ensures past unpaid months are still calculated at the old fee rate.
          </p>
          
          {showFeeConfig && (
            <form onSubmit={handleAddFeeChange} className="card bg-surface-2" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Effective Month *</label>
                  <input type="month" value={newFeeMonth} onChange={e => setNewFeeMonth(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>New Amount (₹) *</label>
                  <input type="number" value={newFeeAmount} onChange={e => setNewFeeAmount(e.target.value)} required placeholder="e.g. 2000" />
                </div>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Effective From Month</th><th>Monthly Fee Amount</th><th style={{width:50}}></th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{student.joiningDate ? format(student.joiningDate.toDate(), 'MMMM yyyy') : 'Joining Date'} (Base Fee)</td>
                  <td>₹{student.confirmedFee?.toLocaleString()}</td>
                  <td></td>
                </tr>
                {(student.feeHistory || []).sort((a,b) => a.effectiveMonth.localeCompare(b.effectiveMonth)).map((fh, idx) => (
                  <tr key={idx}>
                    <td>
                      {(() => {
                        const [y,m] = fh.effectiveMonth.split('-');
                        return new Date(Number(y), Number(m)-1).toLocaleString('en-US', {month:'long', year:'numeric'});
                      })()}
                    </td>
                    <td>₹{fh.amount.toLocaleString()}</td>
                    <td>
                      <button className="btn-ghost" style={{ color: 'var(--red)', padding: 4 }} onClick={() => handleRemoveFeeChange(idx)}>
                        <X size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <h3 className="section-title" style={{ margin: 0 }}><BarChart3 size={18}/> School Exam Results</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="text-sm fw-600">Session:</label>
              <select className="input" style={{ width: 'auto', padding: '4px 8px', minHeight: '32px' }} value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                {distinctSessions.map(sess => (
                  <option key={sess} value={sess as string}>{sess}</option>
                ))}
              </select>
            </div>
          </div>
          {filteredExams.length === 0 ? (
            <div className="empty-state"><BarChart3 size={32}/><p>No exam results recorded for {selectedSession}</p></div>
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
                      <Line key={sub} connectNulls={true} type="monotone" dataKey={sub} stroke={`url(#colorPerf-${sub.replace(/\s+/g, '')})`} strokeWidth={2.5} dot={renderCustomDot} activeDot={{ r: 7 }} />
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
                    {filteredExams.map(ex => (
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
