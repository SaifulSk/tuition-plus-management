import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Homework } from '../../types';
import { Book, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function StudentHomework() {
  const { appUser } = useAuth();
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  
  const loadData = async () => {
    if (!appUser) return;
    try {
      const userDoc = await getDocs(query(collection(db, 'users')));
      const userRef = userDoc.docs.find(d => d.id === appUser.uid);
      const sid = userRef?.data().studentId;
      if (!sid) { setLoading(false); return; }
      setStudentId(sid);

      const sSnap = await getDocs(collection(db, 'students'));
      const st = sSnap.docs.find(d => d.id === sid);
      const studentClass = st?.data().class;
      const studentSubjects = st?.data().subjects || [];
      if (!studentClass) { setLoading(false); return; }

      const hwSnap = await getDocs(query(collection(db, 'homework'), orderBy('dueDate', 'desc')));
      const allHw = hwSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Homework);
      
      const myHw = allHw.filter(hw => hw.targetClass === studentClass && studentSubjects.includes(hw.subject));
      setHomeworks(myHw);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [appUser]);

  const toggleComplete = async (hw: Homework) => {
    if (!studentId) return;
    try {
      const isCompleted = hw.completedBy?.includes(studentId);
      const newCompletedBy = isCompleted 
        ? hw.completedBy.filter(id => id !== studentId)
        : [...(hw.completedBy || []), studentId];
        
      await updateDoc(doc(db, 'homework', hw.id), { completedBy: newCompletedBy });
      setHomeworks(hwList => hwList.map(h => h.id === hw.id ? { ...h, completedBy: newCompletedBy } : h));
      toast.success(isCompleted ? 'Marked as incomplete' : 'Marked as completed!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="page"><div className="loader large"/></div>;

  const pending = homeworks.filter(hw => !hw.completedBy?.includes(studentId!));
  const completed = homeworks.filter(hw => hw.completedBy?.includes(studentId!));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Homework</h1>
          <p className="page-sub">Track and complete your assignments</p>
        </div>
      </div>

      <div className="card mb-16">
        <h3 className="section-title">Pending Assignments</h3>
        {pending.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <Book size={32} />
            <p>You're all caught up!</p>
          </div>
        ) : (
          <div className="grid">
            {pending.map(hw => (
              <div key={hw.id} className="card" style={{ border: '1px solid var(--border-light)', boxShadow: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div className="fw-600" style={{ fontSize: '1.1rem' }}>{hw.title}</div>
                    <div className="text-sm text-muted">{hw.subject}</div>
                  </div>
                  <span className={`badge ${hw.dueDate.toDate() < new Date() ? 'badge-red' : 'badge-orange'}`}>
                    Due {format(hw.dueDate.toDate(), 'MMM dd')}
                  </span>
                </div>
                {hw.description && <p className="text-sm mb-16">{hw.description}</p>}
                <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => toggleComplete(hw)}>
                  <CheckCircle size={16} /> Mark Complete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div className="card">
          <h3 className="section-title">Completed Assignments</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Title</th>
                  <th>Subject</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {completed.map(hw => (
                  <tr key={hw.id}>
                    <td style={{ paddingLeft: '24px' }} className="fw-600">{hw.title}</td>
                    <td>{hw.subject}</td>
                    <td>{format(hw.dueDate.toDate(), 'dd MMM yyyy')}</td>
                    <td>
                      <button className="btn-ghost text-sm" onClick={() => toggleComplete(hw)}>Undo</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
