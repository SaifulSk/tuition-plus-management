import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import type { Student } from '../../types';
import { X, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const EXAM_TYPES = ['Term 1', 'Term 2', 'Unit Test', 'Mid Term', 'Final Exam', 'Pre-Board', 'Other'];

function getCurrentSession() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

const SESSION_OPTIONS = [
  `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
  `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  `${new Date().getFullYear() + 1}-${new Date().getFullYear() + 2}`,
];

interface AddExamResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AddExamResultModal({ isOpen, onClose, onSuccess, students }: AddExamResultModalProps) {
  const { masterSubjects } = useSubjects();
  const [filterClass, setFilterClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [examName, setExamName] = useState(EXAM_TYPES[0]);
  const [subject, setSubject] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [marksObtained, setMarksObtained] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState(getCurrentSession());
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => s.active !== false && (!filterClass || s.class === filterClass));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !examName || !subject || !maxMarks || !marksObtained) {
      toast.error('Please fill in all required fields');
      return;
    }

    const currentStudent = students.find(s => s.id === selectedStudentId);
    if (!currentStudent) return;

    setSaving(true);
    try {
      const payload = {
        studentId: selectedStudentId,
        examName,
        subjects: [subject],
        maxMarks: Number(maxMarks),
        marksObtained: Number(marksObtained),
        date: Timestamp.fromDate(new Date(date)),
        percentage: Math.round((Number(marksObtained) / Number(maxMarks)) * 100),
        session: session || getCurrentSession(),
        className: currentStudent.class,
      };

      await addDoc(collection(db, 'schoolExams', selectedStudentId, 'exams'), payload);
      toast.success('Exam result recorded successfully!');
      
      setExamName(EXAM_TYPES[0]);
      setSubject('');
      setMaxMarks('');
      setMarksObtained('');
      setSelectedStudentId('');
      setFilterClass('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save exam result');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={20} color="var(--navy)" />
            <h2>Add School Exam Result</h2>
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

          <div className="form-grid-2">
            <div className="form-group">
              <label>Exam Type *</label>
              <select value={examName} onChange={e => setExamName(e.target.value)} required>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Academic Session</label>
              <select value={session} onChange={e => setSession(e.target.value)}>
                {SESSION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Subject *</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} required>
                <option value="">Select subject</option>
                {masterSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Exam Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Max Marks *</label>
              <input 
                type="number" 
                placeholder="e.g. 100" 
                value={maxMarks} 
                onChange={e => setMaxMarks(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label>Marks Obtained *</label>
              <input 
                type="number" 
                placeholder="e.g. 85" 
                value={marksObtained} 
                onChange={e => setMarksObtained(e.target.value)} 
                required 
                max={maxMarks || undefined}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
