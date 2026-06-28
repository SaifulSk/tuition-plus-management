import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, X, Trash2, Pencil, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';

interface SchoolMaster {
  id: string;
  name: string;
}

export default function SchoolsMaster() {
  const [schools, setSchools] = useState<SchoolMaster[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    const snap = await getDocs(query(collection(db, 'schools'), orderBy('name')));
    setSchools(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SchoolMaster));
  };

  const openEditModal = (s: SchoolMaster) => {
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
    if (!form.name.trim()) { toast.error('Enter school name'); return; }
    
    // Check for duplicates
    if (schools.some(s => s.name.toLowerCase() === form.name.toLowerCase() && s.id !== editingId)) {
      toast.error('School already exists'); return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'schools', editingId), { name: form.name.trim() });
        toast.success('School updated!');
      } else {
        await addDoc(collection(db, 'schools'), { name: form.name.trim() });
        toast.success('School added!');
      }
      closeModal();
      loadSchools();
    } finally { setSaving(false); }
  };

  const deleteSchool = (id: string) => {
    confirm('Are you sure you want to delete this school from the master list?', async () => {
      await deleteDoc(doc(db, 'schools', id));
      toast.success('School deleted');
      loadSchools();
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Schools Master</h1>
          <p className="page-sub">Manage the master list of schools used across the app</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingId(null); setForm({ name: '' }); setShowModal(true); }}>
          <Plus size={18} /> Add School
        </button>
      </div>

      <div className="card">
        {schools.length === 0 ? (
          <div className="empty-state"><Building size={48} /><p>No schools added yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>School Name</th><th style={{width: 100}}>Actions</th></tr></thead>
              <tbody>
                {schools.map(s => (
                  <tr key={s.id}>
                    <td className="fw-600">{s.name}</td>
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-btn danger" onClick={() => deleteSchool(s.id)} title="Delete"><Trash2 size={15} /></button>
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
              <h2>{editingId ? 'Edit School' : 'Add School'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>School Name *</label>
                <input type="text" placeholder="e.g. St. Xavier's High School" value={form.name} onChange={e => setForm({ name: e.target.value })} required autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingId ? 'Update School' : 'Add School')}
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
