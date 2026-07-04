import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, collectionGroup, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, ScheduleSlot, DayOfWeek } from '../../types';
import { Plus, X, Clock, Trash2, Pencil, Settings2, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import MultiSelect from '../../components/common/MultiSelect';
import { useConfirm } from '../../hooks/useConfirm';
import { getCurrentSession } from '../../utils/dateUtils';

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

type TimeBlock = { start: string, end: string };
type OperatingHours = Record<string, TimeBlock[]>;

const DEFAULT_OPERATING_HOURS: OperatingHours = {
  Monday: [{ start: '15:30', end: '21:30' }],
  Tuesday: [{ start: '15:30', end: '21:30' }],
  Wednesday: [{ start: '15:30', end: '21:30' }],
  Thursday: [{ start: '15:30', end: '21:30' }],
  Friday: [{ start: '15:30', end: '21:30' }],
  Saturday: [{ start: '08:30', end: '13:30' }, { start: '15:00', end: '21:30' }],
  Sunday: [{ start: '08:30', end: '13:30' }],
};

const timeToMins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minsToTime = (m: number) => {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export default function Schedule() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [modalStudentId, setModalStudentId] = useState('');
  const [isStudentLocked, setIsStudentLocked] = useState(false);
  const [viewMode, setViewMode] = useState<'master' | 'student' | 'free_slots'>('master');
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS);
  const [hideEmptyDays, setHideEmptyDays] = useState(true);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [allSlots, setAllSlots] = useState<ScheduleSlot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  
  // Operating Hours State
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(DEFAULT_OPERATING_HOURS);
  const [showOpsModal, setShowOpsModal] = useState(false);
  const [opsForm, setOpsForm] = useState<OperatingHours>(DEFAULT_OPERATING_HOURS);

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

  // Accordion for free slots
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student).filter(s => s.active !== false));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
    import('firebase/firestore').then(({ getDoc }) => {
      getDoc(doc(db, 'settings', 'operatingHours')).then(snap => {
        if (snap.exists()) {
          setOperatingHours(snap.data() as OperatingHours);
          setOpsForm(snap.data() as OperatingHours);
        }
      });
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
    data.sort((a, b) => {
      const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
    setSlots(data);
  };

  useEffect(() => {
    if (selectedStudent) loadSlots(selectedStudent);
    else setSlots([]);
  }, [selectedStudent, students]);

  const openEditModal = (s: ScheduleSlot, studentId: string) => {
    setEditingSlotId(s.id);
    setModalStudentId(studentId);
    setIsStudentLocked(true);
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
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'schedules', modalStudentId, 'slots', editingSlotId), payload);
        toast.success('Slot updated!');
      } else {
        await addDoc(collection(db,'schedules',modalStudentId,'slots'), payload);
        toast.success('Slot added!');
      }
      closeModal();
      loadAllSlots();
      if (selectedStudent === modalStudentId) loadSlots(modalStudentId);
    } catch(err: any) {
      toast.error(err.message);
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

  const handleSaveOps = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'operatingHours'), opsForm);
      setOperatingHours(opsForm);
      toast.success('Operating hours updated!');
      setShowOpsModal(false);
    } catch (e) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };
  
  // Grouped data for Overview
  const groupedMaster = DAYS.reduce((acc, day) => {
    const daySlots = allSlots.filter(s => s.day === day && s.type === 'tuition');
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

  // Grouped data for Free Slots View
  const computeFreeSlots = () => {
    const sessionStudents = students.filter(s => (s.session || getCurrentSession()) === getCurrentSession());
    const classes = Array.from(new Set(sessionStudents.map(s => s.class))).filter(Boolean).sort((a,b) => parseInt(a) - parseInt(b));
    
    const freeSlotsByClass = classes.map(cls => {
      const classStudents = sessionStudents.filter(s => s.class === cls);
      const studentIds = new Set(classStudents.map(s => s.id));
      
      const freeSlotsPerDay = DAYS.map(day => {
        const busySlots = allSlots.filter(s => s.day === day && s.type === 'other_tuition' && studentIds.has(s.studentId));
        const busyIntervals = busySlots.map(s => [timeToMins(s.startTime), timeToMins(s.endTime)]);
        
        // merge busy intervals
        busyIntervals.sort((a, b) => a[0] - b[0]);
        const mergedBusy: number[][] = [];
        for (const interval of busyIntervals) {
          if (!mergedBusy.length) mergedBusy.push(interval);
          else {
            const last = mergedBusy[mergedBusy.length - 1];
            if (interval[0] <= last[1]) {
              last[1] = Math.max(last[1], interval[1]);
            } else {
              mergedBusy.push(interval);
            }
          }
        }
        
        // subtract from operating hours
        const baseHours = operatingHours[day] || [];
        const freeIntervals: TimeBlock[] = [];
        
        baseHours.forEach(block => {
          if (!block.start || !block.end) return;
          let currentStart = timeToMins(block.start);
          const blockEnd = timeToMins(block.end);
          
          for (const busy of mergedBusy) {
            if (busy[1] <= currentStart) continue;
            if (busy[0] >= blockEnd) break;
            
            if (busy[0] > currentStart) {
              freeIntervals.push({ start: minsToTime(currentStart), end: minsToTime(busy[0]) });
            }
            currentStart = Math.max(currentStart, busy[1]);
          }
          if (currentStart < blockEnd) {
            freeIntervals.push({ start: minsToTime(currentStart), end: minsToTime(blockEnd) });
          }
        });
        
        return { day, freeIntervals };
      });
      
      return { class: cls, studentCount: classStudents.length, days: freeSlotsPerDay };
    });
    
    return freeSlotsByClass;
  };
  
  const freeSlotsData = viewMode === 'free_slots' ? computeFreeSlots() : [];

  const student = students.find(s => s.id === selectedStudent);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Schedule</h1>
          <p className="page-sub">Manage teaching slots per student</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" onClick={() => setShowOpsModal(true)}>
            <Settings2 size={18} /> Configure Hours
          </button>
          <button className="btn-primary" onClick={() => { 
            const isStudentView = viewMode === 'student' && !!selectedStudent;
            setModalStudentId(isStudentView ? selectedStudent : '');
            setIsStudentLocked(isStudentView);
            setEditingSlotId(null); 
            setForm({ day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' }); 
            setSubjects([]); 
            setShowModal(true); 
          }}>
            <Plus size={18} /> Add Slot
          </button>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${viewMode === 'master' ? 'active' : ''}`} onClick={() => setViewMode('master')}>
            Overview
          </button>
          <button className={`tab-btn ${viewMode === 'free_slots' ? 'active' : ''}`} onClick={() => setViewMode('free_slots')}>
            Free Slots
          </button>
          <button className={`tab-btn ${viewMode === 'student' ? 'active' : ''}`} onClick={() => setViewMode('student')}>
            Student View
          </button>
        </div>
        
        {viewMode === 'master' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              <input 
                type="checkbox" 
                checked={hideEmptyDays} 
                onChange={e => setHideEmptyDays(e.target.checked)} 
                style={{ cursor: 'pointer' }}
              />
              Hide Empty Days
            </label>
            <div style={{ width: '220px' }}>
              <MultiSelect 
                options={DAYS} 
                selected={selectedDays} 
                onChange={setSelectedDays} 
                placeholder="All Days"
                showSelectAll
              />
            </div>
          </div>
        )}
      </div>

      {viewMode === 'master' && (
        <div className="card mt-16" style={{ overflowX: 'auto', background: 'var(--surface)' }}>
          
          <div style={{ display: 'flex', gap: '16px', padding: '8px', width: 'fit-content' }}>
            {(selectedDays.length === 0 ? DAYS : DAYS.filter(d => selectedDays.includes(d)))
              .filter(d => !hideEmptyDays || groupedMaster[d].length > 0)
              .map(day => (
              <div key={day} style={{ width: '170px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', borderTop: '4px solid var(--primary)', fontWeight: 700, textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                  {day}
                </div>
                
                {groupedMaster[day].length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    No slots
                    <button className="btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--primary)' }} onClick={() => {
                      setEditingSlotId(null);
                      setModalStudentId('');
                      setIsStudentLocked(false);
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
                          setIsStudentLocked(false);
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

      {viewMode === 'free_slots' && (
        <div className="mt-16 accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {freeSlotsData.length === 0 ? (
             <div className="card empty-state"><Clock size={48}/><p>No active students in the current session.</p></div>
          ) : (
            freeSlotsData.map(classData => (
              <div key={classData.class} className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div 
                  className="accordion-header"
                  onClick={() => setExpandedClasses(p => ({ ...p, [classData.class]: !p[classData.class] }))}
                  style={{ padding: '16px', background: expandedClasses[classData.class] ? 'var(--bg)' : 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Class {classData.class}
                    <span className="badge badge-gray ml-auto" style={{ marginLeft: 8 }}>
                      {classData.studentCount} students
                    </span>
                  </div>
                  {expandedClasses[classData.class] ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
                </div>
                
                {expandedClasses[classData.class] && (
                  <div className="accordion-body" style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {classData.days.map(dayData => (
                      <div key={dayData.day} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border-light)' }}>
                        <div className="fw-700" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>{dayData.day}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(!operatingHours[dayData.day] || operatingHours[dayData.day].length === 0) ? (
                             <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No hours set.</div>
                          ) : dayData.freeIntervals.length === 0 ? (
                             <div style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>No common free time.</div>
                          ) : (
                            dayData.freeIntervals.map((interval, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', background: 'var(--success-light)', color: 'var(--success-dark)', padding: '6px 10px', borderRadius: '6px', fontWeight: 600 }}>
                                <Clock size={14} />
                                {formatTime12h(interval.start)} – {formatTime12h(interval.end)}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
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
                        <div className="slot-actions">
                          <button className="slot-action-btn" title="Edit" onClick={() => openEditModal(slot, selectedStudent)}><Pencil size={14}/></button>
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
                  {isStudentLocked ? (
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
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                      <input type="radio" name="slotType" value="tuition" checked={form.type === 'tuition'} onChange={() => setForm(f => ({ ...f, type: 'tuition' }))} />
                      My Teaching Slot
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                      <input type="radio" name="slotType" value="other_tuition" checked={form.type === 'other_tuition'} onChange={() => setForm(f => ({ ...f, type: 'other_tuition' }))} />
                      Student&apos;s Other Tuition
                    </label>
                  </div>
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
                  showSelectAll
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

      {/* Operating Hours Modal */}
      {showOpsModal && (
        <div className="modal-overlay" onClick={() => setShowOpsModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configure Operating Hours</h2>
              <button className="modal-close" onClick={() => setShowOpsModal(false)}><X size={20}/></button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="modal-body">
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                Define your general working hours for each day. These hours are used to calculate the available free slots for your classes.
              </p>
              {DAYS.map(day => (
                <div key={day} style={{ marginBottom: '16px', background: 'var(--surface-2)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="fw-600">{day}</span>
                    <button className="btn-ghost btn-sm" onClick={() => {
                      setOpsForm(p => ({
                        ...p,
                        [day]: [...(p[day] || []), { start: '16:00', end: '18:00' }]
                      }));
                    }}>
                      <Plus size={14} /> Add Block
                    </button>
                  </div>
                  {(!opsForm[day] || opsForm[day].length === 0) ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No hours set.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {opsForm[day].map((block, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="time" className="input" style={{ flex: 1 }} value={block.start} onChange={e => {
                            const newForm = { ...opsForm };
                            newForm[day][i].start = e.target.value;
                            setOpsForm(newForm);
                          }} />
                          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>to</span>
                          <input type="time" className="input" style={{ flex: 1 }} value={block.end} onChange={e => {
                            const newForm = { ...opsForm };
                            newForm[day][i].end = e.target.value;
                            setOpsForm(newForm);
                          }} />
                          <button className="icon-btn danger" type="button" style={{ marginLeft: 'auto' }} onClick={() => {
                            const newForm = { ...opsForm };
                            newForm[day].splice(i, 1);
                            setOpsForm(newForm);
                          }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowOpsModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveOps} disabled={saving}>
                {saving ? <span className="btn-spinner"/> : <Settings2 size={16}/>}
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
