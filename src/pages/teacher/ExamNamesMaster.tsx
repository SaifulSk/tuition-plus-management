import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, X, Trash2, Pencil, BookOpen, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import { getCurrentSession, getRecentSessions } from '../../utils/dateUtils';
import type { ExamNameMaster } from '../../types';
import { format } from 'date-fns';

export default function ExamNamesMaster() {
  const [examNames, setExamNames] = useState<ExamNameMaster[]>([]);
  const [activeSession, setActiveSession] = useState(getCurrentSession());
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    sessionDates: Record<string, string>;
  }>({ name: '', sessionDates: {} });
  const [saving, setSaving] = useState(false);
  const [customSessionToAdd, setCustomSessionToAdd] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();

  const sessionOptions = getRecentSessions(6);

  useEffect(() => {
    loadExamNames();
  }, []);

  const loadExamNames = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'examNames'), orderBy('name')));
      setExamNames(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ExamNameMaster));
    } catch {
      const snap = await getDocs(collection(db, 'examNames'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ExamNameMaster);
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setExamNames(list);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      sessionDates: { [activeSession]: '' }
    });
    setCustomSessionToAdd('');
    setShowModal(true);
  };

  const openEditModal = (e: ExamNameMaster) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      sessionDates: { ...(e.sessionDates || {}) }
    });
    setCustomSessionToAdd('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '', sessionDates: {} });
    setCustomSessionToAdd('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Enter exam name'); return; }
    
    // Check for duplicates
    if (examNames.some(en => en.name.toLowerCase() === form.name.trim().toLowerCase() && en.id !== editingId)) {
      toast.error('Exam name already exists'); return;
    }

    // Clean up empty session dates
    const cleanedSessionDates: Record<string, string> = {};
    Object.entries(form.sessionDates || {}).forEach(([s, d]) => {
      if (d && d.trim()) {
        cleanedSessionDates[s] = d.trim();
      }
    });

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'examNames', editingId), {
          name: form.name.trim(),
          sessionDates: cleanedSessionDates
        });
        toast.success('Exam name & session dates updated!');
      } else {
        await addDoc(collection(db, 'examNames'), {
          name: form.name.trim(),
          sessionDates: cleanedSessionDates
        });
        toast.success('Exam name added!');
      }
      closeModal();
      loadExamNames();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteExamName = (id: string) => {
    confirm('Are you sure you want to delete this exam name from the master list?', async () => {
      await deleteDoc(doc(db, 'examNames', id));
      toast.success('Exam name deleted');
      loadExamNames();
    });
  };

  // Sessions to display in modal
  const modalSessions = [...new Set([
    activeSession,
    ...sessionOptions,
    ...Object.keys(form.sessionDates || {})
  ])].sort().reverse();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Exam Names Master</h1>
          <p className="page-sub">Manage master exam names and configure their dates for each academic session</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <Plus size={18} /> Add Exam Name
        </button>
      </div>

      {/* Session Filter Bar */}
      <div className="card mb-16" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} style={{ color: 'var(--navy)' }} />
          <span className="fw-600" style={{ fontSize: '13px' }}>Active Academic Session:</span>
          <select 
            className="input" 
            style={{ width: 'auto', padding: '5px 12px', minHeight: '34px', fontSize: '13px' }} 
            value={activeSession} 
            onChange={e => setActiveSession(e.target.value)}
          >
            {sessionOptions.map(s => (
              <option key={s} value={s}>{s}{s === getCurrentSession() ? ' (Current)' : ''}</option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Dates set here auto-fill in School Exams for {activeSession}
        </span>
      </div>

      <div className="card">
        {examNames.length === 0 ? (
          <div className="empty-state"><BookOpen size={48} /><p>No exam names added yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Name</th>
                  <th>Date ({activeSession})</th>
                  <th>Configured Sessions</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {examNames.map(en => {
                  const dateForActive = en.sessionDates?.[activeSession];
                  const configuredSessions = Object.entries(en.sessionDates || {}).filter(([_, d]) => Boolean(d));

                  return (
                    <tr key={en.id}>
                      <td className="fw-600">{en.name}</td>
                      <td>
                        {dateForActive ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} style={{ color: 'var(--primary-dark, #0369a1)' }} />
                            <span className="fw-600" style={{ color: 'var(--text)' }}>
                              {format(new Date(dateForActive + 'T00:00:00'), 'dd MMM yyyy')}
                            </span>
                          </div>
                        ) : (
                          <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            Not set for {activeSession}
                          </span>
                        )}
                      </td>
                      <td>
                        {configuredSessions.length === 0 ? (
                          <span style={{ color: 'var(--text-light)', fontSize: '12px' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {configuredSessions.map(([sess, d]) => (
                              <span 
                                key={sess} 
                                className="badge"
                                style={{
                                  fontSize: '11px',
                                  background: sess === activeSession ? 'rgba(30,58,95,0.1)' : 'var(--surface-2)',
                                  color: sess === activeSession ? 'var(--navy)' : 'var(--text)',
                                  border: sess === activeSession ? '1px solid var(--navy)' : '1px solid var(--border)'
                                }}
                                title={`${sess}: ${format(new Date(d + 'T00:00:00'), 'dd MMM yyyy')}`}
                              >
                                {sess}: {format(new Date(d + 'T00:00:00'), 'dd MMM')}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="icon-btn" onClick={() => openEditModal(en)} title="Edit Exam & Dates"><Pencil size={15} /></button>
                          <button className="icon-btn danger" onClick={() => deleteExamName(en.id)} title="Delete"><Trash2 size={15} /></button>
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
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Exam Name & Dates' : 'Add Exam Name'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>Exam Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Unit Test 1, Mid Term, Final Exam" 
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  required 
                  autoFocus 
                />
              </div>

              {/* Session-wise Dates Config */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <label className="fw-600" style={{ fontSize: '13px', color: 'var(--text)' }}>
                    Session-wise Exam Dates
                  </label>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 10px 0' }}>
                    Set default dates for this exam across academic sessions to auto-fill dates when logging school exams.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' }}>
                  {modalSessions.map(sess => {
                    const isCurrent = sess === getCurrentSession();
                    const isActive = sess === activeSession;
                    const dateVal = form.sessionDates[sess] || '';

                    return (
                      <div 
                        key={sess} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          gap: '12px', 
                          padding: '8px 12px', 
                          background: isActive ? 'rgba(30,58,95,0.04)' : 'var(--surface-2)', 
                          borderRadius: '8px', 
                          border: isActive ? '1.5px solid var(--navy)' : '1px solid var(--border)' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
                          <Calendar size={15} style={{ color: isActive ? 'var(--navy)' : 'var(--text-muted)' }} />
                          <span className="fw-600" style={{ fontSize: '13px' }}>{sess}</span>
                          {isCurrent && (
                            <span className="badge badge-blue" style={{ fontSize: '10px', padding: '1px 5px' }}>Current</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
                          <input
                            type="date"
                            className="input"
                            style={{ width: '150px', padding: '4px 8px', fontSize: '12px', minHeight: '32px' }}
                            value={dateVal}
                            onChange={e => {
                              const val = e.target.value;
                              setForm(f => ({
                                ...f,
                                sessionDates: { ...f.sessionDates, [sess]: val }
                              }));
                            }}
                          />
                          {dateVal && (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Clear date for this session"
                              style={{ padding: '4px' }}
                              onClick={() => {
                                setForm(f => {
                                  const copy = { ...f.sessionDates };
                                  delete copy[sess];
                                  return { ...f, sessionDates: copy };
                                });
                              }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add other custom session */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <input
                    type="text"
                    placeholder="Other session e.g. 2028-2029"
                    className="input"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '12px', minHeight: '32px' }}
                    value={customSessionToAdd}
                    onChange={e => setCustomSessionToAdd(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const trimmed = customSessionToAdd.trim();
                      if (!trimmed) return;
                      if (!modalSessions.includes(trimmed)) {
                        setForm(f => ({
                          ...f,
                          sessionDates: { ...f.sessionDates, [trimmed]: '' }
                        }));
                      }
                      setCustomSessionToAdd('');
                    }}
                  >
                    + Add Session
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingId ? 'Update Exam' : 'Add Exam')}
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

