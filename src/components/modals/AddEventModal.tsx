import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, EventType } from '../../types';
import { X, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_TYPES: EventType[] = ['picnic', 'farewell', 'feast', 'celebration', 'workshop', 'competition', 'other'];

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AddEventModal({ isOpen, onClose, onSuccess, students }: AddEventModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('celebration');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleAttendee = (studentId: string) => {
    setAttendees(prev =>
      prev.includes(studentId) ? prev.filter(x => x !== studentId) : [...prev, studentId]
    );
  };

  const selectAllAttendees = () => {
    if (attendees.length === students.length) {
      setAttendees([]);
    } else {
      setAttendees(students.map(s => s.id));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      toast.error('Title and date are required');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'events'), {
        title: title.trim(),
        type,
        date: Timestamp.fromDate(new Date(date)),
        description: description.trim(),
        attendees,
        photoUrls: [],
      });

      toast.success('Event created successfully!');
      setTitle('');
      setType('celebration');
      setDescription('');
      setAttendees([]);
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
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PartyPopper size={20} color="var(--navy)" />
            <h2>Create New Event</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-group">
            <label>Event Title *</label>
            <input 
              type="text" 
              placeholder="e.g. Annual Picnic 2026, Physics Workshop" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Event Type</label>
              <select value={type} onChange={e => setType(e.target.value as EventType)}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea 
              rows={3} 
              placeholder="Venue, timings, guidelines, requirements..." 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ margin: 0 }}>Attendees ({attendees.length} selected)</label>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ fontSize: 12, padding: '2px 8px', height: 'auto' }} 
                onClick={selectAllAttendees}
              >
                {attendees.length === students.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="attendee-selector">
              {students.map(s => {
                const selected = attendees.includes(s.id);
                return (
                  <div 
                    key={s.id} 
                    className={`attendee-chip ${selected ? 'selected' : ''}`}
                    onClick={() => toggleAttendee(s.id)}
                  >
                    <div className="attendee-init">{s.name.charAt(0)}</div>
                    <span>{s.name} (Cl {s.class})</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
