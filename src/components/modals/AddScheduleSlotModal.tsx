import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import MultiSelect from '../common/MultiSelect';
import type { Student, DayOfWeek, SlotType } from '../../types';
import { X, CalendarCheck, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface SlotFormItem {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  subjects: string[];
  type: SlotType;
  notes: string;
}

const DEFAULT_FORM: SlotFormItem = {
  day: 'Monday',
  startTime: '16:00',
  endTime: '17:00',
  subjects: [],
  type: 'tuition',
  notes: ''
};

interface AddScheduleSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AddScheduleSlotModal({ isOpen, onClose, onSuccess, students }: AddScheduleSlotModalProps) {
  const { masterSubjects } = useSubjects();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [forms, setForms] = useState<SlotFormItem[]>([{ ...DEFAULT_FORM }]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }
    for (const f of forms) {
      if (!f.startTime || !f.endTime) {
        toast.error('Start and end times are required');
        return;
      }
    }

    setSaving(true);
    try {
      await Promise.all(forms.map(form => 
        addDoc(collection(db, 'schedule', selectedStudentId, 'slots'), {
          studentId: selectedStudentId,
          ...form
        })
      ));

      toast.success('Schedule slot(s) added successfully!');
      setForms([{ ...DEFAULT_FORM }]);
      setSelectedStudentId('');
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
      <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarCheck size={20} color="var(--navy)" />
            <h2>Add Schedule Slot</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-group">
            <label>Student *</label>
            <select 
              value={selectedStudentId} 
              onChange={e => setSelectedStudentId(e.target.value)} 
              required
            >
              <option value="">Select a student...</option>
              {students.filter(s => s.active !== false).map(s => (
                <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
              ))}
            </select>
          </div>

          {forms.map((form, index) => (
            <div key={index} style={{ background: 'var(--surface-2, #f8fafc)', padding: '16px', borderRadius: '8px', marginBottom: '16px', position: 'relative', border: '1px solid var(--border-light)' }}>
              {forms.length > 1 && (
                <button 
                  type="button" 
                  className="icon-btn danger" 
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--bg)' }}
                  onClick={() => setForms(prev => prev.filter((_, i) => i !== index))}
                  title="Remove Slot"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Day</label>
                  <select value={form.day} onChange={e => setForms(prev => { const n = [...prev]; n[index] = { ...n[index], day: e.target.value as DayOfWeek }; return n; })}>
                    {DAYS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 500, padding: '12px 16px', background: form.type === 'tuition' ? 'var(--primary-light, #e0f2fe)' : 'var(--bg)', borderRadius: '8px', border: form.type === 'tuition' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                      <input type="radio" name={`slotTypeDash-${index}`} value="tuition" checked={form.type === 'tuition'} onChange={() => setForms(prev => { const n = [...prev]; n[index] = { ...n[index], type: 'tuition' }; return n; })} style={{ width: 'auto', margin: 0 }} />
                      <span style={{ color: form.type === 'tuition' ? 'var(--primary-dark, #0369a1)' : 'var(--text)' }}>My Teaching Slot</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 500, padding: '12px 16px', background: form.type === 'other_tuition' ? 'var(--primary-light, #e0f2fe)' : 'var(--bg)', borderRadius: '8px', border: form.type === 'other_tuition' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                      <input type="radio" name={`slotTypeDash-${index}`} value="other_tuition" checked={form.type === 'other_tuition'} onChange={() => setForms(prev => { const n = [...prev]; n[index] = { ...n[index], type: 'other_tuition' }; return n; })} style={{ width: 'auto', margin: 0 }} />
                      <span style={{ color: form.type === 'other_tuition' ? 'var(--primary-dark, #0369a1)' : 'var(--text)' }}>Student's Other Tuition</span>
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" value={form.startTime} onChange={e => setForms(prev => { const n = [...prev]; n[index] = { ...n[index], startTime: e.target.value }; return n; })} />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" value={form.endTime} onChange={e => setForms(prev => { const n = [...prev]; n[index] = { ...n[index], endTime: e.target.value }; return n; })} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Subjects</label>
                <MultiSelect 
                  options={masterSubjects}
                  selected={form.subjects}
                  onChange={val => setForms(prev => { const n = [...prev]; n[index] = { ...n[index], subjects: val }; return n; })}
                  placeholder="Select subjects"
                  showSelectAll
                />
              </div>
              <div className="form-group" style={{ marginTop: '16px', marginBottom: 0 }}>
                <label>Notes</label>
                <input type="text" placeholder="Optional notes" value={form.notes} onChange={e => setForms(prev => { const n = [...prev]; n[index] = { ...n[index], notes: e.target.value }; return n; })} />
              </div>
            </div>
          ))}

          <button 
            type="button" 
            className="btn-ghost" 
            style={{ width: '100%', marginBottom: '16px', border: '1px dashed var(--border)' }}
            onClick={() => setForms(prev => [...prev, DEFAULT_FORM])}
          >
            <Plus size={16} style={{ marginRight: '8px' }}/> Add Another Slot
          </button>

          <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : `Save ${forms.length > 1 ? forms.length + ' Slots' : 'Slot'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
