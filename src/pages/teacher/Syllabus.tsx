import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, SyllabusTopic, SyllabusStatus } from '../../types';
import { Plus, X, BookOpen, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';
import MultiSelect from '../../components/common/MultiSelect';
import { useConfirm } from '../../hooks/useConfirm';

const STATUS_OPTIONS: { value: SyllabusStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'badge-gray' },
  { value: 'in_progress', label: 'In Progress', color: 'badge-orange' },
  { value: 'completed', label: 'Completed', color: 'badge-green' },
];

export default function Syllabus() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [form, setForm] = useState({ chapter: '', topic: '', status: 'not_started' as SyllabusStatus });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
  }, []);

  const loadTopics = async (sid: string) => {
    const snap = await getDocs(collection(db,'syllabus',sid,'topics'));
    setTopics(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SyllabusTopic));
  };

  useEffect(() => { if (selectedStudent) loadTopics(selectedStudent); else setTopics([]); }, [selectedStudent]);

  const student = students.find(s => s.id === selectedStudent);
  const distinctSubjects = student?.subjects || [...new Set(topics.flatMap(t => t.subjects || []))];
  const filtered = subjectFilter ? topics.filter(t => t.subjects?.includes(subjectFilter)) : topics;
  const completed = topics.filter(t => t.status === 'completed').length;
  const progress = topics.length ? Math.round((completed / topics.length) * 100) : 0;

  const openEditModal = (t: SyllabusTopic) => {
    setEditingTopicId(t.id);
    setForm({
      chapter: t.chapter || '',
      topic: t.topic || '',
      status: t.status || 'not_started',
    });
    setSubjects(t.subjects || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTopicId(null);
    setForm({ chapter:'', topic:'', status:'not_started' });
    setSubjects([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || subjects.length === 0 || !form.topic) { toast.error('Fill required fields'); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...form, subjects, studentId: selectedStudent,
      };
      if (form.status === 'completed') {
        payload.completedDate = Timestamp.now();
      } else {
        payload.completedDate = null;
      }
      
      if (editingTopicId) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
           updateDoc(doc(db, 'syllabus', selectedStudent, 'topics', editingTopicId), payload);
        });
        toast.success('Topic updated!');
      } else {
        await addDoc(collection(db,'syllabus',selectedStudent,'topics'), payload);
        toast.success('Topic added!');
      }
      closeModal();
      loadTopics(selectedStudent);
    } finally { setSaving(false); }
  };

  const updateStatus = async (topic: SyllabusTopic, status: SyllabusStatus) => {
    await updateDoc(doc(db,'syllabus',selectedStudent,'topics',topic.id), {
      status,
      completedDate: status === 'completed' ? Timestamp.now() : null,
    });
    loadTopics(selectedStudent);
  };

  const deleteTopic = (id: string) => {
    confirm('Are you sure you want to delete this topic?', async () => {
      await deleteDoc(doc(db,'syllabus',selectedStudent,'topics',id));
      loadTopics(selectedStudent);
      toast.success('Topic removed');
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Syllabus Tracker</h1>
          <p className="page-sub">Track chapter and topic completion per student</p>
        </div>
        {selectedStudent && (
          <button className="btn-primary" onClick={() => { setEditingTopicId(null); setForm({ chapter:'', topic:'', status:'not_started' }); setSubjects([]); setShowModal(true); }}>
            <Plus size={18}/> Add Topic
          </button>
        )}
      </div>

      <div className="card mb-16">
        <div className="form-group" style={{marginBottom:0}}>
          <label>Select Student</label>
          <select id="syllabus-student-select" value={selectedStudent} onChange={e => { setSelectedStudent(e.target.value); setSubjectFilter(''); }}>
            <option value="">— Choose a student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>)}
          </select>
        </div>
      </div>

      {!selectedStudent ? (
        <div className="empty-state"><BookOpen size={48}/><p>Select a student to manage their syllabus</p></div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="card mb-16">
            <div className="progress-header">
              <span className="fw-600">{student?.name}'s Progress</span>
              <span className="badge badge-blue">{progress}% complete</span>
            </div>
            <div className="syllabus-progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}/>
            </div>
            <div className="progress-stats">
              <span>✅ {topics.filter(t=>t.status==='completed').length} completed</span>
              <span>🔄 {topics.filter(t=>t.status==='in_progress').length} in progress</span>
              <span>⏳ {topics.filter(t=>t.status==='not_started').length} not started</span>
            </div>
          </div>

          {/* Subject filter tabs */}
          <div className="tabs mb-16">
            <button className={`tab-btn ${!subjectFilter?'active':''}`} onClick={()=>setSubjectFilter('')}>All</button>
            {distinctSubjects.map(s => (
              <button key={s} className={`tab-btn ${subjectFilter===s?'active':''}`} onClick={()=>setSubjectFilter(s)}>{s}</button>
            ))}
          </div>

          {/* Topics */}
          <div className="card">
            {filtered.length === 0 ? (
              <div className="empty-state"><BookOpen size={32}/><p>No topics yet</p></div>
            ) : (
              <div className="syllabus-list">
                {filtered.map(t => (
                  <div key={t.id} className={`syllabus-item status-${t.status}`}>
                    <div className="syllabus-item-info">
                      <div className="fw-600">{t.topic}</div>
                      <div className="text-muted text-sm">{t.subjects?.join(', ')}{t.chapter && ` — ${t.chapter}`}</div>
                    </div>
                    <div className="syllabus-item-actions">
                      <select
                        value={t.status}
                        onChange={e => updateStatus(t, e.target.value as SyllabusStatus)}
                        className={`status-select ${t.status}`}
                      >
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button className="icon-btn" onClick={() => openEditModal(t)} title="Edit"><Pencil size={15}/></button>
                      <button className="icon-btn danger" onClick={() => deleteTopic(t.id)} title="Delete"><Trash2 size={15}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTopicId ? 'Edit Topic' : 'Add Topic'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>Subjects *</label>
                <MultiSelect 
                  options={Array.from(new Set([...distinctSubjects, ...masterSubjects]))}
                  selected={subjects}
                  onChange={setSubjects}
                  placeholder="Select subjects"
                  required
                />
              </div>
              <div className="form-group">
                <label>Chapter</label>
                <input type="text" placeholder="e.g. Chapter 3" value={form.chapter} onChange={e => setForm(f=>({...f,chapter:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Topic *</label>
                <input type="text" placeholder="e.g. Quadratic Equations" value={form.topic} onChange={e => setForm(f=>({...f,topic:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value as SyllabusStatus}))}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : (editingTopicId ? <Pencil size={16}/> : <Plus size={16}/>)}
                  {saving ? 'Saving…' : (editingTopicId ? 'Update Topic' : 'Add Topic')}
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
