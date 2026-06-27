import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, X, Trash2, Pencil, Book } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubjectMaster {
  id: string;
  name: string;
}

export default function SubjectsMaster() {
  const [subjects, setSubjects] = useState<SubjectMaster[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    const snap = await getDocs(query(collection(db, 'subjects'), orderBy('name')));
    setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SubjectMaster));
  };

  const openEditModal = (s: SubjectMaster) => {
    setEditingId(s.id);
    setForm({ name: s.name });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Enter subject name'); return; }
    
    // Check for duplicates
    if (subjects.some(s => s.name.toLowerCase() === form.name.toLowerCase() && s.id !== editingId)) {
      toast.error('Subject already exists'); return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'subjects', editingId), { name: form.name.trim() });
        toast.success('Subject updated!');
      } else {
        await addDoc(collection(db, 'subjects'), { name: form.name.trim() });
        toast.success('Subject added!');
      }
      closeModal();
      loadSubjects();
    } finally { setSaving(false); }
  };

  const deleteSubject = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this subject from the master list?')) return;
    await deleteDoc(doc(db, 'subjects', id));
    toast.success('Subject deleted');
    loadSubjects();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects Master</h1>
          <p className="page-sub">Manage the master list of subjects used across the app</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingId(null); setForm({ name: '' }); setShowModal(true); }}>
          <Plus size={18} /> Add Subject
        </button>
      </div>

      <div className="card">
        {subjects.length === 0 ? (
          <div className="empty-state"><Book size={48} /><p>No subjects added yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Subject Name</th><th style={{width: 100}}>Actions</th></tr></thead>
              <tbody>
                {subjects.map(s => (
                  <tr key={s.id}>
                    <td className="fw-600">{s.name}</td>
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-btn danger" onClick={() => deleteSubject(s.id)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Subject' : 'Add Subject'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>Subject Name *</label>
                <input type="text" placeholder="e.g. Mathematics" value={form.name} onChange={e => setForm({ name: e.target.value })} required autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingId ? 'Update Subject' : 'Add Subject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
