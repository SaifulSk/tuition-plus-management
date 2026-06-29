import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolExam } from '../../types';
import { BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { getCurrentSession } from '../../utils/dateUtils';

const COLORS = ['#1E3A5F','#C1121F','#10b981','#f59e0b','#8b5cf6','#06b6d4'];

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

export default function StudentResults() {
  const { appUser } = useAuth();
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState('');
  const [studentSession, setStudentSession] = useState('');

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const userDoc = await getDoc(doc(db, 'users', appUser!.uid));
      const sid = userDoc.data()?.studentId;
      if (!sid) { setLoading(false); return; }
      
      const sSnap = await getDoc(doc(db, 'students', sid));
      const sData = sSnap.data();
      const currentSess = sData?.session || getCurrentSession();
      setStudentSession(currentSess);
      setSelectedSession(currentSess);

      const snap = await getDocs(query(collection(db,'schoolExams',sid,'exams'), orderBy('date')));
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SchoolExam));
      setLoading(false);
    }
    load();
  }, [appUser]);

  const distinctSessions = [...new Set([
    studentSession || getCurrentSession(),
    ...exams.map(e => e.session).filter(Boolean)
  ])].sort().reverse();

  useEffect(() => {
    if (distinctSessions.length > 0 && !distinctSessions.includes(selectedSession)) {
      setSelectedSession(distinctSessions[0] as string);
    }
  }, [distinctSessions, selectedSession]);

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

  if (loading) return <div className="page"><div className="loader large"/></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
          <div>
            <h1 className="page-title">My Results</h1>
            <p className="page-sub">School exam performance tracking</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="text-sm fw-600">Session:</label>
            <select className="input" style={{ width: 'auto' }} value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
              {distinctSessions.map(sess => (
                <option key={sess} value={sess as string}>{sess}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredExams.length === 0 ? (
        <div className="empty-state"><BarChart3 size={48}/><p>No exam results recorded yet for {selectedSession}</p></div>
      ) : (
        <>
          <div className="card mb-16">
            <h3 className="section-title">📊 Performance Graph</h3>
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
                      <linearGradient key={`grad-${sub}`} id={`colorPerfStudent-${sub.replace(/\s+/g, '')}`} x1="0" y1="0" x2="1" y2="0">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                <XAxis dataKey="exam" tick={{ fontSize: 12 }} padding={{ left: 30, right: 30 }} />
                <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{ fontSize: 12 }}/>
                <Tooltip formatter={(v: any, name: any) => [`${v}%`, name]}/>
                <Legend/>
                {subjects.map((sub) => {
                  const renderCustomDot = (props: any) => {
                    const { cx, cy, value, index } = props;
                    if (cx == null || cy == null || value == null) return null;
                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill={getMarksColor(value)} stroke="#fff" strokeWidth={2} />;
                  };
                  return (
                    <Line key={sub} connectNulls={true} type="monotone" dataKey={sub} stroke={`url(#colorPerfStudent-${sub.replace(/\s+/g, '')})`} strokeWidth={2.5} dot={renderCustomDot} activeDot={{ r:7 }}/>
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="stats-grid-sm mb-16">
            {subjects.map((sub,i) => {
              const subExams = exams.filter(e => e.subjects?.includes(sub));
              const avg = subExams.length ? Math.round(subExams.reduce((a,e)=>a+(e.marksObtained/e.maxMarks)*100,0)/subExams.length) : 0;
              return (
                <div key={sub} className="stat-card">
                  <div className="stat-body">
                    <div className="stat-value" style={{ color: COLORS[i%COLORS.length] }}>{avg}%</div>
                    <div className="stat-label">{sub}</div>
                    <div className="stat-sub">avg across {subExams.length} exam(s)</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h3 className="section-title">All Results</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Exam</th><th>Subject</th><th>Date</th><th>Marks</th><th>%</th></tr></thead>
                <tbody>
                  {exams.map(ex => {
                    const pct = Math.round((ex.marksObtained/ex.maxMarks)*100);
                    return (
                      <tr key={ex.id}>
                        <td className="fw-600">{ex.examName}</td>
                        <td>{ex.subjects?.join(', ')}</td>
                        <td>{ex.date ? format(ex.date.toDate(),'dd MMM yyyy') : '—'}</td>
                        <td>{ex.marksObtained}/{ex.maxMarks}</td>
                        <td><span className={`badge ${getMarksBadgeClass(pct)}`}>{pct}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
