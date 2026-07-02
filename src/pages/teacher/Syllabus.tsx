import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, SyllabusTopic, SyllabusStatus } from '../../types';
import { Plus, X, BookOpen, Trash2, Pencil, ChevronDown, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';
import MultiSelect from '../../components/common/MultiSelect';
import { useConfirm } from '../../hooks/useConfirm';

const STATUS_OPTIONS: { value: SyllabusStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'badge-gray' },
  { value: 'in_progress', label: 'In Progress', color: 'badge-orange' },
  { value: 'completed', label: 'Completed', color: 'badge-green' },
];

const STATUS_CYCLE: SyllabusStatus[] = ['not_started', 'in_progress', 'completed'];

const STATUS_BG: Record<SyllabusStatus, string> = {
  not_started: '#f1f5f9',
  in_progress: '#fef3c7',
  completed: '#dcfce7',
};
const STATUS_COLOR: Record<SyllabusStatus, string> = {
  not_started: '#64748b',
  in_progress: '#d97706',
  completed: '#16a34a',
};
const STATUS_EMOJI: Record<SyllabusStatus, string> = {
  not_started: '⏳',
  in_progress: '🔄',
  completed: '✅',
};

export default function Syllabus() {
  // ── Student View State ───────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalStudentId, setModalStudentId] = useState('');
  const [isStudentLocked, setIsStudentLocked] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [form, setForm] = useState({ chapter: '', topic: '', status: 'not_started' as SyllabusStatus });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);

  // ── View Mode ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'student' | 'master'>('master');

  // ── Overview State ─────────────────────────────────────────────────────
  const [allTopics, setAllTopics] = useState<Record<string, SyllabusTopic[]>>({});
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [masterLoaded, setMasterLoaded] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());

  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    getDocs(query(collection(db, 'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student).filter(s => s.active !== false));
    });
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
  }, []);

  const loadTopics = async (sid: string) => {
    const snap = await getDocs(collection(db, 'syllabus', sid, 'topics'));
    setTopics(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SyllabusTopic));
  };

  useEffect(() => {
    if (selectedStudent) loadTopics(selectedStudent);
    else setTopics([]);
  }, [selectedStudent]);

  // ── Master view: load all topics ──────────────────────────────────────────
  const loadMasterData = async () => {
    setLoadingMaster(true);
    try {
      const topicsData: Record<string, SyllabusTopic[]> = {};
      await Promise.all(
        students.map(async s => {
          const snap = await getDocs(collection(db, 'syllabus', s.id, 'topics'));
          topicsData[s.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }) as SyllabusTopic);
        })
      );
      setAllTopics(topicsData);
      setMasterLoaded(true);
    } finally {
      setLoadingMaster(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'master' && !masterLoaded && students.length > 0) {
      loadMasterData();
    }
  }, [viewMode, students]);

  // ── Student View helpers ───────────────────────────────────────────────────
  const student = students.find(s => s.id === selectedStudent);
  const distinctSubjects = student?.subjects || [...new Set(topics.flatMap(t => t.subjects || []))];
  const filtered = subjectFilter ? topics.filter(t => t.subjects?.includes(subjectFilter)) : topics;
  const completed = topics.filter(t => t.status === 'completed').length;
  const progress = topics.length ? Math.round((completed / topics.length) * 100) : 0;

  const openEditModal = (t: SyllabusTopic, studentId?: string) => {
    setEditingTopicId(t.id);
    setForm({ chapter: t.chapter || '', topic: t.topic || '', status: t.status || 'not_started' });
    setSubjects(t.subjects || []);
    if (studentId) {
      setModalStudentId(studentId);
      setIsStudentLocked(true);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTopicId(null);
    setModalStudentId('');
    setIsStudentLocked(false);
    setForm({ chapter: '', topic: '', status: 'not_started' });
    setSubjects([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStudentId || subjects.length === 0 || !form.topic) { toast.error('Fill required fields'); return; }
    setSaving(true);
    try {
      const payload: any = { ...form, subjects, studentId: modalStudentId };
      if (form.status === 'completed') payload.completedDate = Timestamp.now();
      else payload.completedDate = null;

      if (editingTopicId) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
          updateDoc(doc(db, 'syllabus', modalStudentId, 'topics', editingTopicId), payload);
        });
        toast.success('Topic updated!');
      } else {
        await addDoc(collection(db, 'syllabus', modalStudentId, 'topics'), payload);
        toast.success('Topic added!');
      }
      closeModal();
      if (viewMode === 'master') {
        loadMasterData();
      } else {
        loadTopics(modalStudentId);
      }
    } finally { setSaving(false); }
  };

  const updateStatus = async (topic: SyllabusTopic, status: SyllabusStatus) => {
    await updateDoc(doc(db, 'syllabus', selectedStudent, 'topics', topic.id), {
      status,
      completedDate: status === 'completed' ? Timestamp.now() : null,
    });
    loadTopics(selectedStudent);
  };

  const deleteTopic = (id: string) => {
    confirm('Are you sure you want to delete this topic?', async () => {
      await deleteDoc(doc(db, 'syllabus', selectedStudent, 'topics', id));
      loadTopics(selectedStudent);
      toast.success('Topic removed');
    });
  };

  // ── Overview: update status by cycling ─────────────────────────────────
  const masterUpdateStatus = async (studentId: string, topicId: string, currentStatus: SyllabusStatus) => {
    const nextIdx = (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIdx];
    const completedDate = nextStatus === 'completed' ? Timestamp.now() : null;
    await updateDoc(doc(db, 'syllabus', studentId, 'topics', topicId), { status: nextStatus, completedDate });
    setAllTopics(prev => ({
      ...prev,
      [studentId]: (prev[studentId] || []).map(t =>
        t.id === topicId ? { ...t, status: nextStatus } : t
      ),
    }));
    toast.success(`Marked as "${nextStatus.replace('_', ' ')}"`);
  };

  // ── Overview: assign new topic to a student ────────────────────────────
  const masterAssignTopic = async (studentId: string, topicName: string, chapter: string, subjectList: string[]) => {
    const payload = {
      topic: topicName,
      chapter,
      subjects: subjectList,
      studentId,
      status: 'not_started' as SyllabusStatus,
      completedDate: null,
    };
    const ref = await addDoc(collection(db, 'syllabus', studentId, 'topics'), payload);
    const newTopic: SyllabusTopic = { id: ref.id, ...payload, completedDate: undefined };
    setAllTopics(prev => ({
      ...prev,
      [studentId]: [...(prev[studentId] || []), newTopic],
    }));
    toast.success('Topic assigned to student');
  };

  // ── Build master view data structure ─────────────────────────────────────
  const masterData = (() => {
    if (!masterLoaded) return {};

    type TopicEntry = { chapter: string; subjects: string[]; studentTopics: Record<string, SyllabusTopic> };
    type SubjectEntry = { studentsInSubject: Student[]; topicMap: Record<string, TopicEntry> };
    type SchoolEntry = { students: Student[]; subjects: Record<string, SubjectEntry> };
    type ClassEntry = { students: Student[]; schools: Record<string, SchoolEntry> };
    const classMap: Record<string, ClassEntry> = {};

    for (const s of students) {
      const cls = s.class || 'Unknown';
      const sch = s.school || 'Unknown';
      if (!classMap[cls]) classMap[cls] = { students: [], schools: {} };
      classMap[cls].students.push(s);
      
      if (!classMap[cls].schools[sch]) classMap[cls].schools[sch] = { students: [], subjects: {} };
      classMap[cls].schools[sch].students.push(s);
    }

    for (const [, classData] of Object.entries(classMap)) {
      for (const [, schoolData] of Object.entries(classData.schools)) {
        for (const s of schoolData.students) {
          for (const subj of (s.subjects || [])) {
            if (!schoolData.subjects[subj]) {
              schoolData.subjects[subj] = { studentsInSubject: [], topicMap: {} };
            }
            if (!schoolData.subjects[subj].studentsInSubject.find(st => st.id === s.id)) {
              schoolData.subjects[subj].studentsInSubject.push(s);
            }
          }
          const studentTopics = allTopics[s.id] || [];
          for (const topic of studentTopics) {
            for (const subj of (topic.subjects || [])) {
              if (!schoolData.subjects[subj]) {
                schoolData.subjects[subj] = { studentsInSubject: [], topicMap: {} };
              }
              const sd = schoolData.subjects[subj];
              if (!sd.studentsInSubject.find(st => st.id === s.id)) {
                sd.studentsInSubject.push(s);
              }
              if (!sd.topicMap[topic.topic]) {
                sd.topicMap[topic.topic] = { chapter: topic.chapter || '', subjects: topic.subjects || [], studentTopics: {} };
              }
              sd.topicMap[topic.topic].studentTopics[s.id] = topic;
            }
          }
        }
      }
    }

    return classMap;
  })();

  const toggleClass = (cls: string) =>
    setExpandedClasses(prev => { const n = new Set(prev); n.has(cls) ? n.delete(cls) : n.add(cls); return n; });

  const toggleSubject = (key: string) =>
    setExpandedSubjects(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleSchool = (key: string) =>
    setExpandedSchools(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div className="page">
      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Syllabus Tracker</h1>
          <p className="page-sub mb-16">Track chapter and topic completion per student</p>
          {/* View toggle */}
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab-btn ${viewMode === 'master' ? 'active' : ''}`} onClick={() => setViewMode('master')}>Overview</button>
            <button className={`tab-btn ${viewMode === 'student' ? 'active' : ''}`} onClick={() => setViewMode('student')}>Student View</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => { 
            const isStudentView = viewMode === 'student' && !!selectedStudent;
            setModalStudentId(isStudentView ? selectedStudent : '');
            setIsStudentLocked(isStudentView);
            setEditingTopicId(null); 
            setForm({ chapter: '', topic: '', status: 'not_started' }); 
            setSubjects([]); 
            setShowModal(true); 
          }}>
            <Plus size={18} /> Add Topic
          </button>
        </div>
      </div>

      {/* ─── STUDENT VIEW ─────────────────────────────────────────────────── */}
      {viewMode === 'student' && (
        <>
          <div className="card mb-16">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Select Student</label>
              <select id="syllabus-student-select" value={selectedStudent} onChange={e => { setSelectedStudent(e.target.value); setSubjectFilter(''); }}>
                <option value="">— Choose a student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>)}
              </select>
            </div>
          </div>

          {!selectedStudent ? (
            <div className="empty-state"><BookOpen size={48} /><p>Select a student to manage their syllabus</p></div>
          ) : (
            <>
              <div className="card mb-16">
                <div className="progress-header">
                  <span className="fw-600">{student?.name}'s Progress</span>
                  <span className="badge badge-blue">{progress}% complete</span>
                </div>
                <div className="syllabus-progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-stats">
                  <span>✅ {topics.filter(t => t.status === 'completed').length} completed</span>
                  <span>🔄 {topics.filter(t => t.status === 'in_progress').length} in progress</span>
                  <span>⏳ {topics.filter(t => t.status === 'not_started').length} not started</span>
                </div>
              </div>

              <div className="tabs mb-16">
                <button className={`tab-btn ${!subjectFilter ? 'active' : ''}`} onClick={() => setSubjectFilter('')}>All</button>
                {distinctSubjects.map(s => (
                  <button key={s} className={`tab-btn ${subjectFilter === s ? 'active' : ''}`} onClick={() => setSubjectFilter(s)}>{s}</button>
                ))}
              </div>

              <div className="card">
                {filtered.length === 0 ? (
                  <div className="empty-state"><BookOpen size={32} /><p>No topics yet</p></div>
                ) : (
                  <div className="syllabus-list">
                    {filtered.map(t => (
                      <div key={t.id} className={`syllabus-item status-${t.status}`}>
                        <div className="syllabus-item-info">
                          <div className="fw-600">{t.topic}</div>
                          <div className="text-muted text-sm">{t.subjects?.join(', ')}{t.chapter && ` — ${t.chapter}`}</div>
                        </div>
                        <div className="syllabus-item-actions">
                          <select value={t.status} onChange={e => updateStatus(t, e.target.value as SyllabusStatus)} className={`status-select ${t.status}`}>
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <button className="icon-btn" onClick={() => openEditModal(t, selectedStudent)} title="Edit"><Pencil size={15} /></button>
                          <button className="icon-btn danger" onClick={() => deleteTopic(t.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── MASTER VIEW ──────────────────────────────────────────────────── */}
      {viewMode === 'master' && (
        <>
          {loadingMaster ? (
            <div className="empty-state">
              <div className="loader large" />
              <p>Loading all student syllabus data…</p>
            </div>
          ) : !masterLoaded ? (
            <div className="empty-state"><BookOpen size={48} /><p>Loading…</p></div>
          ) : Object.keys(masterData).length === 0 ? (
            <div className="empty-state"><BookOpen size={48} /><p>No syllabus data found. Add topics in Student View first.</p></div>
          ) : (
            <div className="card mb-16">
              <h2 className="section-title mb-16">Class-wise Syllabus Progress</h2>
              <div className="accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(masterData)
                .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
                .map(([cls, classData]) => {
                  const classExpanded = expandedClasses.has(cls);


                  return (
                    <div key={cls} className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      {/* Class accordion header */}
                      <div 
                        className="accordion-header" 
                        onClick={() => toggleClass(cls)}
                        style={{ padding: '16px', background: classExpanded ? 'var(--bg)' : 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Class {cls}
                          <span className="badge badge-gray ml-auto" style={{ marginLeft: 8 }}>
                            {classData.students.length} students
                          </span>
                        </div>
                        {classExpanded ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
                      </div>

                      {classExpanded && (
                        <div className="accordion-body" style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                          {Object.keys(classData.schools).length === 0 ? (
                            <p className="text-muted text-sm">No schools recorded for students in this class yet.</p>
                          ) : (
                            Object.entries(classData.schools)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([school, schoolData]) => {
                                const schoolKey = `${cls}__${school}`;
                                const schoolExpanded = expandedSchools.has(schoolKey);

                                return (
                                  <div key={school} style={{ border: '1px solid var(--border-light)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                                    {/* School accordion header */}
                                    <div
                                      onClick={() => toggleSchool(schoolKey)}
                                      style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '14px 16px', background: 'var(--surface)',
                                        border: 'none', cursor: 'pointer', textAlign: 'left',
                                        borderBottom: schoolExpanded ? '1px solid var(--border-light)' : 'none',
                                      }}
                                    >
                                      {schoolExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: 15 }}>{school}</span>
                                        <span className="badge badge-gray ml-auto" style={{ marginLeft: 8 }}>
                                          {schoolData.students.length} students
                                        </span>
                                      </div>
                                    </div>

                                    {schoolExpanded && (
                                      <div style={{ padding: '16px' }}>
                                        {Object.keys(schoolData.subjects).length === 0 ? (
                                          <p className="text-muted text-sm">No topics recorded for this school yet.</p>
                                        ) : (
                                          Object.entries(schoolData.subjects)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([subject, sd]) => {
                                              const subjectKey = `${schoolKey}__${subject}`;
                                              const subjectExpanded = expandedSubjects.has(subjectKey);
                                              const topicEntries = Object.entries(sd.topicMap);

                                // Per-student progress for this subject
                                const studentsForSubject = sd.studentsInSubject;
                                const subjectProgressMap: Record<string, number> = {};
                                for (const s of studentsForSubject) {
                                  const sTopics = (allTopics[s.id] || []).filter(t => t.subjects?.includes(subject));
                                  subjectProgressMap[s.id] = sTopics.length
                                    ? Math.round(sTopics.filter(t => t.status === 'completed').length / sTopics.length * 100)
                                    : 0;
                                }
                                const avgSubjectPct = studentsForSubject.length
                                  ? Math.round(Object.values(subjectProgressMap).reduce((a, b) => a + b, 0) / studentsForSubject.length)
                                  : 0;
                                return (
                                  <div key={subject} style={{ border: '1px solid var(--border-light)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                                    {/* Subject accordion header */}
                                    <div
                                      onClick={() => toggleSubject(subjectKey)}
                                      style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '12px 16px', background: 'var(--surface)',
                                        border: 'none', cursor: 'pointer', textAlign: 'left',
                                        borderBottom: subjectExpanded ? '1px solid var(--border-light)' : 'none',
                                      }}
                                    >
                                      {subjectExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontWeight: 600, fontSize: 14 }}>{subject}</span>
                                          <span className="badge badge-gray" style={{ marginLeft: 8 }}>
                                            {sd.studentsInSubject.length} students
                                          </span>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {/* Mini progress bar */}
                                        <div style={{ width: 90, height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                                          <div style={{ width: `${avgSubjectPct}%`, height: '100%', background: avgSubjectPct === 100 ? '#16a34a' : 'var(--primary)', borderRadius: 3, transition: 'width 0.3s' }} />
                                        </div>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36 }}>{avgSubjectPct}% avg</span>
                                      </div>
                                    </div>

                                    {subjectExpanded && (
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                          <thead>
                                            <tr style={{ background: 'var(--surface-2)' }}>
                                              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border-light)', minWidth: 200 }}>Topic</th>
                                              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid var(--border-light)', minWidth: 120, color: 'var(--text-muted)' }}>Chapter</th>
                                              {studentsForSubject.map(s => (
                                                <th key={s.id} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--border-light)', minWidth: 120 }}>
                                                  <div>{s.name.split(' ')[0]}</div>
                                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
                                                    <div style={{ width: 48, height: 4, background: 'var(--border-light)', borderRadius: 2, overflow: 'hidden' }}>
                                                      <div style={{ width: `${subjectProgressMap[s.id]}%`, height: '100%', background: subjectProgressMap[s.id] === 100 ? '#16a34a' : '#6366f1', borderRadius: 2 }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{subjectProgressMap[s.id]}%</span>
                                                  </div>
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {topicEntries.length === 0 ? (
                                              <tr>
                                                <td colSpan={2 + studentsForSubject.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                  No topics recorded for this subject yet.
                                                </td>
                                              </tr>
                                            ) : 
                                              topicEntries
                                                .sort(([a], [b]) => {
                                                  // Sort by chapter first, then topic name
                                                  const chA = sd.topicMap[a].chapter;
                                                  const chB = sd.topicMap[b].chapter;
                                                  if (chA !== chB) return chA.localeCompare(chB);
                                                  return a.localeCompare(b);
                                              })
                                              .map(([topicName, topicData], rowIdx) => (
                                                <tr key={topicName} style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                                                  <td style={{ padding: '9px 14px', fontWeight: 500, borderBottom: '1px solid var(--border-light)' }}>{topicName}</td>
                                                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', fontSize: 12 }}>{topicData.chapter || '—'}</td>
                                                  {studentsForSubject.map(s => {
                                                    const st = topicData.studentTopics[s.id];
                                                    return (
                                                      <td key={s.id} style={{ padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid var(--border-light)' }}>
                                                        {st ? (
                                                          <button
                                                            onClick={() => masterUpdateStatus(s.id, st.id, st.status)}
                                                            title={`${s.name.split(' ')[0]}: ${st.status.replace('_', ' ')} — Click to advance`}
                                                            style={{
                                                              background: STATUS_BG[st.status],
                                                              color: STATUS_COLOR[st.status],
                                                              border: 'none',
                                                              borderRadius: 6,
                                                              padding: '4px 10px',
                                                              cursor: 'pointer',
                                                              fontSize: 12,
                                                              fontWeight: 600,
                                                              whiteSpace: 'nowrap',
                                                              transition: 'opacity 0.15s, transform 0.1s',
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                                                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                                          >
                                                            {STATUS_EMOJI[st.status]}{' '}
                                                            {st.status === 'not_started' ? 'Not Started' : st.status === 'in_progress' ? 'In Progress' : 'Done'}
                                                          </button>
                                                        ) : (
                                                          <button
                                                            onClick={() => masterAssignTopic(s.id, topicName, topicData.chapter, topicData.subjects)}
                                                            title={`Assign "${topicName}" to ${s.name.split(' ')[0]}`}
                                                            style={{
                                                              background: 'transparent',
                                                              color: 'var(--text-muted)',
                                                              border: '1.5px dashed var(--border)',
                                                              borderRadius: 6,
                                                              padding: '4px 10px',
                                                              cursor: 'pointer',
                                                              fontSize: 12,
                                                              transition: 'border-color 0.15s, color 0.15s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                          >
                                                            + Assign
                                                          </button>
                                                        )}
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                              ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── ADD / EDIT MODAL ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTopicId ? 'Edit Topic' : 'Add Topic'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              {!isStudentLocked && (
                <div className="form-group">
                  <label>Student *</label>
                  <select
                    value={modalStudentId}
                    onChange={e => setModalStudentId(e.target.value)}
                    required
                    disabled={isStudentLocked}
                  >
                    <option value="">— Select a student —</option>
                    {students.map(st => (
                      <option key={st.id} value={st.id}>{st.name} ({st.class})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Subjects *</label>
                <MultiSelect
                  options={Array.from(new Set([...distinctSubjects, ...masterSubjects]))}
                  selected={subjects}
                  onChange={setSubjects}
                  placeholder="Select subjects"
                  required
                  showSelectAll
                />
              </div>
              <div className="form-group">
                <label>Chapter</label>
                <input type="text" placeholder="e.g. Chapter 3" value={form.chapter} onChange={e => setForm(f => ({ ...f, chapter: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Topic *</label>
                <input type="text" placeholder="e.g. Quadratic Equations" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SyllabusStatus }))}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : (editingTopicId ? <Pencil size={16} /> : <Plus size={16} />)}
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
