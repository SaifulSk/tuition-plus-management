import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import MultiSelect from '../common/MultiSelect';
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
  const [subjects, setSubjects] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentMarks, setStudentMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => s.active !== false && (!filterClass || s.class === filterClass));

  const handleMarkChange = (studentId: string, val: string) => {
    setStudentMarks(prev => ({ ...prev, [studentId]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || subjects.length === 0 || !maxMarks || !date) {
      toast.error('Please fill in all required fields');
      return;
    }

    const marksNum: Record<string, number> = {};
    Object.entries(studentMarks).forEach(([sid, m]) => {
      if (m !== '' && m !== undefined) {
        marksNum[sid] = Number(m);
      }
    });

    setSaving(true);
    try {
      await addDoc(collection(db, 'tests'), {
        title: title.trim(),
        subjects,
        date: Timestamp.fromDate(new Date(date)),
        maxMarks: Number(maxMarks),
        studentMarks: marksNum,
      });

      toast.success('Test logged successfully!');
      setTitle('');
      setSubjects([]);
      setMaxMarks('');
      setStudentMarks({});
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
            <h2>Log Tuition Test</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-group">
            <label>Test Title *</label>
            <input 
              type="text" 
              placeholder="e.g. Chapter 4 Assessment, Mid-term Mock" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Subjects *</label>
              <MultiSelect 
                options={masterSubjects} 
                selected={subjects} 
                onChange={setSubjects} 
                placeholder="Select subjects"
                showSelectAll
              />
            </div>

            <div className="form-group">
              <label>Max Marks *</label>
              <input 
                type="number" 
                placeholder="e.g. 50 or 100" 
                value={maxMarks} 
                onChange={e => setMaxMarks(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Test Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Filter Class for Marks Entry</label>
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                <option value="">All Classes</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Enter Student Marks (Optional at creation)</label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
              {filteredStudents.length === 0 ? (
                <p className="text-muted text-sm" style={{ textAlign: 'center', margin: '12px 0' }}>No students in this class.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {filteredStudents.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {s.name} <span className="text-muted text-sm">(Cl {s.class})</span>
                      </div>
                      <input 
                        type="number" 
                        placeholder="Marks" 
                        value={studentMarks[s.id] ?? ''} 
                        onChange={e => handleMarkChange(s.id, e.target.value)}
                        style={{ width: 70, padding: '4px 8px', fontSize: 13 }}
                        max={maxMarks || undefined}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Log Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
