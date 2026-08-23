import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import type { Student } from '../../types';
import { X, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

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

interface AddExamResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AddExamResultModal({ isOpen, onClose, onSuccess, students }: AddExamResultModalProps) {
  const { masterSubjects } = useSubjects();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [availableExamNames, setAvailableExamNames] = useState<string[]>([]);
  const [examName, setExamName] = useState('');
  const [subject, setSubject] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [marksObtained, setMarksObtained] = useState('');
  const [session, setSession] = useState(getCurrentSession());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getDocs(collection(db, 'examNames')).then(snap => {
        const names = snap.docs.map(d => d.data().name as string).filter(Boolean);
        setAvailableExamNames(names.length > 0 ? names : ['Term 1', 'Term 2', 'Unit Test', 'Mid Term', 'Final Exam', 'Pre-Board', 'Other']);
      }).catch(() => {
        setAvailableExamNames(['Term 1', 'Term 2', 'Unit Test', 'Mid Term', 'Final Exam', 'Pre-Board', 'Other']);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sessionOptions = [...new Set([
    ...Array.from({ length: 6 }, (_, i) => {
      const yr = new Date().getFullYear() - 2 + i;
      return `${yr}-${yr + 1}`;
    })
  ])].sort().reverse();

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
        date: Timestamp.now(),
        percentage: Math.round((Number(marksObtained) / Number(maxMarks)) * 100),
        session: session || getCurrentSession(),
        className: currentStudent.class,
      };

      await addDoc(collection(db, 'schoolExams', selectedStudentId, 'exams'), payload);
      toast.success('Exam result recorded successfully!');
      
      setExamName('');
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
          <div className="form-group">
            <label>Student *</label>
            <select 
              value={selectedStudentId} 
              onChange={e => {
                const sid = e.target.value;
                setSelectedStudentId(sid);
                const st = students.find(s => s.id === sid);
                if (st) {
                  setSession(st.session || getCurrentSession());
                }
              }} 
              required
            >
              <option value="">Select a student...</option>
              {students.filter(s => s.active !== false).map(s => (
                <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Exam Name *</label>
              <select value={examName} onChange={e => setExamName(e.target.value)} required>
                <option value="" disabled>Select exam...</option>
                {availableExamNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Subject *</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} required>
                <option value="" disabled>Select subject...</option>
                {masterSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>

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
                placeholder="e.g. 78" 
                value={marksObtained} 
                onChange={e => setMarksObtained(e.target.value)} 
                required 
                max={maxMarks || undefined}
              />
            </div>

            <div className="form-group">
              <label>Academic Session</label>
              <select value={session} onChange={e => setSession(e.target.value)} required>
                {sessionOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
