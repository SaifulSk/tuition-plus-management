import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, SchoolExam } from '../../types';
import { Plus, X, BarChart3, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const EXAM_NAMES = ['Unit Test 1', 'Unit Test 2', 'Midterm', 'SA1', 'SA2', 'Final Exam'];
const COLORS = ['#1E3A5F','#C1121F','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899'];

export default function SchoolExams() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [form, setForm] = useState({
    examName: '', subject: '', maxMarks: '', marksObtained: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
  }, []);

  const loadExams = async (sid: string) => {
    const snap = await getDocs(query(collection(db,'schoolExams',sid,'exams'), orderBy('date')));
    setExams(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SchoolExam));
  };

  useEffect(() => { if (selectedStudent) loadExams(selectedStudent); else setExams([]); }, [selectedStudent]);

  const student = students.find(s => s.id === selectedStudent);
  const subjects = [...new Set(exams.map(e => e.subject))];
  const examNames = [...new Set(exams.map(e => e.examName))];

  // Build chart data: x = examName, y = percentage per subject
  const chartData = examNames.map(en => {
    const row: Record<string, string | number> = { exam: en };
    subjects.forEach(sub => {
      const found = exams.find(e => e.examName === en && e.subject === sub);
      if (found) row[sub] = Math.round((found.marksObtained / found.maxMarks) * 100);
    });
    return row;
  });

  const openEditModal = (ex: SchoolExam) => {
    setEditingExamId(ex.id);
    setForm({
      examName: ex.examName || '',
      subject: ex.subject || '',
      maxMarks: ex.maxMarks?.toString() || '',
      marksObtained: ex.marksObtained?.toString() || '',
      date: ex.date ? new Date(ex.date.toDate().getTime() - ex.date.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingExamId(null);
    setForm({ examName:'', subject:'', maxMarks:'', marksObtained:'', date: new Date().toISOString().split('T')[0] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !form.examName || !form.subject) { toast.error('Fill required fields'); return; }
    setSaving(true);
    try {
      const payload = {
        studentId: selectedStudent,
        examName: form.examName,
        subject: form.subject,
        maxMarks: Number(form.maxMarks),
        marksObtained: Number(form.marksObtained),
        date: Timestamp.fromDate(new Date(form.date)),
        percentage: Math.round((Number(form.marksObtained)/Number(form.maxMarks))*100),
      };

      if (editingExamId) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
           updateDoc(doc(db, 'schoolExams', selectedStudent, 'exams', editingExamId), payload);
        });
        toast.success('Exam result updated!');
      } else {
        await addDoc(collection(db,'schoolExams',selectedStudent,'exams'), payload);
        toast.success('Exam result saved!');
      }

      closeModal();
      loadExams(selectedStudent);
    } finally { setSaving(false); }
  };

  const deleteExam = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this result?')) return;
    await deleteDoc(doc(db,'schoolExams',selectedStudent,'exams',id));
    loadExams(selectedStudent);
    toast.success('Result deleted');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">School Exam Results</h1>
          <p className="page-sub">Track and visualize school exam performance</p>
        </div>
        {selectedStudent && (
          <button className="btn-primary" onClick={() => { setEditingExamId(null); setForm({ examName:'', subject:'', maxMarks:'', marksObtained:'', date: new Date().toISOString().split('T')[0] }); setShowModal(true); }}>
            <Plus size={18}/> Add Result
          </button>
        )}
      </div>

      <div className="card mb-16">
        <div className="form-group" style={{marginBottom:0}}>
          <label>Select Student</label>
          <select id="exams-student-select" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
            <option value="">— Choose a student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>)}
          </select>
        </div>
      </div>

      {!selectedStudent ? (
        <div className="empty-state"><BarChart3 size={48}/><p>Select a student to view exam results</p></div>
      ) : exams.length === 0 ? (
        <div className="empty-state"><BarChart3 size={48}/><p>No exam results yet for {student?.name}</p></div>
      ) : (
        <>
          {/* Performance chart */}
          <div className="card mb-16">
            <h3 className="section-title">📊 Performance Graph — {student?.name}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="exam" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} />
                <Legend />
                {subjects.map((sub, i) => (
                  <Line
                    key={sub}
                    type="monotone"
                    dataKey={sub}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: COLORS[i % COLORS.length] }}
                    activeDot={{ r: 7 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Per-subject summary */}
          <div className="stats-grid-sm mb-16">
            {subjects.map((sub, i) => {
              const subExams = exams.filter(e => e.subject === sub);
              const avg = subExams.length
                ? Math.round(subExams.reduce((a,e) => a + (e.marksObtained/e.maxMarks)*100, 0) / subExams.length)
                : 0;
              return (
                <div key={sub} className="stat-card" style={{ '--accent': COLORS[i % COLORS.length] } as React.CSSProperties}>
                  <div className="stat-body">
                    <div className="stat-value" style={{ color: COLORS[i % COLORS.length] }}>{avg}%</div>
                    <div className="stat-label">{sub}</div>
                    <div className="stat-sub">{subExams.length} exam(s)</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Results table */}
          <div className="card">
            <h3 className="section-title">All Results</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Exam</th><th>Subject</th><th>Date</th><th>Marks</th><th>Max</th><th>%</th><th></th></tr>
                </thead>
                <tbody>
                  {exams.map(ex => {
                    const pct = Math.round((ex.marksObtained / ex.maxMarks) * 100);
                    return (
                      <tr key={ex.id}>
                        <td className="fw-600">{ex.examName}</td>
                        <td>{ex.subject}</td>
                        <td>{ex.date ? format(ex.date.toDate(),'dd MMM yyyy') : '—'}</td>
                        <td>{ex.marksObtained}</td>
                        <td>{ex.maxMarks}</td>
                        <td>
                          <span className={`badge ${pct>=75?'badge-green':pct>=50?'badge-orange':'badge-red'}`}>
                            {pct}%
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="icon-btn" onClick={() => openEditModal(ex)} title="Edit"><Pencil size={15}/></button>
                            <button className="icon-btn danger" onClick={() => deleteExam(ex.id)} title="Delete"><Trash2 size={15}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingExamId ? 'Edit Exam Result' : 'Add Exam Result'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Exam Name *</label>
                  <input type="text" list="exam-names" placeholder="e.g. SA1" value={form.examName} onChange={e => setForm(f=>({...f,examName:e.target.value}))} required />
                  <datalist id="exam-names">{EXAM_NAMES.map(n => <option key={n} value={n}/>)}</datalist>
                </div>
                <div className="form-group">
                  <label>Subject *</label>
                  <select value={form.subject} onChange={e => setForm(f=>({...f,subject:e.target.value}))} required>
                    <option value="">Select a subject</option>
                    {Array.from(new Set([...(student?.subjects || []), ...masterSubjects])).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Max Marks *</label>
                  <input type="number" placeholder="e.g. 100" value={form.maxMarks} onChange={e => setForm(f=>({...f,maxMarks:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Marks Obtained *</label>
                  <input type="number" placeholder="e.g. 78" value={form.marksObtained} onChange={e => setForm(f=>({...f,marksObtained:e.target.value}))} required max={form.maxMarks} />
                </div>
                <div className="form-group">
                  <label>Exam Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingExamId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingExamId ? 'Update Result' : 'Save Result')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
