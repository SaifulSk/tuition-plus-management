import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, TuitionTest } from '../../types';
import { Plus, X, ClipboardList, Trash2, Pencil, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useConfirm } from '../../hooks/useConfirm';
import { useSubjects } from '../../hooks/useSubjects';
import ViewTestModal from '../../components/modals/ViewTestModal';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const getMarksBadgeClass = (pct: number) => {
  if (pct >= 90) return 'badge-excel-dark-green';
  if (pct >= 71) return 'badge-excel-light-green';
  if (pct >= 51) return 'badge-excel-yellow';
  if (pct >= 31) return 'badge-excel-pink';
  return 'badge-excel-red';
};

export default function Tests() {
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<TuitionTest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [viewingTest, setViewingTest] = useState<TuitionTest | null>(null);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [targetClass, setTargetClass] = useState('');
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    maxMarks: '',
    marks: {} as Record<string, string>,
  });
  const { masterSubjects, formatSubjects } = useSubjects();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    getDocs(query(collection(db, 'students'), orderBy('name'))).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student).filter(s => s.active !== false);
      setStudents(data);
    });
    loadTests();
  }, []);

  const loadTests = async () => {
    const snap = await getDocs(query(collection(db, 'tests'), orderBy('date', 'desc')));
    setTests(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TuitionTest));
  };

  const openNewModal = () => {
    setEditingTestId(null);
    setTargetClass('');
    setSubjects([]);
    setSelectedStudentIds([]);
    setForm({
      title: '',
      date: new Date().toISOString().split('T')[0],
      maxMarks: '',
      marks: {},
    });
    setShowModal(true);
  };

  const openEditModal = (t: TuitionTest) => {
    setEditingTestId(t.id);
    const marksStr: Record<string, string> = {};
    const selectedIds: string[] = [];

    if (t.studentMarks) {
      Object.entries(t.studentMarks).forEach(([id, mark]) => {
        marksStr[id] = mark.toString();
        selectedIds.push(id);
      });
    }

    // Determine target class (or infer from first marked student)
    let tClass = t.targetClass || '';
    if (!tClass && selectedIds.length > 0) {
      const st = students.find(s => s.id === selectedIds[0]);
      if (st) tClass = st.class;
    }

    setTargetClass(tClass);
    setSelectedStudentIds(selectedIds);
    setForm({
      title: t.title || '',
      date: t.date ? new Date(t.date.toDate().getTime() - t.date.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      maxMarks: t.maxMarks?.toString() || '',
      marks: marksStr,
    });
    setSubjects(t.subjects || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTestId(null);
    setTargetClass('');
    setSubjects([]);
    setSelectedStudentIds([]);
    setForm({
      title: '',
      date: new Date().toISOString().split('T')[0],
      maxMarks: '',
      marks: {},
    });
  };

  const handleClassChange = (newClass: string) => {
    setTargetClass(newClass);
    // When changing class, clear selected students so only students of the new class can be chosen
    setSelectedStudentIds([]);
  };

  const classStudents = students.filter(s => s.active !== false && s.class === targetClass);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || subjects.length === 0 || !form.maxMarks || !form.date) {
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

    // Verify marks for all selected students
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
      const payload = {
        title: form.title.trim(),
        subjects,
        date: Timestamp.fromDate(new Date(form.date)),
        maxMarks: Number(form.maxMarks),
        studentMarks,
        targetClass,
      };

      if (editingTestId) {
        await updateDoc(doc(db, 'tests', editingTestId), payload);
        toast.success('Test updated!');
      } else {
        await addDoc(collection(db, 'tests'), {
          ...payload,
          createdAt: Timestamp.now(),
        });
        toast.success('Test logged!');
      }

      closeModal();
      loadTests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  const deleteTest = (id: string) => {
    confirm('Delete this test?', async () => {
      await deleteDoc(doc(db, 'tests', id));
      loadTests();
      toast.success('Test deleted');
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tuition Tests</h1>
          <p className="page-sub">Log class-based tests and track student performance</p>
        </div>
        <button className="btn-primary" onClick={openNewModal}>
          <Plus size={18} /> Log Test
        </button>
      </div>

      <div className="card">
        {tests.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} />
            <p>No tests logged yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Class</th>
                  <th>Subjects</th>
                  <th>Date</th>
                  <th>Max Marks</th>
                  <th>Students Appeared</th>
                  <th>Avg Score</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map(t => {
                  const markedEntries = Object.entries(t.studentMarks || {})
                    .filter(([sid]) => students.some(s => s.id === sid));
                  const markedScores = markedEntries.map(([_, m]) => m);
                  const avg = markedScores.length ? Math.round(markedScores.reduce((a, b) => a + b, 0) / markedScores.length) : null;
                  
                  // Inferred or stored class
                  const displayClass = t.targetClass || (() => {
                    const firstId = Object.keys(t.studentMarks || {})[0];
                    return students.find(s => s.id === firstId)?.class;
                  })();

                  return (
                    <tr key={t.id}>
                      <td className="fw-600">{t.title}</td>
                      <td>
                        {displayClass ? (
                          <span className="badge badge-blue">Class {displayClass}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>{formatSubjects(t.subjects)}</td>
                      <td>{t.date ? format(t.date.toDate(), 'dd MMM yyyy') : '—'}</td>
                      <td>{t.maxMarks}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{markedScores.length}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 4 }}>
                          {displayClass ? `(Class ${displayClass})` : 'students'}
                        </span>
                      </td>
                      <td>
                        {avg !== null ? (
                          <span className={`badge ${getMarksBadgeClass(Math.round((avg / t.maxMarks) * 100))}`}>
                            {avg}/{t.maxMarks}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="icon-btn"
                            onClick={() => setViewingTest(t)}
                            title="View Student Results"
                            style={{ color: 'var(--navy)' }}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => openEditModal(t)}
                            title="Edit Test"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => deleteTest(t.id)}
                            title="Delete Test"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Test Results Modal */}
      <ViewTestModal
        isOpen={!!viewingTest}
        onClose={() => setViewingTest(null)}
        test={viewingTest}
        students={students}
        onEdit={t => openEditModal(t)}
      />

      {/* Log / Edit Test Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal large" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={20} color="var(--navy)" />
                <h2>{editingTestId ? 'Edit Tuition Test' : 'Log Tuition Test'}</h2>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
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
                    value={subjects[0] || ''}
                    onChange={e => setSubjects([e.target.value])}
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

              {/* Student Marks Section */}
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
                        : 'Please select a Class above first to see students'}
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
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : (editingTestId ? <Pencil size={16} /> : <Plus size={16} />)}
                  {saving ? 'Saving…' : (editingTestId ? 'Update Test' : 'Save Test')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
