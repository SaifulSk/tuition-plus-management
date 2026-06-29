import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Homework, Student } from '../../types';
import { Plus, X, Book, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useConfirm } from '../../hooks/useConfirm';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', subject: '',
    targetClass: '',
    dueDate: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  
  const { confirm, ConfirmDialog } = useConfirm();

  const loadData = async () => {
    try {
      const hwSnap = await getDocs(query(collection(db, 'homework'), orderBy('dueDate', 'desc')));
      setHomeworks(hwSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Homework));
      
      const stSnap = await getDocs(collection(db, 'students'));
      setStudents(stSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Student));
      
      const subSnap = await getDocs(collection(db, 'subjects'));
      setSubjects(subSnap.docs.map(d => d.data().name));
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
      setForm({
        title: hw.title,
        description: hw.description,
        subject: hw.subject,
        targetClass: hw.targetClass || '',
        dueDate: hw.dueDate ? new Date(hw.dueDate.toDate().getTime() - hw.dueDate.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingId(null);
      setForm({
        title: '', description: '', subject: '',
        targetClass: '',
        dueDate: new Date().toISOString().split('T')[0]
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.subject || !form.targetClass) {
      toast.error('Fill required fields'); return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        subject: form.subject,
        targetClass: form.targetClass,
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
                  <th>Class</th>
                  <th>Assigned</th>
                  <th>Due Date</th>
                  <th>Completion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {homeworks.map(hw => {
                  const targetStudents = students.filter(s => s.active !== false && s.class === hw.targetClass && (s.subjects || []).includes(hw.subject));
                  const completed = hw.completedBy?.length || 0;
                  const total = targetStudents.length;
                  const pct = total ? Math.round((completed / total) * 100) : 0;
                  return (
                    <tr key={hw.id}>
                      <td style={{ paddingLeft: '24px' }}>
                        <div className="fw-600">{hw.title}</div>
                        {hw.description && <div className="text-muted text-sm" style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hw.description}</div>}
                      </td>
                      <td><span className="badge badge-gray">{hw.subject}</span></td>
                      <td>{hw.targetClass}</td>
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
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group mt-16 mb-16">
                <label>Target Class *</label>
                <select className="input" value={form.targetClass} onChange={e => setForm(f => ({ ...f, targetClass: e.target.value }))} required>
                  <option value="">Select class</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
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
