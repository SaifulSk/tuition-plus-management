import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import MultiSelect from '../common/MultiSelect';
import type { Student, SyllabusStatus } from '../../types';
import { X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_OPTIONS: { value: SyllabusStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
];

interface AddSyllabusTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function AddSyllabusTopicModal({ isOpen, onClose, onSuccess, students }: AddSyllabusTopicModalProps) {
  const { masterSubjects } = useSubjects();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [status, setStatus] = useState<SyllabusStatus>('not_started');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !topic.trim() || subjects.length === 0) {
      toast.error('Student, Topic, and Subjects are required');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        studentId: selectedStudentId,
        chapter: chapter.trim(),
        topic: topic.trim(),
        subjects,
        status,
        completedDate: status === 'completed' ? Timestamp.now() : null,
      };

      await addDoc(collection(db, 'syllabus', selectedStudentId, 'topics'), payload);
      toast.success('Syllabus topic added!');

      setChapter('');
      setTopic('');
      setSubjects([]);
      setStatus('not_started');
      setSelectedStudentId('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add topic');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={20} color="var(--navy)" />
            <h2>Add Topic</h2>
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
              <option value="">— Select a student —</option>
              {students.filter(s => s.active !== false).map(st => (
                <option key={st.id} value={st.id}>{st.name} (Class {st.class})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Subjects *</label>
            <MultiSelect
              options={masterSubjects}
              selected={subjects}
              onChange={setSubjects}
              placeholder="Select subjects"
              required
              showSelectAll
            />
          </div>

          <div className="form-group">
            <label>Chapter</label>
            <input type="text" placeholder="e.g. Chapter 3" value={chapter} onChange={e => setChapter(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Topic *</label>
            <input type="text" placeholder="e.g. Quadratic Equations" value={topic} onChange={e => setTopic(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as SyllabusStatus)}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Adding...' : 'Add Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
