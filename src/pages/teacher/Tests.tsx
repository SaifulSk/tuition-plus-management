import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, TuitionTest } from '../../types';
import { Plus, X, ClipboardList, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import MultiSelectObj from '../../components/common/MultiSelectObj';
import { useConfirm } from '../../hooks/useConfirm';

const getMarksBadgeClass = (pct: number) => {
  if (pct >= 90) return 'badge-excel-dark-green';
  if (pct >= 71) return 'badge-excel-light-green';
  if (pct >= 51) return 'badge-excel-yellow';
  if (pct >= 31) return 'badge-excel-pink';
  return 'badge-excel-red';
};

export default function Tests() {
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<TuitionTest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', date: new Date().toISOString().split('T')[0],
    maxMarks: '', marks: {} as Record<string, string>,
  });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student).filter(s => s.active !== false);
      setStudents(data);
      const initMarks: Record<string, string> = {};
      data.forEach(s => { initMarks[s.id] = ''; });
      setForm(f => ({ ...f, marks: initMarks }));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
    loadTests();
  }, []);

  const loadTests = async () => {
    const snap = await getDocs(query(collection(db,'tests'), orderBy('date','desc')));
    setTests(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TuitionTest));
  };

  const openEditModal = (t: TuitionTest) => {
    setEditingTestId(t.id);
    const marksStr: Record<string, string> = {};
    const selectedIds: string[] = [];
    students.forEach(s => { marksStr[s.id] = ''; });
    if (t.studentMarks) {
      Object.entries(t.studentMarks).forEach(([id, mark]) => {
        marksStr[id] = mark.toString();
        selectedIds.push(id);
      });
    }
    setForm({
      title: t.title || '',
      date: t.date ? new Date(t.date.toDate().getTime() - t.date.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      maxMarks: t.maxMarks?.toString() || '',
      marks: marksStr,
    });
    setSubjects(t.subjects || []);
    setSelectedStudentIds(selectedIds);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTestId(null);
    setForm(f => ({ ...f, title:'', maxMarks:'', marks: Object.fromEntries(students.map(s=>[s.id,''])) }));
    setSubjects([]);
    setSelectedStudentIds([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || subjects.length === 0 || !form.maxMarks) { toast.error('Fill required fields'); return; }
    setSaving(true);
    const studentMarks: Record<string,number> = {};
    Object.entries(form.marks).forEach(([id,v]) => {
      if (selectedStudentIds.includes(id) && v !== '') studentMarks[id] = Number(v);
    });
    try {
      const payload = {
        title: form.title,
        subjects,
        date: Timestamp.fromDate(new Date(form.date)),
        maxMarks: Number(form.maxMarks),
        studentMarks,
      };
      
      if (editingTestId) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
           updateDoc(doc(db, 'tests', editingTestId), payload);
        });
        toast.success('Test updated!');
      } else {
        await addDoc(collection(db,'tests'), payload);
        toast.success('Test logged!');
      }
      
      closeModal();
      loadTests();
    } finally { setSaving(false); }
  };

  const deleteTest = (id: string) => {
    confirm('Delete this test?', async () => {
      await deleteDoc(doc(db,'tests',id));
      loadTests();
      toast.success('Test deleted');
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tuition Tests</h1>
          <p className="page-sub">Log tests and manage student marks</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingTestId(null); setForm(f => ({ ...f, title:'', maxMarks:'', marks: Object.fromEntries(students.map(s=>[s.id,''])) })); setSubjects([]); setShowModal(true); }}>
          <Plus size={18}/> Log Test
        </button>
      </div>

      <div className="card">
        {tests.length === 0 ? (
          <div className="empty-state"><ClipboardList size={48}/><p>No tests logged yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subjects</th>
                  <th>Date</th>
                  <th>Max Marks</th>
                  <th>Students Marked</th>
                  <th>Avg Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tests.map(t => {
                  const marked = Object.entries(t.studentMarks || {})
                    .filter(([sid]) => students.some(s => s.id === sid))
                    .map(([_, m]) => m);
                  const avg = marked.length ? Math.round(marked.reduce((a,b)=>a+b,0) / marked.length) : null;
                  return (
                    <tr key={t.id}>
                      <td className="fw-600">{t.title}</td>
                      <td>{t.subjects?.join(', ')}</td>
                      <td>{t.date ? format(t.date.toDate(),'dd MMM yyyy') : '—'}</td>
                      <td>{t.maxMarks}</td>
                      <td>{marked.length} / {students.length}</td>
                      <td>
                        {avg !== null ? (
                          <span className={`badge ${getMarksBadgeClass(Math.round((avg/t.maxMarks)*100))}`}>
                            {avg}/{t.maxMarks}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="icon-btn" onClick={() => openEditModal(t)} title="Edit"><Pencil size={16}/></button>
                          <button className="icon-btn danger" onClick={() => deleteTest(t.id)} title="Delete"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test detail cards */}
      {tests.map(t => (
        <div key={t.id} className="card mt-16">
          <h3 className="section-title">{t.title} — {t.subjects?.join(', ')} ({t.date ? format(t.date.toDate(),'dd MMM yyyy') : ''})</h3>
          <div className="marks-grid">
            {students.map(s => {
              const mark = t.studentMarks?.[s.id];
              const pct = mark !== undefined ? Math.round((mark / t.maxMarks) * 100) : null;
              return (
                <div key={s.id} className="marks-card">
                  <div className="marks-avatar">{s.name.charAt(0)}</div>
                  <div className="marks-name">{s.name}</div>
                  <div className="marks-value">
                    {mark !== undefined ? (
                      <span className={`badge ${getMarksBadgeClass(pct!)}`}>
                        {mark}/{t.maxMarks}
                      </span>
                    ) : <span className="badge badge-gray">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTestId ? 'Edit Test' : 'Log Test'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Test Title *</label>
                  <input type="text" placeholder="e.g. Chapter 3 Test" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Subject *</label>
                  <select 
                    value={subjects[0] || ''}
                    onChange={e => setSubjects([e.target.value])}
                    required
                  >
                    <option value="" disabled>Select subject</option>
                    {masterSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Max Marks *</label>
                  <input type="number" placeholder="e.g. 50" value={form.maxMarks} onChange={e => setForm(f=>({...f,maxMarks:e.target.value}))} required />
                </div>
              </div>
              <h3 className="section-title mt-8">Student Marks</h3>
              
              <div className="form-group mb-16">
                <label>Select Students *</label>
                <MultiSelectObj
                  options={students.map(s => ({ value: s.id, label: `${s.name} (Class ${s.class})` }))}
                  selected={selectedStudentIds}
                  onChange={setSelectedStudentIds}
                  placeholder="Select students to mark"
                />
              </div>

              {selectedStudentIds.length > 0 && (
                <div className="form-grid-2">
                  {students.filter(s => selectedStudentIds.includes(s.id)).map(s => (
                    <div key={s.id} className="form-group">
                      <label>{s.name} <span className="text-muted">(Class {s.class})</span></label>
                      <input
                        type="number"
                        placeholder={`Out of ${form.maxMarks || '?'}`}
                        min={0}
                        max={Number(form.maxMarks)||undefined}
                        value={form.marks[s.id] || ''}
                        onChange={e => setForm(f => ({ ...f, marks: { ...f.marks, [s.id]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingTestId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingTestId ? 'Update Test' : 'Save Test')}
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
