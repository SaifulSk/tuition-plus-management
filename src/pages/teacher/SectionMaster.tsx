import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, X, Trash2, Pencil, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';

interface SectionMaster {
  id: string;
  name: string;
}

export default function SectionMaster() {
  const [sections, setSections] = useState<SectionMaster[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    const snap = await getDocs(query(collection(db, 'sections'), orderBy('name')));
    setSections(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SectionMaster));
  };

  const openEditModal = (s: SectionMaster) => {
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
    if (!form.name.trim()) { toast.error('Enter section name'); return; }
    
    // Check for duplicates
    if (sections.some(s => s.name.toLowerCase() === form.name.toLowerCase() && s.id !== editingId)) {
      toast.error('Section already exists'); return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'sections', editingId), { name: form.name.trim() });
        toast.success('Section updated!');
      } else {
        await addDoc(collection(db, 'sections'), { name: form.name.trim() });
        toast.success('Section added!');
      }
      closeModal();
      loadSections();
    } finally { setSaving(false); }
  };

  const deleteSection = (id: string) => {
    confirm('Are you sure you want to delete this section from the master list?', async () => {
      await deleteDoc(doc(db, 'sections', id));
      toast.success('Section deleted');
      loadSections();
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sections Master</h1>
          <p className="page-sub">Manage the master list of sections used across the app</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingId(null); setForm({ name: '' }); setShowModal(true); }}>
          <Plus size={18} /> Add Section
        </button>
      </div>

      <div className="card">
        {sections.length === 0 ? (
          <div className="empty-state"><Users size={48} /><p>No sections added yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Section Name</th><th style={{width: 100}}>Actions</th></tr></thead>
              <tbody>
                {sections.map(s => (
                  <tr key={s.id}>
                    <td className="fw-600">{s.name}</td>
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-btn danger" onClick={() => deleteSection(s.id)} title="Delete"><Trash2 size={15} /></button>
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
              <h2>{editingId ? 'Edit Section' : 'Add Section'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>Section Name *</label>
                <input type="text" placeholder="e.g. A, B, Alpha" value={form.name} onChange={e => setForm({ name: e.target.value })} required autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingId ? 'Update Section' : 'Add Section')}
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
