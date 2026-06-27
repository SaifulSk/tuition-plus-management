import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, CenterEvent, EventType } from '../../types';
import { Plus, X, PartyPopper, Trash2, Calendar, Users, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
  { value: 'picnic', label: 'Picnic', emoji: '🧺' },
  { value: 'farewell', label: 'Farewell', emoji: '🎓' },
  { value: 'feast', label: 'Feast', emoji: '🍽️' },
  { value: 'study_trip', label: 'Study Trip', emoji: '🗺️' },
  { value: 'other', label: 'Other', emoji: '🎉' },
];

const TYPE_EMOJI: Record<EventType, string> = {
  picnic:'🧺', farewell:'🎓', feast:'🍽️', study_trip:'🗺️', other:'🎉'
};

export default function Events() {
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<CenterEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', type: 'other' as EventType,
    date: new Date().toISOString().split('T')[0],
    description: '', attendees: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student));
    });
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const snap = await getDocs(query(collection(db,'events'), orderBy('date','desc')));
    setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CenterEvent));
  };

  const toggleAttendee = (id: string) => {
    setForm(f => ({
      ...f,
      attendees: f.attendees.includes(id) ? f.attendees.filter(a => a !== id) : [...f.attendees, id]
    }));
  };

  const openEditModal = (ev: CenterEvent) => {
    setEditingEventId(ev.id);
    setForm({
      title: ev.title || '',
      type: ev.type || 'other',
      date: ev.date ? new Date(ev.date.toDate().getTime() - ev.date.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: ev.description || '',
      attendees: ev.attendees || [],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEventId(null);
    setForm({ title:'', type:'other', date: new Date().toISOString().split('T')[0], description:'', attendees:[] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Enter event title'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: Timestamp.fromDate(new Date(form.date)),
      };
      if (editingEventId) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
           updateDoc(doc(db, 'events', editingEventId), payload);
        });
        toast.success('Event updated!');
      } else {
        await addDoc(collection(db,'events'), { ...payload, photoUrls: [] });
        toast.success('Event created!');
      }
      closeModal();
      loadEvents();
    } finally { setSaving(false); }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await deleteDoc(doc(db,'events',id));
    loadEvents();
    toast.success('Event deleted');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-sub">Manage picnics, farewells, feasts & more</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingEventId(null); setForm({ title:'', type:'other', date: new Date().toISOString().split('T')[0], description:'', attendees:[] }); setShowModal(true); }}>
          <Plus size={18}/> Create Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="empty-state"><PartyPopper size={48}/><p>No events yet. Create one!</p></div>
      ) : (
        <div className="events-grid">
          {events.map(ev => {
            const attendingStudents = students.filter(s => ev.attendees?.includes(s.id));
            return (
              <div key={ev.id} className="event-card">
                <div className="event-card-header">
                  <div className="event-emoji">{TYPE_EMOJI[ev.type] || '🎉'}</div>
                  <div className="event-type-label">{ev.type.replace('_',' ')}</div>
                  <div className="action-btns ml-auto">
                    <button className="icon-btn" onClick={() => openEditModal(ev)} title="Edit">
                      <Pencil size={15}/>
                    </button>
                    <button className="icon-btn danger" onClick={() => deleteEvent(ev.id)} title="Delete">
                      <Trash2 size={15}/>
                    </button>
                  </div>
                </div>
                <div className="event-card-body">
                  <h3 className="event-name">{ev.title}</h3>
                  <div className="event-meta">
                    <span><Calendar size={14}/> {ev.date ? format(ev.date.toDate(),'dd MMM yyyy') : '—'}</span>
                    <span><Users size={14}/> {ev.attendees?.length || 0} students</span>
                  </div>
                  {ev.description && <p className="event-desc">{ev.description}</p>}
                  {attendingStudents.length > 0 && (
                    <div className="event-attendees">
                      {attendingStudents.slice(0,5).map(s => (
                        <div key={s.id} className="attendee-avatar" title={s.name}>{s.name.charAt(0)}</div>
                      ))}
                      {attendingStudents.length > 5 && (
                        <div className="attendee-avatar more">+{attendingStudents.length-5}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEventId ? 'Edit Event' : 'Create Event'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Event Title *</label>
                  <input type="text" placeholder="e.g. Annual Picnic 2026" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Event Type</label>
                  <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value as EventType}))}>
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea placeholder="Event details…" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={3} />
              </div>
              <div className="form-group">
                <label>Attendees (click to select)</label>
                <div className="attendee-selector">
                  {students.map(s => (
                    <div
                      key={s.id}
                      className={`attendee-chip ${form.attendees.includes(s.id) ? 'selected' : ''}`}
                      onClick={() => toggleAttendee(s.id)}
                    >
                      <span className="attendee-init">{s.name.charAt(0)}</span>
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingEventId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingEventId ? 'Update Event' : 'Create Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
