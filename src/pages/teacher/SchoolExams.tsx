import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, Timestamp, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, SchoolExam } from '../../types';
import { Plus, X, BarChart3, Trash2, Pencil, ChevronDown, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import MultiSelect from '../../components/common/MultiSelect';
import { useConfirm } from '../../hooks/useConfirm';
import { getCurrentSession } from '../../utils/dateUtils';

const EXAM_NAMES = ['Unit Test 1', 'Unit Test 2', 'Midterm', 'SA1', 'SA2', 'Final Exam'];
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

const COLORS = ['#1E3A5F','#C1121F','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899'];



export default function SchoolExams() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'student' | 'master'>('master');
  const [masterExpandedClass, setMasterExpandedClass] = useState<string | null>(null);
  const [masterClassExams, setMasterClassExams] = useState<SchoolExam[]>([]);
  const [masterSubject, setMasterSubject] = useState<string>('');
  const [masterLoading, setMasterLoading] = useState(false);

  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [form, setForm] = useState({
    examName: '', maxMarks: '', marksObtained: '',
    date: new Date().toISOString().split('T')[0],
    session: '', className: ''
  });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student).filter(s => s.active !== false));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
  }, []);

  const loadExams = async (sid: string) => {
    const snap = await getDocs(query(collection(db,'schoolExams',sid,'exams'), orderBy('date')));
    setExams(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SchoolExam));
  };

  const [selectedSession, setSelectedSession] = useState('');

  useEffect(() => { 
    if (selectedStudent) {
      const s = students.find(x => x.id === selectedStudent);
      setSelectedSession(s?.session || getCurrentSession());
      loadExams(selectedStudent); 
    } else { 
      setExams([]); 
    } 
  }, [selectedStudent]);

  const student = students.find(s => s.id === selectedStudent);
  
  const distinctSessions = [...new Set([
    student?.session || getCurrentSession(),
    ...exams.map(e => e.session).filter(Boolean)
  ])].sort().reverse();

  useEffect(() => {
    if (distinctSessions.length > 0 && !distinctSessions.includes(selectedSession)) {
      setSelectedSession(distinctSessions[0] as string);
    }
  }, [distinctSessions, selectedSession]);

  const filteredExams = exams.filter(e => (e.session || getCurrentSession()) === selectedSession);

  const distinctSubjects = [...new Set(filteredExams.flatMap(e => e.subjects || []))];
  const examNames = [...new Set(filteredExams.map(e => e.examName))];

  // Build chart data: x = examName, y = percentage per subject
  const chartData = examNames.map(en => {
    const row: Record<string, string | number> = { exam: en };
    distinctSubjects.forEach(sub => {
      const found = filteredExams.find(e => e.examName === en && e.subjects?.includes(sub));
      if (found) row[sub] = Math.round((found.marksObtained / found.maxMarks) * 100);
    });
    return row;
  });

  const openEditModal = (ex: SchoolExam) => {
    setEditingExamId(ex.id);
    setForm({
      examName: ex.examName || '',
      maxMarks: ex.maxMarks?.toString() || '',
      marksObtained: ex.marksObtained?.toString() || '',
      date: ex.date ? new Date(ex.date.toDate().getTime() - ex.date.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      session: ex.session || getCurrentSession(),
      className: ex.className || student?.class || ''
    });
    setSubjects(ex.subjects || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingExamId(null);
    setForm({ examName:'', maxMarks:'', marksObtained:'', date: new Date().toISOString().split('T')[0], session: '', className: '' });
    setSubjects([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !form.examName || subjects.length === 0) { toast.error('Fill required fields'); return; }
    setSaving(true);
    try {
      const payload = {
        studentId: selectedStudent,
        examName: form.examName,
        subjects,
        maxMarks: Number(form.maxMarks),
        marksObtained: Number(form.marksObtained),
        date: Timestamp.fromDate(new Date(form.date)),
        percentage: Math.round((Number(form.marksObtained)/Number(form.maxMarks))*100),
        session: form.session || getCurrentSession(),
        className: form.className || student?.class || ''
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

  const deleteExam = (id: string) => {
    confirm('Are you sure you want to delete this result?', async () => {
      await deleteDoc(doc(db,'schoolExams',selectedStudent,'exams',id));
      loadExams(selectedStudent);
      toast.success('Result deleted');
    });
  };

  const handleToggleClass = async (className: string) => {
    if (masterExpandedClass === className) {
      setMasterExpandedClass(null);
      return;
    }
    setMasterExpandedClass(className);
    setMasterSubject('');
    setMasterLoading(true);
    try {
      const classStudents = students.filter(s => s.class === className && s.active !== false);
      const studentMap = new Map(classStudents.map(s => [s.id, s.name]));
      const currentSess = getCurrentSession();
      const snap = await getDocs(collectionGroup(db, 'exams'));
      const allExams: (SchoolExam & { studentName?: string })[] = [];
      snap.docs.forEach(d => {
        const studentId = d.ref.parent.parent?.id;
        if (studentId && studentMap.has(studentId)) {
          const e = { id: d.id, studentId, studentName: studentMap.get(studentId), ...d.data() } as SchoolExam & { studentName?: string };
          if ((e.session || currentSess) === currentSess) {
            allExams.push(e);
          }
        }
      });
      allExams.sort((a, b) => {
        const timeA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date as any).getTime();
        const timeB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date as any).getTime();
        return timeA - timeB;
      });
      setMasterClassExams(allExams);
    } catch (err: any) {
      toast.error('Failed to load class exams');
    } finally {
      setMasterLoading(false);
    }
  };

  const masterClasses = [...new Set(students.filter(s => s.active !== false).map(s => s.class))].sort((a,b) => parseInt(a) - parseInt(b));
  
  // Master chart data
  const masterFilteredExams = masterClassExams.filter(e => e.subjects?.includes(masterSubject));
  const masterExamNames = [...new Set(masterFilteredExams.map(e => e.examName))];
  const masterStudentsInSubject = [...new Set(masterFilteredExams.map(e => (e as any).studentName))];

  const masterChartData = masterExamNames.map(en => {
    const row: Record<string, string | number> = { exam: en };
    masterFilteredExams.filter(e => e.examName === en).forEach(e => {
      row[(e as any).studentName] = Math.round((e.marksObtained / e.maxMarks) * 100);
    });
    return row;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">School Exam Results</h1>
          <p className="page-sub">Track and visualize school exam performance</p>
        </div>
        {selectedStudent && (
          <button className="btn-primary" onClick={() => { setEditingExamId(null); setForm({ examName:'', maxMarks:'', marksObtained:'', date: new Date().toISOString().split('T')[0], session: selectedSession, className: student?.class || '' }); setSubjects([]); setShowModal(true); }}>
            <Plus size={18}/> Add Result
          </button>
        )}
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${viewMode === 'master' ? 'active' : ''}`} onClick={() => setViewMode('master')}>Master View</button>
          <button className={`tab-btn ${viewMode === 'student' ? 'active' : ''}`} onClick={() => setViewMode('student')}>Student View</button>
        </div>
      </div>

      {viewMode === 'student' && (
        <>
          <div className="card mb-16" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{marginBottom:0, flex: 1, minWidth: '200px'}}>
              <label>Select Student</label>
              <select id="exams-student-select" className="input" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                <option value="">— Choose a student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>)}
              </select>
            </div>
            
            {selectedStudent && (
              <div className="form-group" style={{marginBottom:0, flex: 1, minWidth: '200px'}}>
                <label>Academic Session</label>
                <select className="input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                  {distinctSessions.map(sess => (
                    <option key={sess} value={sess as string}>{sess}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!selectedStudent ? (
        <div className="empty-state"><BarChart3 size={48}/><p>Select a student to view exam results</p></div>
      ) : filteredExams.length === 0 ? (
        <div className="empty-state"><BarChart3 size={48}/><p>No exam results yet for {student?.name} in {selectedSession}</p></div>
      ) : (
        <>
          {/* Performance chart */}
          <div className="card mb-16">
            <h3 className="section-title">📊 Performance Graph — {student?.name}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <defs>
                  {distinctSubjects.map(sub => {
                    const validPoints = chartData.map((row, index) => ({ val: row[sub] as number | undefined, index })).filter(d => d.val !== undefined);
                    if (validPoints.length === 0) return null;
                    const minIdx = validPoints[0].index;
                    const maxIdx = validPoints[validPoints.length - 1].index;
                    const range = maxIdx - minIdx;
                    return (
                      <linearGradient key={`grad-${sub}`} id={`colorPerfExams-${sub.replace(/\s+/g, '')}`} x1="0" y1="0" x2="1" y2="0">
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
                <Tooltip formatter={(v: any, name: any) => [`${v}%`, name]} />
                <Legend />
                {distinctSubjects.map((sub) => {
                  const renderCustomDot = (props: any) => {
                    const { cx, cy, value, index } = props;
                    if (cx == null || cy == null || value == null) return null;
                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill={getMarksColor(value)} stroke="#fff" strokeWidth={2} />;
                  };
                  return (
                    <Line
                      key={sub}
                      type="monotone"
                      dataKey={sub}
                      connectNulls={true}
                      stroke={`url(#colorPerfExams-${sub.replace(/\s+/g, '')})`}
                      strokeWidth={2.5}
                      dot={renderCustomDot}
                      activeDot={{ r: 7 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Per-subject summary */}
          <div className="stats-grid-sm mb-16">
            {distinctSubjects.map((sub, i) => {
              const subExams = filteredExams.filter(e => e.subjects?.includes(sub));
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
                  <tr><th>Exam</th><th>Subjects</th><th>Date</th><th>Marks</th><th>Max</th><th>%</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredExams.map(ex => {
                    const pct = Math.round((ex.marksObtained / ex.maxMarks) * 100);
                    return (
                      <tr key={ex.id}>
                        <td className="fw-600">{ex.examName}</td>
                        <td>{ex.subjects?.join(', ')}</td>
                        <td>{ex.date ? format(ex.date.toDate(),'dd MMM yyyy') : '—'}</td>
                        <td>{ex.marksObtained}</td>
                        <td>{ex.maxMarks}</td>
                        <td>
                          <span className={`badge ${getMarksBadgeClass(pct)}`}>
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
        </>
      )}

      {viewMode === 'master' && (
        <div className="card mb-16">
          <h2 className="section-title mb-16">Class-wise Performance</h2>
          {masterClasses.length === 0 ? (
            <div className="empty-state"><BarChart3 size={48}/><p>No active classes found.</p></div>
          ) : (
            <div className="accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {masterClasses.map(cls => {
                const isExpanded = masterExpandedClass === cls;
                return (
                  <div key={cls} className={`accordion-item ${isExpanded ? 'expanded' : ''}`} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div 
                      className="accordion-header" 
                      onClick={() => handleToggleClass(cls)}
                      style={{ padding: '16px', background: isExpanded ? 'var(--bg)' : 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} color="var(--navy)" />
                        Class {cls}
                      </div>
                      {isExpanded ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
                    </div>
                    {isExpanded && (
                      <div className="accordion-body" style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                        {masterLoading ? (
                          <div className="loader" style={{ margin: '20px auto' }} />
                        ) : (
                          <>
                            {masterClassExams.length === 0 ? (
                              <div className="empty-state" style={{ padding: '24px 0' }}><p>No exam results found for this class.</p></div>
                            ) : (
                              <>
                                <div className="form-group mb-16" style={{ maxWidth: '300px' }}>
                                  <label>Select Subject</label>
                                  <select className="input" value={masterSubject} onChange={e => setMasterSubject(e.target.value)}>
                                    <option value="">— Select Subject —</option>
                                    {[...new Set(masterClassExams.flatMap(e => e.subjects || []))].map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                {masterSubject ? (
                                  masterChartData.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '24px 0' }}><p>No exams found for {masterSubject}.</p></div>
                                  ) : (
                                    <ResponsiveContainer width="100%" height={400}>
                                      <LineChart data={masterChartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis dataKey="exam" tick={{ fontSize: 12 }} padding={{ left: 30, right: 30 }} />
                                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v: any, name: any) => [`${v}%`, name]} />
                                        <Legend />
                                        {masterStudentsInSubject.map((sName, i) => {
                                          const color = COLORS[i % COLORS.length];
                                          const renderCustomDot = (props: any) => {
                                            const { cx, cy, value, index } = props;
                                            if (cx == null || cy == null || value == null) return null;
                                            return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1} />;
                                          };
                                          return (
                                            <Line
                                              key={sName as string}
                                              name={sName as string}
                                              type="monotone"
                                              dataKey={sName as string}
                                              connectNulls={true}
                                              stroke={color}
                                              strokeWidth={2.5}
                                              dot={renderCustomDot}
                                              activeDot={{ r: 6 }}
                                            />
                                          );
                                        })}
                                      </LineChart>
                                    </ResponsiveContainer>
                                  )
                                ) : (
                                  <div className="empty-state" style={{ padding: '24px 0' }}>
                                    <BarChart3 size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                    <p>Please select a subject to view performance</p>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                  <label>Subjects *</label>
                  <MultiSelect 
                    options={Array.from(new Set([...(student?.subjects || []), ...masterSubjects]))}
                    selected={subjects}
                    onChange={setSubjects}
                    placeholder="Select subjects"
                    required
                    showSelectAll
                  />
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
                <div className="form-group">
                  <label>Academic Session</label>
                  <input type="text" placeholder="e.g. 2024-2025" value={form.session} onChange={e => setForm(f=>({...f,session:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Class Name</label>
                  <input type="text" placeholder="e.g. 9" value={form.className} onChange={e => setForm(f=>({...f,className:e.target.value}))} />
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
      {ConfirmDialog}
    </div>
  );
}
