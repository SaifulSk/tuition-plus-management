import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import type { Student } from '../../types';
import { X, ClipboardList, Plus } from 'lucide-react';
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
  const [targetClass, setTargetClass] = useState('');
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

  const classStudents = students.filter(s => s.active !== false && s.class === targetClass);

  const handleClassChange = (newClass: string) => {
    setTargetClass(newClass);
    setSelectedStudentIds([]);
  };

  const handleSelectAll = () => {
    setSelectedStudentIds(classStudents.map(s => s.id));
  };

  const handleClearAll = () => {
    setSelectedStudentIds([]);
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const resetForm = () => {
    setForm({
      title: '',
      date: new Date().toISOString().split('T')[0],
      maxMarks: '',
      marks: {},
    });
    setSubject('');
    setSelectedStudentIds([]);
    setTargetClass('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !subject || !form.maxMarks || !form.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!targetClass) {
      toast.error('Please select a class for the test');
      return;
    }
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student who took the test');
      return;
    }

    // Validate marks for selected students
    for (const sid of selectedStudentIds) {
      const val = form.marks[sid];
      if (val === undefined || val === '' || isNaN(Number(val))) {
        const student = students.find(s => s.id === sid);
        toast.error(`Please enter marks for ${student?.name || 'selected student'}`);
        return;
      }
      const numVal = Number(val);
      if (numVal < 0 || numVal > Number(form.maxMarks)) {
        const student = students.find(s => s.id === sid);
        toast.error(`Marks for ${student?.name || 'student'} must be between 0 and ${form.maxMarks}`);
        return;
      }
    }

    setSaving(true);
    const studentMarks: Record<string, number> = {};
    selectedStudentIds.forEach(id => {
      studentMarks[id] = Number(form.marks[id]);
    });

    try {
      await addDoc(collection(db, 'tests'), {
        title: form.title.trim(),
        subjects: [subject],
        date: Timestamp.fromDate(new Date(form.date)),
        maxMarks: Number(form.maxMarks),
        studentMarks,
        targetClass,
        createdAt: Timestamp.now(),
      });

      toast.success('Test logged!');
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal large" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} color="var(--navy)" />
            <h2>Log Tuition Test</h2>
          </div>
          <button className="modal-close" onClick={handleClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Class *</label>
              <select
                value={targetClass}
                onChange={e => handleClassChange(e.target.value)}
                required
              >
                <option value="" disabled>Select Class</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Test Title *</label>
              <input
                type="text"
                placeholder="e.g. Chapter 3 Assessment"
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
                min={1}
                value={form.maxMarks}
                onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Student Selection & Marks */}
          <div style={{ marginTop: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '8px',
            }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Select Students & Enter Marks *
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                  {targetClass
                    ? `Only selected students will be recorded (${selectedStudentIds.length} of ${classStudents.length} selected)`
                    : 'Please select a Class above first to see enrolled students'}
                </div>
              </div>

              {targetClass && classStudents.length > 0 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleSelectAll}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleClearAll}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {!targetClass ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                background: 'var(--bg)',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}>
                Select a Class from the dropdown above to load enrolled students.
              </div>
            ) : classStudents.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                background: 'var(--bg)',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}>
                No active students enrolled in Class {targetClass}.
              </div>
            ) : (
              <div className="student-select-list">
                {classStudents.map(s => {
                  const isSelected = selectedStudentIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: isSelected ? 'var(--surface)' : 'var(--bg)',
                        border: isSelected ? '1px solid var(--primary, #1E3A5F)' : '1px solid transparent',
                        gap: '10px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        margin: 0,
                        flex: 1,
                        minWidth: 0,
                        userSelect: 'none',
                      }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudent(s.id)}
                          style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: isSelected ? 'var(--text)' : 'var(--text-muted)',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {s.name}
                          </span>
                          {s.phone && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              ({s.phone})
                            </span>
                          )}
                        </div>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px', flexShrink: 0 }}>
                        <input
                          type="number"
                          placeholder={isSelected ? `/${form.maxMarks || '?'}` : 'Not tested'}
                          min={0}
                          max={Number(form.maxMarks) || undefined}
                          step="any"
                          disabled={!isSelected}
                          value={isSelected ? (form.marks[s.id] ?? '') : ''}
                          onChange={e => setForm(f => ({
                            ...f,
                            marks: { ...f.marks, [s.id]: e.target.value }
                          }))}
                          style={{
                            padding: '6px 8px',
                            fontSize: '13px',
                            width: '100%',
                            opacity: isSelected ? 1 : 0.4,
                            background: isSelected ? 'var(--surface)' : 'var(--bg)',
                            cursor: isSelected ? 'text' : 'not-allowed',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <Plus size={16} />}
              {saving ? 'Saving...' : 'Save Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
