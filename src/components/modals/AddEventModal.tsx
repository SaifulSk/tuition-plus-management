import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, EventType } from '../../types';
import { X, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
  { value: 'picnic', label: 'Picnic', emoji: '🧺' },
  { value: 'farewell', label: 'Farewell', emoji: '🎓' },
  { value: 'feast', label: 'Feast / Party', emoji: '🍕' },
  { value: 'study_trip', label: 'Study Trip', emoji: '🚌' },
  { value: 'other', label: 'Other', emoji: '🎉' },
];

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AddEventModal({ isOpen, onClose, onSuccess, students }: AddEventModalProps) {
  const [form, setForm] = useState({
    title: '',
    type: 'picnic' as EventType,
    date: new Date().toISOString().split('T')[0],
    description: '',
    attendees: [] as string[]
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleAttendee = (studentId: string) => {
    setForm(f => ({
      ...f,
      attendees: f.attendees.includes(studentId)
        ? f.attendees.filter(x => x !== studentId)
        : [...f.attendees, studentId]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Event title is required');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'events'), {
        title: form.title.trim(),
        type: form.type,
        date: form.date ? Timestamp.fromDate(new Date(form.date)) : Timestamp.now(),
        description: form.description.trim(),
        attendees: form.attendees,
        photoUrls: [],
      });

      toast.success('Event created successfully!');
      setForm({
        title: '',
        type: 'picnic',
        date: new Date().toISOString().split('T')[0],
        description: '',
        attendees: []
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PartyPopper size={20} color="var(--navy)" />
            <h2>Create Event</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Event Title *</label>
              <input 
                type="text" 
                placeholder="e.g. Annual Picnic 2026" 
                value={form.title} 
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Event Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as EventType }))}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea 
              placeholder="Event details…" 
              value={form.description} 
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
              rows={3} 
            />
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
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
