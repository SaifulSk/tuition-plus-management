import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, ScheduleSlot, DayOfWeek } from '../../types';
import { Plus, X, Clock, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import MultiSelect from '../../components/common/MultiSelect';

const DAYS: DayOfWeek[] = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const COLOR_MAP = {
  tuition: 'slot-tuition',
  other_tuition: 'slot-other',
};

export default function Schedule() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
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

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
  }, []);

  const loadSlots = async (studentId: string) => {
    const snap = await getDocs(collection(db,'schedules',studentId,'slots'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ScheduleSlot);
    setSlots(data);
    // Also load all slots for conflict detection
    const allDocs: ScheduleSlot[] = [];
    for (const s of students) {
      const sSnap = await getDocs(collection(db,'schedules',s.id,'slots'));
      sSnap.docs.forEach(d => allDocs.push({ id: d.id, ...d.data() } as ScheduleSlot));
    }
    setAllSlots(allDocs);
  };

  useEffect(() => {
    if (selectedStudent) loadSlots(selectedStudent);
    else setSlots([]);
  }, [selectedStudent, students]);

  const openEditModal = (s: ScheduleSlot) => {
    setEditingSlotId(s.id);
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
    setForm({ day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' });
    setSubjects([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || subjects.length === 0) { toast.error('Fill all fields'); return; }
    setSaving(true);
    try {
      const payload = { ...form, subjects, studentId: selectedStudent };
      if (editingSlotId) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
           updateDoc(doc(db, 'schedules', selectedStudent, 'slots', editingSlotId), payload);
        });
        toast.success('Slot updated!');
      } else {
        await addDoc(collection(db,'schedules',selectedStudent,'slots'), payload);
        toast.success('Slot added!');
      }
      closeModal();
      loadSlots(selectedStudent);
    } finally { setSaving(false); }
  };

  const deleteSlot = async (slotId: string) => {
    if (!window.confirm('Are you sure you want to delete this slot?')) return;
    await deleteDoc(doc(db,'schedules',selectedStudent,'slots',slotId));
    toast.success('Slot removed');
    loadSlots(selectedStudent);
  };

  const student = students.find(s => s.id === selectedStudent);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Schedule</h1>
          <p className="page-sub">Manage teaching slots per student</p>
        </div>
        {selectedStudent && (
          <button className="btn-primary" onClick={() => { setEditingSlotId(null); setForm({ day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' }); setSubjects([]); setShowModal(true); }}>
            <Plus size={18} /> Add Slot
          </button>
        )}
      </div>

      {/* Student selector */}
      <div className="card mb-16">
        <div className="form-group" style={{marginBottom:0}}>
          <label>Select Student</label>
          <select
            id="schedule-student-select"
            value={selectedStudent}
            onChange={e => setSelectedStudent(e.target.value)}
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
              const conflicts = allSlots.filter(s => s.day === day && s.studentId !== selectedStudent);
              return (
                <div key={day} className="schedule-day">
                  <div className="schedule-day-header">{day.slice(0,3)}</div>
                  <div className="schedule-day-body">
                    {daySlots.map(slot => (
                      <div key={slot.id} className={`schedule-slot ${COLOR_MAP[slot.type]}`}>
                        <div className="slot-time">{slot.startTime} – {slot.endTime}</div>
                        <div className="slot-subject">{slot.subjects?.join(', ')}</div>
                        {slot.type === 'other_tuition' && <div className="slot-label">Other Tuition</div>}
                        <div className="slot-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                          <button className="slot-delete" style={{background:'white', color:'var(--text)', border:'none', borderRadius:4, padding:2, cursor:'pointer'}} onClick={() => openEditModal(slot)}><Pencil size={12}/></button>
                          <button className="slot-delete" style={{background:'var(--danger)', color:'white', border:'none', borderRadius:4, padding:2, cursor:'pointer'}} onClick={() => deleteSlot(slot.id)}><Trash2 size={12}/></button>
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
                        <td>{s.startTime} – {s.endTime}</td>
                        <td>{s.subjects?.join(', ')}</td>
                        <td><span className={`badge ${s.type === 'tuition' ? 'badge-blue' : 'badge-orange'}`}>{s.type === 'tuition' ? 'My Slot' : 'Other Tuition'}</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit"><Pencil size={15}/></button>
                            <button className="icon-btn danger" onClick={() => deleteSlot(s.id)} title="Delete"><Trash2 size={15}/></button>
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
                  required
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
    </div>
  );
}
