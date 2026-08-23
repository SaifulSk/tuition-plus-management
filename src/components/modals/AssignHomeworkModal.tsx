import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import type { Student, Homework } from '../../types';
import { X, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

interface AssignHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AssignHomeworkModal({ isOpen, onClose, onSuccess, students }: AssignHomeworkModalProps) {
  const { masterSubjects: subjects, formatSubjects } = useSubjects();
  const [schools, setSchools] = useState<string[]>([]);
  const [assignType, setAssignType] = useState<'class' | 'student'>('class');
  const [studentFilterClass, setStudentFilterClass] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: '',
    targetClass: '',
    targetSchool: '',
    targetStudentId: '',
    dueDate: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getDocs(query(collection(db, 'schools'), orderBy('name'))).then(snap => {
        const schNames = snap.docs.map(d => d.data().name as string).filter(Boolean);
        const allSchools = [...new Set([...schNames, ...students.map(s => s.school).filter(Boolean)])].sort();
        setSchools(allSchools);
      }).catch(console.error);
    }
  }, [isOpen, students]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.subject) {
      toast.error('Fill required fields');
      return;
    }
    if (assignType === 'class' && !form.targetClass) {
      toast.error('Please select a target class');
      return;
    }
    if (assignType === 'student' && !form.targetStudentId) {
      toast.error('Please select a target student');
      return;
    }

    setSaving(true);
    try {
      const targetStudent = assignType === 'student' ? students.find(s => s.id === form.targetStudentId) : null;
      const payload: Partial<Homework> = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject,
        targetType: assignType,
        targetClass: assignType === 'student' ? (targetStudent?.class || form.targetClass) : form.targetClass,
        targetSchool: assignType === 'class' ? (form.targetSchool || '') : (targetStudent?.school || ''),
        targetStudentId: assignType === 'student' ? form.targetStudentId : '',
        targetStudentName: assignType === 'student' ? (targetStudent?.name || '') : '',
        dueDate: Timestamp.fromDate(new Date(form.dueDate)),
        assignedDate: Timestamp.now(),
        completedBy: [],
      };

      await addDoc(collection(db, 'homework'), payload);
      toast.success('Homework assigned successfully!');
      
      setForm({
        title: '',
        description: '',
        subject: '',
        targetClass: '',
        targetSchool: '',
        targetStudentId: '',
        dueDate: new Date().toISOString().split('T')[0],
      });
      setStudentFilterClass('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign homework');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={20} color="var(--navy)" />
            <h2>Assign Homework</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-group mb-16">
            <label>Title *</label>
            <input 
              type="text" 
              className="input" 
              placeholder="e.g. Chapter 3 Exercise 3.2 Q1-Q10" 
              value={form.title} 
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
              required 
            />
          </div>

          <div className="form-group mb-16">
            <label>Description</label>
            <textarea 
              className="input" 
              rows={3} 
              placeholder="Optional details, page numbers, instructions..." 
              value={form.description} 
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Subject *</label>
              <select 
                className="input" 
                value={form.subject} 
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} 
                required
              >
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s} value={s}>{formatSubjects([s])}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Due Date *</label>
              <input 
                type="date" 
                className="input" 
                value={form.dueDate} 
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} 
                required 
              />
            </div>
          </div>

          <div className="form-group mt-16 mb-16">
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Assign To *</label>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="radio" 
                  name="assignTypeDash" 
                  value="class" 
                  checked={assignType === 'class'} 
                  onChange={() => setAssignType('class')} 
                />
                Class
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="radio" 
                  name="assignTypeDash" 
                  value="student" 
                  checked={assignType === 'student'} 
                  onChange={() => setAssignType('student')} 
                />
                Student
              </label>
            </div>
          </div>

          {assignType === 'class' ? (
            <div className="form-grid-2 mb-16">
              <div className="form-group">
                <label>School</label>
                <select 
                  className="input" 
                  value={form.targetSchool} 
                  onChange={e => setForm(f => ({ ...f, targetSchool: e.target.value }))}
                >
                  <option value="">All Schools</option>
                  {schools.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Target Class *</label>
                <select 
                  className="input" 
                  value={form.targetClass} 
                  onChange={e => setForm(f => ({ ...f, targetClass: e.target.value }))} 
                  required
                >
                  <option value="">Select class</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="form-grid-2 mb-16">
              <div className="form-group">
                <label>Filter by Class</label>
                <select 
                  className="input" 
                  value={studentFilterClass} 
                  onChange={e => {
                    const newClass = e.target.value;
                    setStudentFilterClass(newClass);
                    if (newClass && form.targetStudentId) {
                      const currentSt = students.find(s => s.id === form.targetStudentId);
                      if (currentSt && currentSt.class !== newClass) {
                        setForm(f => ({ ...f, targetStudentId: '', targetClass: newClass }));
                      }
                    }
                  }}
                >
                  <option value="">All Classes</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Target Student *</label>
                <select 
                  className="input" 
                  value={form.targetStudentId} 
                  onChange={e => {
                    const sId = e.target.value;
                    const st = students.find(s => s.id === sId);
                    setForm(f => ({ 
                      ...f, 
                      targetStudentId: sId, 
                      targetClass: st?.class || '' 
                    }));
                    if (st && !studentFilterClass) {
                      setStudentFilterClass(st.class);
                    }
                  }} 
                  required
                >
                  <option value="">Select student</option>
                  {students
                    .filter(s => s.active !== false && (!studentFilterClass || s.class === studentFilterClass))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Assigning...' : 'Assign Homework'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
