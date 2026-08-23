import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import MultiSelect from '../common/MultiSelect';
import type { Student, DayOfWeek, SlotType } from '../../types';
import { X, CalendarCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface AddScheduleSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AddScheduleSlotModal({ isOpen, onClose, onSuccess, students }: AddScheduleSlotModalProps) {
  const { masterSubjects } = useSubjects();
  const [filterClass, setFilterClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [day, setDay] = useState<DayOfWeek>('Monday');
  const [type, setType] = useState<SlotType>('tuition');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:00');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => s.active !== false && (!filterClass || s.class === filterClass));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }
    if (!startTime || !endTime) {
      toast.error('Start and end times are required');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'schedule', selectedStudentId, 'slots'), {
        studentId: selectedStudentId,
        day,
        type,
        startTime,
        endTime,
        subjects,
        notes: notes.trim(),
      });

      toast.success('Schedule slot added successfully!');
      setSubjects([]);
      setNotes('');
      setSelectedStudentId('');
      setFilterClass('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add slot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarCheck size={20} color="var(--navy)" />
            <h2>Add Schedule Slot</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Filter by Class</label>
              <select 
                value={filterClass} 
                onChange={e => {
                  setFilterClass(e.target.value);
                  if (selectedStudentId) {
                    const st = students.find(s => s.id === selectedStudentId);
                    if (st && e.target.value && st.class !== e.target.value) {
                      setSelectedStudentId('');
                    }
                  }
                }}
              >
                <option value="">All Classes</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Student *</label>
              <select 
                value={selectedStudentId} 
                onChange={e => {
                  setSelectedStudentId(e.target.value);
                  const st = students.find(s => s.id === e.target.value);
                  if (st && !filterClass) setFilterClass(st.class);
                }} 
                required
              >
                <option value="">Select student</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Day of Week *</label>
            <select value={day} onChange={e => setDay(e.target.value as DayOfWeek)}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Slot Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: type === 'tuition' ? 'var(--primary-light, #e0f2fe)' : 'var(--bg)', borderRadius: 8, border: type === 'tuition' ? '1.5px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="slotTypeDash" 
                  value="tuition" 
                  checked={type === 'tuition'} 
                  onChange={() => setType('tuition')} 
                />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Teaching Slot</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: type === 'other_tuition' ? 'var(--primary-light, #e0f2fe)' : 'var(--bg)', borderRadius: 8, border: type === 'other_tuition' ? '1.5px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="slotTypeDash" 
                  value="other_tuition" 
                  checked={type === 'other_tuition'} 
                  onChange={() => setType('other_tuition')} 
                />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Other Tuition</span>
              </label>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Start Time *</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>End Time *</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
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
            <label>Notes (Optional)</label>
            <input type="text" placeholder="e.g. Room 2, Offline Batch" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Adding...' : 'Add Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
