import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Homework, Student } from '../../types';
import { Plus, X, Book, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useConfirm } from '../../hooks/useConfirm';
import { useSubjects } from '../../hooks/useSubjects';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const { masterSubjects: subjects, formatSubjects } = useSubjects();
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignType, setAssignType] = useState<'class' | 'student'>('class');
  const [studentFilterClass, setStudentFilterClass] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', subject: '',
    targetClass: '',
    targetSchool: '',
    targetStudentId: '',
    dueDate: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  
  const { confirm, ConfirmDialog } = useConfirm();

  const loadData = async () => {
    try {
      const hwSnap = await getDocs(query(collection(db, 'homework'), orderBy('dueDate', 'desc')));
      setHomeworks(hwSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Homework));
      
      const stSnap = await getDocs(collection(db, 'students'));
      const loadedStudents = stSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Student).filter(s => s.active !== false);
      setStudents(loadedStudents);

      const schSnap = await getDocs(query(collection(db, 'schools'), orderBy('name')));
      const schNames = schSnap.docs.map(d => d.data().name as string).filter(Boolean);
      const allSchools = [...new Set([...schNames, ...loadedStudents.map(s => s.school).filter(Boolean)])].sort();
      setSchools(allSchools);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openModal = (hw?: Homework) => {
    if (hw) {
      setEditingId(hw.id);
      const isStudent = hw.targetType === 'student' || !!hw.targetStudentId;
      setAssignType(isStudent ? 'student' : 'class');
      setStudentFilterClass(isStudent ? (hw.targetClass || '') : '');
      setForm({
        title: hw.title,
        description: hw.description,
        subject: hw.subject,
        targetClass: hw.targetClass || '',
        targetSchool: hw.targetSchool || '',
        targetStudentId: hw.targetStudentId || '',
        dueDate: hw.dueDate ? new Date(hw.dueDate.toDate().getTime() - hw.dueDate.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingId(null);
      setAssignType('class');
      setStudentFilterClass('');
      setForm({
        title: '', description: '', subject: '',
        targetClass: '',
        targetSchool: '',
        targetStudentId: '',
        dueDate: new Date().toISOString().split('T')[0]
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.subject) {
      toast.error('Fill required fields'); return;
    }
    if (assignType === 'class' && !form.targetClass) {
      toast.error('Please select a target class'); return;
    }
    if (assignType === 'student' && !form.targetStudentId) {
      toast.error('Please select a target student'); return;
    }
    setSaving(true);
    try {
      const targetStudent = assignType === 'student' ? students.find(s => s.id === form.targetStudentId) : null;
      const payload: Partial<Homework> = {
        title: form.title,
        description: form.description,
        subject: form.subject,
        targetType: assignType,
        targetClass: assignType === 'student' ? (targetStudent?.class || form.targetClass) : form.targetClass,
        targetSchool: assignType === 'class' ? (form.targetSchool || '') : (targetStudent?.school || ''),
        targetStudentId: assignType === 'student' ? form.targetStudentId : '',
        targetStudentName: assignType === 'student' ? (targetStudent?.name || '') : '',
        dueDate: Timestamp.fromDate(new Date(form.dueDate)),
      };

      if (editingId) {
        await updateDoc(doc(db, 'homework', editingId), payload);
        toast.success('Homework updated');
      } else {
        await addDoc(collection(db, 'homework'), {
          ...payload,
          assignedDate: Timestamp.now(),
          completedBy: []
        });
        toast.success('Homework assigned');
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    confirm('Are you sure you want to delete this homework?', async () => {
      await deleteDoc(doc(db, 'homework', id));
      toast.success('Deleted');
      loadData();
    });
  };

  if (loading) return <div className="page"><div className="loader large"/></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Homework Management</h1>
          <p className="page-sub">Assign and track homework</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Assign Homework
        </button>
      </div>

      <div className="card" style={{ padding: '0' }}>
        {homeworks.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <Book size={40} />
            <p>No homework assignments found</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Title</th>
                  <th>Subject</th>
                  <th>Assigned To</th>
                  <th>Assigned</th>
                  <th>Due Date</th>
                  <th>Completion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {homeworks.map(hw => {
                  const isStudentHw = hw.targetType === 'student' || !!hw.targetStudentId;
                  const targetStudents = isStudentHw 
                    ? students.filter(s => s.id === hw.targetStudentId)
                    : students.filter(s => 
                        s.active !== false && 
                        s.class === hw.targetClass && 
                        (!hw.targetSchool || s.school === hw.targetSchool) &&
                        (s.subjects || []).includes(hw.subject)
                      );
                  const completed = isStudentHw 
                    ? (hw.completedBy?.includes(hw.targetStudentId!) ? 1 : 0)
                    : (hw.completedBy?.length || 0);
                  const total = isStudentHw ? 1 : targetStudents.length;
                  const pct = total ? Math.round((completed / total) * 100) : 0;
                  return (
                    <tr key={hw.id}>
                      <td style={{ paddingLeft: '24px' }}>
                        <div className="fw-600">{hw.title}</div>
                        {hw.description && <div className="text-muted text-sm" style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hw.description}</div>}
                      </td>
                      <td><span className="badge badge-gray">{formatSubjects([hw.subject])}</span></td>
                      <td>
                        {isStudentHw ? (
                          <span>
                            <span className="fw-600">{hw.targetStudentName || students.find(s => s.id === hw.targetStudentId)?.name || 'Student'}</span>
                            <span className="text-muted text-sm" style={{ marginLeft: 4 }}>
                              (Class {hw.targetClass || students.find(s => s.id === hw.targetStudentId)?.class})
                            </span>
                          </span>
                        ) : (
                          <span>
                            <span className="badge badge-blue">Class {hw.targetClass}</span>
                            {hw.targetSchool && (
                              <span className="badge badge-gray" style={{ marginLeft: 6 }}>{hw.targetSchool}</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td>{hw.assignedDate ? format(hw.assignedDate.toDate(), 'dd MMM yyyy') : '—'}</td>
                      <td>
                        <span className={`badge ${hw.dueDate.toDate() < new Date() ? 'badge-red' : 'badge-green'}`}>
                          {format(hw.dueDate.toDate(), 'dd MMM yyyy')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="progress-bar" style={{ width: 80, height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 3 }} />
                          </div>
                          <span className="text-sm fw-500">{completed}/{total}</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="icon-btn" onClick={() => openModal(hw)} title="Edit"><Pencil size={16} /></button>
                          <button className="icon-btn danger" onClick={() => handleDelete(hw.id)} title="Delete"><Trash2 size={16} /></button>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Homework' : 'Assign Homework'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group mb-16">
                <label>Title *</label>
                <input type="text" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group mb-16">
                <label>Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Subject *</label>
                  <select className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s} value={s}>{formatSubjects([s])}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
                </div>
              </div>

              <div className="form-group mt-16 mb-16">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Assign To *</label>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                    <input 
                      type="radio" 
                      name="assignType" 
                      value="class" 
                      checked={assignType === 'class'} 
                      onChange={() => setAssignType('class')} 
                    />
                    Class
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                    <input 
                      type="radio" 
                      name="assignType" 
                      value="student" 
                      checked={assignType === 'student'} 
                      onChange={() => setAssignType('student')} 
                    />
                    Student
                  </label>
                </div>
              </div>

              {assignType === 'class' ? (
                <div className="form-grid-2 mb-16">
                  <div className="form-group">
                    <label>School</label>
                    <select 
                      className="input" 
                      value={form.targetSchool} 
                      onChange={e => setForm(f => ({ ...f, targetSchool: e.target.value }))}
                    >
                      <option value="">All Schools</option>
                      {schools.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Class *</label>
                    <select 
                      className="input" 
                      value={form.targetClass} 
                      onChange={e => setForm(f => ({ ...f, targetClass: e.target.value }))} 
                      required
                    >
                      <option value="">Select class</option>
                      {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="form-grid-2 mb-16">
                  <div className="form-group">
                    <label>Filter by Class</label>
                    <select 
                      className="input" 
                      value={studentFilterClass} 
                      onChange={e => {
                        const newClass = e.target.value;
                        setStudentFilterClass(newClass);
                        if (newClass && form.targetStudentId) {
                          const currentSt = students.find(s => s.id === form.targetStudentId);
                          if (currentSt && currentSt.class !== newClass) {
                            setForm(f => ({ ...f, targetStudentId: '', targetClass: newClass }));
                          }
                        }
                      }}
                    >
                      <option value="">All Classes</option>
                      {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Student *</label>
                    <select 
                      className="input" 
                      value={form.targetStudentId} 
                      onChange={e => {
                        const sId = e.target.value;
                        const st = students.find(s => s.id === sId);
                        setForm(f => ({ 
                          ...f, 
                          targetStudentId: sId, 
                          targetClass: st?.class || '' 
                        }));
                        if (st && !studentFilterClass) {
                          setStudentFilterClass(st.class);
                        }
                      }} 
                      required
                    >
                      <option value="">Select student</option>
                      {students
                        .filter(s => s.active !== false && (!studentFilterClass || s.class === studentFilterClass))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
