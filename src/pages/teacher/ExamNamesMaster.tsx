import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, X, Trash2, Pencil, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';

interface ExamNameMaster {
  id: string;
  name: string;
}

export default function ExamNamesMaster() {
  const [examNames, setExamNames] = useState<ExamNameMaster[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadExamNames();
  }, []);

  const loadExamNames = async () => {
    const snap = await getDocs(query(collection(db, 'examNames'), orderBy('name')));
    setExamNames(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ExamNameMaster));
  };

  const openEditModal = (e: ExamNameMaster) => {
    setEditingId(e.id);
    setForm({ name: e.name });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Enter exam name'); return; }
    
    // Check for duplicates
    if (examNames.some(en => en.name.toLowerCase() === form.name.toLowerCase() && en.id !== editingId)) {
      toast.error('Exam name already exists'); return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'examNames', editingId), { name: form.name.trim() });
        toast.success('Exam name updated!');
      } else {
        await addDoc(collection(db, 'examNames'), { name: form.name.trim() });
        toast.success('Exam name added!');
      }
      closeModal();
      loadExamNames();
    } finally { setSaving(false); }
  };

  const deleteExamName = (id: string) => {
    confirm('Are you sure you want to delete this exam name from the master list?', async () => {
      await deleteDoc(doc(db, 'examNames', id));
      toast.success('Exam name deleted');
      loadExamNames();
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Exam Names Master</h1>
          <p className="page-sub">Manage the master list of exam names used across the app</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingId(null); setForm({ name: '' }); setShowModal(true); }}>
          <Plus size={18} /> Add Exam Name
        </button>
      </div>

      <div className="card">
        {examNames.length === 0 ? (
          <div className="empty-state"><BookOpen size={48} /><p>No exam names added yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Exam Name</th><th style={{width: 100}}>Actions</th></tr></thead>
              <tbody>
                {examNames.map(en => (
                  <tr key={en.id}>
                    <td className="fw-600">{en.name}</td>
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" onClick={() => openEditModal(en)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-btn danger" onClick={() => deleteExamName(en.id)} title="Delete"><Trash2 size={15} /></button>
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
              <h2>{editingId ? 'Edit Exam Name' : 'Add Exam Name'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>Exam Name *</label>
                <input type="text" placeholder="e.g. Midterm, Final Exam" value={form.name} onChange={e => setForm({ name: e.target.value })} required autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingId ? 'Update Exam Name' : 'Add Exam Name')}
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
