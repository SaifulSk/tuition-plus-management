import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import MultiSelectObj from '../common/MultiSelectObj';
import type { Student } from '../../types';
import { X, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

interface LogTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function LogTestModal({ isOpen, onClose, onSuccess, students }: LogTestModalProps) {
  const { masterSubjects } = useSubjects();
  const [filterClass, setFilterClass] = useState('');
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    maxMarks: '',
    marks: {} as Record<string, string>,
  });
  const [subject, setSubject] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => s.active !== false && (!filterClass || s.class === filterClass));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !subject || !form.maxMarks || !form.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (selectedStudentIds.length === 0) {
      toast.error('Select at least one student');
      return;
    }

    const studentMarks: Record<string, number> = {};
    selectedStudentIds.forEach(id => {
      if (form.marks[id] !== '' && form.marks[id] !== undefined) {
        studentMarks[id] = Number(form.marks[id]);
      }
    });

    setSaving(true);
    try {
      await addDoc(collection(db, 'tests'), {
        title: form.title.trim(),
        subjects: [subject],
        date: Timestamp.fromDate(new Date(form.date)),
        maxMarks: Number(form.maxMarks),
        studentMarks,
      });

      toast.success('Test logged!');
      setForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        maxMarks: '',
        marks: {},
      });
      setSubject('');
      setSelectedStudentIds([]);
      setFilterClass('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} color="var(--navy)" />
            <h2>Log Test</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Test Title *</label>
              <input 
                type="text" 
                placeholder="e.g. Chapter 3 Test" 
                value={form.title} 
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Subject *</label>
              <select 
                value={subject} 
                onChange={e => setSubject(e.target.value)} 
                required
              >
                <option value="" disabled>Select subject</option>
                {masterSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input 
                type="date" 
                value={form.date} 
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Max Marks *</label>
              <input 
                type="number" 
                placeholder="e.g. 50" 
                value={form.maxMarks} 
                onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))} 
                required 
              />
            </div>
          </div>

          <h3 className="section-title mt-8">Student Marks</h3>

          <div className="form-grid-2 mb-16">
            <div className="form-group">
              <label>Filter by Class</label>
              <select 
                value={filterClass} 
                onChange={e => {
                  setFilterClass(e.target.value);
                  if (e.target.value) {
                    const validIds = new Set(students.filter(s => s.active !== false && s.class === e.target.value).map(s => s.id));
                    setSelectedStudentIds(prev => prev.filter(id => validIds.has(id)));
                  }
                }}
              >
                <option value="">All Classes</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Select Students *</label>
              <MultiSelectObj
                options={filteredStudents.map(s => ({ value: s.id, label: `${s.name} (Class ${s.class})` }))}
                selected={selectedStudentIds}
                onChange={setSelectedStudentIds}
                placeholder="Select students to mark"
              />
            </div>
          </div>

          {selectedStudentIds.length > 0 && (
            <div className="form-grid-2">
              {students.filter(s => selectedStudentIds.includes(s.id)).map(s => (
                <div key={s.id} className="form-group">
                  <label>{s.name} <span className="text-muted">(Class {s.class})</span></label>
                  <input
                    type="number"
                    placeholder={`Out of ${form.maxMarks || '?'}`}
                    min={0}
                    max={Number(form.maxMarks) || undefined}
                    value={form.marks[s.id] || ''}
                    onChange={e => setForm(f => ({ ...f, marks: { ...f.marks, [s.id]: e.target.value } }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
