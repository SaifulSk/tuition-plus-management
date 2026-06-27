import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Student, SchoolExam } from '../../types';
import { BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#1E3A5F','#C1121F','#10b981','#f59e0b','#8b5cf6','#06b6d4'];

export default function StudentResults() {
  const { appUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const userDoc = await getDoc(doc(db, 'users', appUser!.uid));
      const sid = userDoc.data()?.studentId;
      if (!sid) { setLoading(false); return; }
      const sSnap = await getDoc(doc(db, 'students', sid));
      if (sSnap.exists()) setStudent({ id: sSnap.id, ...sSnap.data() } as Student);
      const snap = await getDocs(query(collection(db,'schoolExams',sid,'exams'), orderBy('date')));
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SchoolExam));
      setLoading(false);
    }
    load();
  }, [appUser]);

  const subjects = [...new Set(exams.map(e => e.subject))];
  const examNames = [...new Set(exams.map(e => e.examName))];
  const chartData = examNames.map(en => {
    const row: Record<string, string | number> = { exam: en };
    subjects.forEach(sub => {
      const found = exams.find(e => e.examName === en && e.subject === sub);
      if (found) row[sub] = Math.round((found.marksObtained / found.maxMarks) * 100);
    });
    return row;
  });

  if (loading) return <div className="page"><div className="loader large"/></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Results</h1>
          <p className="page-sub">School exam performance tracking</p>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="empty-state"><BarChart3 size={48}/><p>No exam results recorded yet</p></div>
      ) : (
        <>
          <div className="card mb-16">
            <h3 className="section-title">📊 Performance Graph</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                <XAxis dataKey="exam" tick={{ fontSize: 12 }}/>
                <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{ fontSize: 12 }}/>
                <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]}/>
                <Legend/>
                {subjects.map((sub,i) => (
                  <Line key={sub} type="monotone" dataKey={sub} stroke={COLORS[i%COLORS.length]} strokeWidth={2.5} dot={{ r:5 }} activeDot={{ r:7 }}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="stats-grid-sm mb-16">
            {subjects.map((sub,i) => {
              const subExams = exams.filter(e => e.subject === sub);
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
                        <td>{ex.subject}</td>
                        <td>{ex.date ? format(ex.date.toDate(),'dd MMM yyyy') : '—'}</td>
                        <td>{ex.marksObtained}/{ex.maxMarks}</td>
                        <td><span className={`badge ${pct>=75?'badge-green':pct>=50?'badge-orange':'badge-red'}`}>{pct}%</span></td>
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
