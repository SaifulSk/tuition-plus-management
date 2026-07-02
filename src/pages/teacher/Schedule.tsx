import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, ScheduleSlot, DayOfWeek } from '../../types';
import { Plus, X, Clock, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import MultiSelect from '../../components/common/MultiSelect';
import { useConfirm } from '../../hooks/useConfirm';

const DAYS: DayOfWeek[] = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const COLOR_MAP = {
  tuition: 'slot-tuition',
  other_tuition: 'slot-other',
};

const formatTime12h = (time24: string) => {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  const hours = parseInt(h, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${m} ${suffix}`;
};

export default function Schedule() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [modalStudentId, setModalStudentId] = useState('');
  const [viewMode, setViewMode] = useState<'student' | 'master'>('master');
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS);
    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [allSlots, setAllSlots] = useState<ScheduleSlot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [form, setForm] = useState({
    day: 'Monday' as DayOfWeek,
    startTime: '16:00',
    endTime: '17:00',
    type: 'tuition' as 'tuition' | 'other_tuition',
    notes: '',
  });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
  }, []);

  const loadAllSlots = async () => {
    const snap = await getDocs(collectionGroup(db, 'slots'));
    const allDocs = snap.docs.map(d => {
      const studentId = d.data().studentId || d.ref.parent.parent?.id;
      return { id: d.id, ...d.data(), studentId } as ScheduleSlot;
    });
    setAllSlots(allDocs);
  };

  useEffect(() => {
    if (students.length > 0) loadAllSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const loadSlots = async (studentId: string) => {
    const snap = await getDocs(collection(db,'schedules',studentId,'slots'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ScheduleSlot);
    setSlots(data);
  };

  useEffect(() => {
    if (selectedStudent) loadSlots(selectedStudent);
    else setSlots([]);
  }, [selectedStudent, students]);

  const openEditModal = (s: ScheduleSlot, studentId: string) => {
    setEditingSlotId(s.id);
    setModalStudentId(studentId);
    setForm({
      day: s.day || 'Monday',
      startTime: s.startTime || '16:00',
      endTime: s.endTime || '17:00',
      type: s.type || 'tuition',
      notes: s.notes || '',
    });
    setSubjects(s.subjects || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSlotId(null);
    setModalStudentId('');
    setForm({ day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' });
    setSubjects([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStudentId) { toast.error('Select a student'); return; }
    setSaving(true);
    try {
      const payload = { ...form, subjects, studentId: modalStudentId };
      if (editingSlotId) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
           updateDoc(doc(db, 'schedules', modalStudentId, 'slots', editingSlotId), payload);
        });
        toast.success('Slot updated!');
      } else {
        await addDoc(collection(db,'schedules',modalStudentId,'slots'), payload);
        toast.success('Slot added!');
      }
      closeModal();
      loadAllSlots();
      if (selectedStudent === modalStudentId) loadSlots(modalStudentId);
    } finally { setSaving(false); }
  };

  const deleteSlot = (slotId: string, studentId: string) => {
    confirm('Are you sure you want to delete this slot?', async () => {
      await deleteDoc(doc(db,'schedules',studentId,'slots',slotId));
      toast.success('Slot removed');
      loadAllSlots();
      if (selectedStudent === studentId) loadSlots(studentId);
    });
  };

  
  // Grouped data for Master View
  const groupedMaster = DAYS.reduce((acc, day) => {
    const daySlots = allSlots.filter(s => s.day === day);
    const slotMap = new Map<string, { startTime: string, endTime: string, type: 'tuition'|'other_tuition', students: { id: string, name: string, subjects: string[], slotId: string }[] }>();
    
    daySlots.forEach(s => {
      const key = `${s.startTime}-${s.endTime}-${s.type}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, { startTime: s.startTime, endTime: s.endTime, type: s.type, students: [] });
      }
      const st = students.find(x => x.id === s.studentId);
      if (st) {
        slotMap.get(key)!.students.push({ id: st.id, name: st.name, subjects: s.subjects || [], slotId: s.id });
      }
    });
    
    acc[day] = Array.from(slotMap.values()).sort((a,b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {} as Record<string, any[]>);

  const student = students.find(s => s.id === selectedStudent);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Schedule</h1>
          <p className="page-sub">Manage teaching slots per student</p>
        </div>
        <button className="btn-primary" onClick={() => { 
          setModalStudentId(viewMode === 'student' ? selectedStudent : '');
          setEditingSlotId(null); 
          setForm({ day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' }); 
          setSubjects([]); 
          setShowModal(true); 
        }}>
          <Plus size={18} /> Add Slot
        </button>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${viewMode === 'master' ? 'active' : ''}`} onClick={() => setViewMode('master')}>
            Master View
          </button>
          <button className={`tab-btn ${viewMode === 'student' ? 'active' : ''}`} onClick={() => setViewMode('student')}>
            Student View
          </button>
        </div>
        
        {viewMode === 'master' && (
          <div style={{ width: '220px', marginLeft: 'auto' }}>
            <MultiSelect 
              options={DAYS} 
              selected={selectedDays} 
              onChange={setSelectedDays} 
              placeholder="Select days"
              showSelectAll
            />
          </div>
        )}
      </div>

      {viewMode === 'master' && (
        <div className="card mt-16" style={{ overflowX: 'auto', background: 'var(--surface)' }}>
          
          <div style={{ display: 'flex', gap: '16px', minWidth: '900px', padding: '8px' }}>
            {DAYS.filter(d => selectedDays.includes(d)).map(day => (
              <div key={day} style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', borderTop: '4px solid var(--primary)', fontWeight: 700, textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                  {day}
                </div>
                
                {groupedMaster[day].length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    No slots
                    <button className="btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--primary)' }} onClick={() => {
                      setEditingSlotId(null);
                      setModalStudentId('');
                      setForm({ day: day as DayOfWeek, startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' });
                      setSubjects([]);
                      setShowModal(true);
                    }}>
                      <Plus size={14} /> Add Slot
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {groupedMaster[day].map((slotInfo, i) => (
                      <div key={i} className={`card slot-card ${slotInfo.type === 'tuition' ? 'tuition-border' : 'other-border'}`} style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', margin: 0, boxShadow: 'var(--shadow-sm)' }}>
                        <div className="fw-700" style={{ fontSize: '13px', color: 'var(--text)' }}>
                          {formatTime12h(slotInfo.startTime)} – {formatTime12h(slotInfo.endTime)}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {slotInfo.students.map((st: any) => (
                            <div key={st.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', width: '100%', border: '1px solid var(--border-light)' }}>
                              <span 
                                className="fw-500 hover-primary" 
                                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                                title={st.subjects.join(', ')}
                                onClick={() => { setSelectedStudent(st.id); setViewMode('student'); }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'inherit'}
                              >
                                {st.name}
                              </span>
                              <button className="icon-btn danger" style={{ padding: '2px', height: 'auto', width: 'auto' }} onClick={() => deleteSlot(st.slotId, st.id)} title="Remove">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button className="btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: '4px', padding: '4px 8px', fontSize: '12px', color: 'var(--primary)' }} onClick={() => {
                          setEditingSlotId(null);
                          setModalStudentId('');
                          setForm({ day: day as DayOfWeek, startTime: slotInfo.startTime, endTime: slotInfo.endTime, type: slotInfo.type, notes: '' });
                          setSubjects([]);
                          setShowModal(true);
                        }}>
                          <Plus size={14} /> Add Student
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'student' && (
        <>
          {/* Student selector */}
          <div className="card mb-16">
            <div className="form-group" style={{marginBottom:0}}>
              <label>Select Student</label>
              <select
                id="schedule-student-select"
                value={selectedStudent}
                onChange={e => { setSelectedStudent(e.target.value); setModalStudentId(e.target.value); }}
              >
                <option value="">— Choose a student —</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                ))}
              </select>
            </div>
          </div>

      {!selectedStudent ? (
        <div className="empty-state">
          <Clock size={48} />
          <p>Select a student to view and manage their schedule</p>
        </div>
      ) : (
        <>
          <div className="legend">
            <span className="legend-item"><span className="legend-dot tuition"/>My Teaching Slot</span>
            <span className="legend-item"><span className="legend-dot other"/>Other Tuition</span>
          </div>

          {/* Weekly grid */}
          <div className="schedule-grid">
            {DAYS.map(day => {
              const daySlots = slots.filter(s => s.day === day);
                            return (
                <div key={day} className="schedule-day">
                  <div className="schedule-day-header">{day.slice(0,3)}</div>
                  <div className="schedule-day-body">
                    {daySlots.map(slot => (
                      <div key={slot.id} className={`schedule-slot ${COLOR_MAP[slot.type]}`}>
                        <div className="slot-time">{formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}</div>
                        <div className="slot-subject">{slot.subjects?.join(', ')}</div>
                        {slot.type === 'other_tuition' && <div className="slot-label">Other Tuition</div>}
                        <div className="slot-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                          <button className="slot-delete" style={{background:'white', color:'var(--text)', border:'none', borderRadius:4, padding:2, cursor:'pointer'}} onClick={() => openEditModal(slot, selectedStudent)}><Pencil size={12}/></button>
                          <button className="slot-delete" style={{background:'var(--danger)', color:'white', border:'none', borderRadius:4, padding:2, cursor:'pointer'}} onClick={() => deleteSlot(slot.id, selectedStudent)}><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                    {daySlots.length === 0 && <div className="schedule-empty">Free</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All slots list */}
          <div className="card mt-16">
            <h3 className="section-title">All Slots for {student?.name}</h3>
            {slots.length === 0 ? (
              <div className="empty-state"><Clock size={32}/><p>No slots yet</p></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Day</th><th>Time</th><th>Subjects</th><th>Type</th><th></th></tr></thead>
                  <tbody>
                    {slots.map(s => (
                      <tr key={s.id}>
                        <td>{s.day}</td>
                        <td>{formatTime12h(s.startTime)} – {formatTime12h(s.endTime)}</td>
                        <td>{s.subjects?.join(', ')}</td>
                        <td><span className={`badge ${s.type === 'tuition' ? 'badge-blue' : 'badge-orange'}`}>{s.type === 'tuition' ? 'My Slot' : 'Other Tuition'}</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="icon-btn" onClick={() => openEditModal(s, selectedStudent)} title="Edit"><Pencil size={15}/></button>
                            <button className="icon-btn danger" onClick={() => deleteSlot(s.id, selectedStudent)} title="Delete"><Trash2 size={15}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      </>
      )}

      {/* Add Slot Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSlotId ? 'Edit Schedule Slot' : 'Add Schedule Slot'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Select Student *</label>
                  {modalStudentId ? (
                    <div className="fw-600" style={{ fontSize: 15, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      {students.find(s => s.id === modalStudentId)?.name || '—'} 
                      <span style={{color: 'var(--text-muted)', fontSize: 13, marginLeft: 8}}>
                        (Class {students.find(s => s.id === modalStudentId)?.class || '—'})
                      </span>
                    </div>
                  ) : (
                    <select value={modalStudentId} onChange={e => setModalStudentId(e.target.value)} disabled={!!editingSlotId} required>
                      <option value="">— Choose a student —</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label>Day</label>
                  <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value as DayOfWeek }))}>
                    {DAYS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'tuition'|'other_tuition' }))}>
                    <option value="tuition">My Teaching Slot</option>
                    <option value="other_tuition">Student's Other Tuition</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Subjects</label>
                <MultiSelect 
                  options={masterSubjects}
                  selected={subjects}
                  onChange={setSubjects}
                  placeholder="Select subjects"
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingSlotId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingSlotId ? 'Update Slot' : 'Add Slot')}
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
