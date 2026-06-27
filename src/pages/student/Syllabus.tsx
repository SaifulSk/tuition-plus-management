import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Student, SyllabusTopic, SyllabusStatus } from '../../types';
import { BookOpen } from 'lucide-react';

export default function StudentSyllabus() {
  const { appUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const userDoc = await getDoc(doc(db, 'users', appUser!.uid));
      const sid = userDoc.data()?.studentId;
      if (!sid) { setLoading(false); return; }
      const sSnap = await getDoc(doc(db, 'students', sid));
      if (sSnap.exists()) setStudent({ id: sSnap.id, ...sSnap.data() } as Student);
      const snap = await getDocs(collection(db, 'syllabus', sid, 'topics'));
      setTopics(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SyllabusTopic));
      setLoading(false);
    }
    load();
  }, [appUser]);

  const subjects = [...new Set(topics.map(t => t.subject))];
  const filtered = subjectFilter ? topics.filter(t => t.subject === subjectFilter) : topics;
  const completed = topics.filter(t => t.status === 'completed').length;
  const progress = topics.length ? Math.round((completed / topics.length) * 100) : 0;

  if (loading) return <div className="page"><div className="loader large"/></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Syllabus</h1>
          <p className="page-sub">Track your topic completion progress</p>
        </div>
      </div>

      <div className="card mb-16">
        <div className="progress-header">
          <span className="fw-600">Overall Progress</span>
          <span className="badge badge-blue">{progress}%</span>
        </div>
        <div className="syllabus-progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}/>
        </div>
        <div className="progress-stats">
          <span>✅ {completed} completed</span>
          <span>🔄 {topics.filter(t=>t.status==='in_progress').length} in progress</span>
          <span>⏳ {topics.filter(t=>t.status==='not_started').length} not started</span>
        </div>
      </div>

      <div className="tabs mb-16">
        <button className={`tab-btn ${!subjectFilter?'active':''}`} onClick={()=>setSubjectFilter('')}>All</button>
        {subjects.map(s => <button key={s} className={`tab-btn ${subjectFilter===s?'active':''}`} onClick={()=>setSubjectFilter(s)}>{s}</button>)}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state"><BookOpen size={40}/><p>No topics added yet</p></div>
        ) : (
          <div className="syllabus-list">
            {filtered.map(t => (
              <div key={t.id} className={`syllabus-item status-${t.status}`}>
                <div>
                  <div className="fw-600">{t.topic}</div>
                  <div className="text-muted text-sm">{t.subject}{t.chapter && ` — ${t.chapter}`}</div>
                </div>
                <span className={`badge badge-${t.status==='completed'?'green':t.status==='in_progress'?'orange':'gray'}`}>
                  {t.status.replace('_',' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
