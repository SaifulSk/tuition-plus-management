import { useState, useEffect } from 'react';
import {
  collection, query, getDocs, addDoc, updateDoc,
  doc, orderBy, deleteDoc, where, deleteField, arrayRemove
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../firebase/config';
import { setDoc } from 'firebase/firestore';
import { Search, Eye, EyeOff, X, UserPlus, ChevronDown, ChevronRight, Pencil, Copy, GraduationCap, Trash2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Student } from '../../types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import MultiSelect from '../../components/common/MultiSelect';
import { useConfirm } from '../../hooks/useConfirm';
import { useSubjects } from '../../hooks/useSubjects';
import { getCurrentSession, getNextSession } from '../../utils/dateUtils';
import { useAcademicSessions } from '../../hooks/useAcademicSessions';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const EMPTY_FORM = {
  name: '', class: '', section: '', school: '',
  phone: '', parentPhone: '', confirmedFee: '',
  joiningDate: new Date().toISOString().split('T')[0],
  notes: '', email: '', tempPassword: '', session: getCurrentSession(),
};

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [subjects, setSubjects] = useState<string[]>([]);
  const { masterSubjects, formatSubjects } = useSubjects();
  const { sessions } = useAcademicSessions(students);
  const [masterSchools, setMasterSchools] = useState<string[]>([]);
  const [masterSections, setMasterSections] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [showFees, setShowFees] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSessionFilter, setArchivedSessionFilter] = useState('');
  
  // Archive State
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivingStudent, setArchivingStudent] = useState<Student | null>(null);
  const [leavingMonth, setLeavingMonth] = useState('');
  
  // Promotion State
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promotingStudent, setPromotingStudent] = useState<Student | null>(null);
  const [promoteForm, setPromoteForm] = useState({ action: 'promote', newClass: '', newSession: '' });

  // Delete State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [confirmAcknowledge, setConfirmAcknowledge] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleFee = (id: string) => {
    setShowFees(p => ({ ...p, [id]: !p[id] }));
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'students'), orderBy('name')));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student);
      setStudents(data);
      setFiltered(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    getDocs(collection(db, 'schools')).then(snap => {
      setMasterSchools(snap.docs.map(d => d.data().name));
    });
    getDocs(collection(db, 'sections')).then(snap => {
      setMasterSections(snap.docs.map(d => d.data().name));
    });
  }, []);

  useEffect(() => {
    let list = students.filter(s => showArchived ? !s.active : s.active !== false);
    if (showArchived && archivedSessionFilter) {
      list = list.filter(s => (s.session || getCurrentSession()) === archivedSessionFilter);
    }
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [search, students, showArchived, archivedSessionFilter]);

  const toggleClass = (cls: string) => {
    setExpandedClasses(p => ({ ...p, [cls]: !p[cls] }));
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const openEditModal = (s: Student) => {
    setEditingStudentId(s.id);
    setForm({
      name: s.name || '',
      class: s.class || '',
      section: s.section || '',
      school: s.school || '',
      phone: s.phone || '',
      parentPhone: s.parentPhone || '',
      confirmedFee: s.confirmedFee?.toString() || '',
      joiningDate: s.joiningDate ? format(s.joiningDate.toDate(), 'yyyy-MM-dd') : new Date().toISOString().split('T')[0],
      notes: s.notes || '',
      email: s.email || '',
      tempPassword: '',
      session: s.session || getCurrentSession(),
    });
    setSubjects(s.subjects || []);
    setShowModal(true);
  };

  const duplicateStudent = (s: Student) => {
    setEditingStudentId(null);
    setForm({
      name: `${s.name} (Copy)`,
      class: s.class || '',
      section: s.section || '',
      school: s.school || '',
      phone: s.phone || '',
      parentPhone: s.parentPhone || '',
      confirmedFee: s.confirmedFee?.toString() || '',
      joiningDate: s.joiningDate ? format(s.joiningDate.toDate(), 'yyyy-MM-dd') : new Date().toISOString().split('T')[0],
      notes: s.notes || '',
      email: '',
      tempPassword: '',
      session: s.session || getCurrentSession(),
    });
    setSubjects(s.subjects || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudentId(null);
    setForm(EMPTY_FORM);
    setSubjects([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.class || !form.school || subjects.length === 0) {
      toast.error('Name, Class, School, and Subjects are required'); return;
    }
    
    setSaving(true);
    try {
      if (editingStudentId) {
        await updateDoc(doc(db, 'students', editingStudentId), {
          name: form.name,
          class: form.class,
          section: form.section,
          school: form.school,
          phone: form.phone,
          parentPhone: form.parentPhone,
          confirmedFee: Number(form.confirmedFee) || 0,
          joiningDate: Timestamp.fromDate(new Date(form.joiningDate)),
          notes: form.notes,
          subjects,
          session: form.session,
        });
        const s = students.find(x => x.id === editingStudentId);
        
        let newUid = '';
        if (!s?.uid && form.email && form.tempPassword) {
          if (form.tempPassword.length < 6) {
            toast.error('Password must be at least 6 characters'); return;
          }
          try {
            const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.tempPassword);
            newUid = cred.user.uid;
            
            await setDoc(doc(db, 'users', newUid), {
              role: 'student',
              name: form.name,
              email: form.email,
              studentId: editingStudentId,
            });
          } catch (err: any) {
            if (err.message?.includes('EMAIL_EXISTS') || err.code === 'auth/email-already-in-use') {
              try {
                const signInCred = await signInWithEmailAndPassword(secondaryAuth, form.email, form.tempPassword);
                newUid = signInCred.user.uid;
                
                await setDoc(doc(db, 'users', newUid), {
                  role: 'student',
                  name: form.name,
                  email: form.email,
                  studentId: editingStudentId,
                });
                toast.success('Successfully re-linked existing login account.');
              } catch (signInErr) {
                toast.error('This email is already registered. To re-link it, you must use its existing password. If forgotten, use a different email.');
                setSaving(false);
                return;
              }
            } else {
              throw err;
            }
          }
        }

        if (newUid) {
          await updateDoc(doc(db, 'students', editingStudentId), {
            uid: newUid,
            email: form.email
          });
        }

        if (s?.uid && form.email === '' && form.tempPassword === '') {
          // Revoke login
          await deleteDoc(doc(db, 'users', s.uid));
          await updateDoc(doc(db, 'students', editingStudentId), {
            uid: null,
            email: null
          });
          toast.success(`Login access revoked for ${form.name}`);
        } else if (s?.uid && !newUid) {
           await updateDoc(doc(db, 'users', s.uid), { name: form.name });
           if (form.tempPassword) {
             toast.error('Cannot update password for existing login directly. To change, clear email to revoke access, then re-assign.');
           }
        }
        toast.success(`${form.name} updated successfully!`);
      } else {
        if ((form.email && !form.tempPassword) || (!form.email && form.tempPassword)) {
          toast.error('Provide both email and password to enable student login, or leave both blank'); return;
        }
        if (form.tempPassword && form.tempPassword.length < 6) {
          toast.error('Password must be at least 6 characters'); return;
        }

        let uid = '';
        if (form.email && form.tempPassword) {
          try {
            const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.tempPassword);
            uid = cred.user.uid;
          } catch (err: any) {
            if (err.message?.includes('EMAIL_EXISTS') || err.code === 'auth/email-already-in-use') {
              try {
                const signInCred = await signInWithEmailAndPassword(secondaryAuth, form.email, form.tempPassword);
                uid = signInCred.user.uid;
                toast.success('Successfully linked existing login account.');
              } catch (signInErr) {
                toast.error('This email is already registered. To link it, you must use its existing password. If forgotten, use a different email.');
                setSaving(false);
                return;
              }
            } else {
              throw err;
            }
          }
        }
        const studentRef = await addDoc(collection(db, 'students'), {
          name: form.name,
          class: form.class,
          section: form.section,
          school: form.school,
          phone: form.phone,
          parentPhone: form.parentPhone,
          confirmedFee: Number(form.confirmedFee) || 0,
          joiningDate: Timestamp.fromDate(new Date(form.joiningDate)),
          notes: form.notes,
          subjects,
          email: form.email,
          uid,
          active: true,
          feeHistory: [],
          session: form.session,
        });
        if (uid) {
          await setDoc(doc(db, 'users', uid), {
            role: 'student',
            name: form.name,
            email: form.email,
            studentId: studentRef.id,
          });
        }
        toast.success(`${form.name} added successfully!`);
      }
      
      closeModal();
      loadStudents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Student, lMonth: string | null = null) => {
    await updateDoc(doc(db, 'students', s.id), { 
      active: !s.active,
      leavingMonth: lMonth
    });
    loadStudents();
    if (!s.active) {
      toast.success(`${s.name} unarchived! Reminder: Go to the Fees page and mark their gap months as 'Waived / Leave' so they don't show as Due.`, { duration: 8000 });
    } else {
      toast.success(`${s.name} archived. Fees for months after ${lMonth || 'now'} will be greyed out.`);
    }
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingStudent) return;
    setSaving(true);
    try {
      const finalClass = promoteForm.action === 'promote' ? promoteForm.newClass : promotingStudent.class;
      await updateDoc(doc(db, 'students', promotingStudent.id), {
        class: finalClass,
        session: promoteForm.newSession
      });
      toast.success(`${promotingStudent.name} session updated!`);
      setShowPromoteModal(false);
      loadStudents();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      const studentId = deletingStudent.id;

      // 1. Delete student subcollections:
      // a. fees payments
      const feePaymentsSnap = await getDocs(collection(db, 'fees', studentId, 'payments'));
      const feeDeletions = feePaymentsSnap.docs.map(d => deleteDoc(d.ref));
      feeDeletions.push(deleteDoc(doc(db, 'fees', studentId)));

      // b. syllabus topics
      const syllabusSnap = await getDocs(collection(db, 'syllabus', studentId, 'topics'));
      const syllabusDeletions = syllabusSnap.docs.map(d => deleteDoc(d.ref));
      syllabusDeletions.push(deleteDoc(doc(db, 'syllabus', studentId)));

      // c. school exams
      const examsSnap = await getDocs(collection(db, 'schoolExams', studentId, 'exams'));
      const examDeletions = examsSnap.docs.map(d => deleteDoc(d.ref));
      examDeletions.push(deleteDoc(doc(db, 'schoolExams', studentId)));

      // d. schedules / schedule slots
      const schedSnap1 = await getDocs(collection(db, 'schedules', studentId, 'slots'));
      const schedDeletions1 = schedSnap1.docs.map(d => deleteDoc(d.ref));
      schedDeletions1.push(deleteDoc(doc(db, 'schedules', studentId)));

      const schedSnap2 = await getDocs(collection(db, 'schedule', studentId, 'slots'));
      const schedDeletions2 = schedSnap2.docs.map(d => deleteDoc(d.ref));
      schedDeletions2.push(deleteDoc(doc(db, 'schedule', studentId)));

      // 2. Attendance records for this student
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', studentId)));
      const attDeletions = attSnap.docs.map(d => deleteDoc(d.ref));

      // 3. User login account doc(s) in 'users'
      const userDeletions: Promise<any>[] = [];
      if (deletingStudent.uid) {
        userDeletions.push(deleteDoc(doc(db, 'users', deletingStudent.uid)));
      }
      const userSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', studentId)));
      userSnap.docs.forEach(d => {
        userDeletions.push(deleteDoc(d.ref));
      });

      // 4. Tuition tests marks: remove studentId key from studentMarks object
      const testsSnap = await getDocs(collection(db, 'tests'));
      const testUpdates = testsSnap.docs
        .filter(d => {
          const marks = d.data().studentMarks;
          return marks && typeof marks === 'object' && marks[studentId] !== undefined;
        })
        .map(d => updateDoc(d.ref, { [`studentMarks.${studentId}`]: deleteField() }));

      // 5. Homework records
      const hwSnap = await getDocs(collection(db, 'homework'));
      const hwUpdates = hwSnap.docs.map(d => {
        const data = d.data();
        if (data.targetType === 'student' && data.targetStudentId === studentId) {
          return deleteDoc(d.ref);
        }
        if (Array.isArray(data.completedBy) && data.completedBy.includes(studentId)) {
          return updateDoc(d.ref, { completedBy: arrayRemove(studentId) });
        }
        return Promise.resolve();
      });

      // 6. Events attendees
      const eventsSnap = await getDocs(collection(db, 'events'));
      const eventUpdates = eventsSnap.docs
        .filter(d => Array.isArray(d.data().attendees) && d.data().attendees.includes(studentId))
        .map(d => updateDoc(d.ref, { attendees: arrayRemove(studentId) }));

      // Await all cascading cleanup
      await Promise.all([
        ...feeDeletions,
        ...syllabusDeletions,
        ...examDeletions,
        ...schedDeletions1,
        ...schedDeletions2,
        ...attDeletions,
        ...userDeletions,
        ...testUpdates,
        ...hwUpdates,
        ...eventUpdates,
      ]);

      // 7. Finally delete the student document
      await deleteDoc(doc(db, 'students', studentId));

      toast.success(`Student "${deletingStudent.name}" and all records deleted permanently.`);
      setShowDeleteModal(false);
      setDeletingStudent(null);
      setConfirmAcknowledge(false);
      await loadStudents();
    } catch (err: any) {
      console.error('Error deleting student:', err);
      toast.error('Failed to delete student: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const groupedByClass = filtered.reduce((acc, s) => {
    if (!acc[s.class]) acc[s.class] = [];
    acc[s.class].push(s);
    return acc;
  }, {} as Record<string, Student[]>);

  const sortedClasses = Object.keys(groupedByClass).sort((a,b) => parseInt(a) - parseInt(b));
  
  const distinctArchivedSessions = [...new Set(students.filter(s => !s.active).map(s => s.session || getCurrentSession()))].sort().reverse();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-sub">{students.filter(s => s.active !== false).length} active, {students.filter(s => !s.active).length} archived</p>
        </div>
        <button id="add-student-btn" className="btn-primary" onClick={() => { setEditingStudentId(null); setForm(EMPTY_FORM); setSubjects([]); setShowModal(true); }}>
          <UserPlus size={18} /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={16} />
          <input
            id="student-search"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${!showArchived ? 'active' : ''}`} onClick={() => setShowArchived(false)}>
            Active
          </button>
          <button className={`tab-btn ${showArchived ? 'active' : ''}`} onClick={() => setShowArchived(true)}>
            Archived
          </button>
        </div>
      </div>

      {/* Accordion List */}
      <div className="card mb-16">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="section-title mb-0">Class-wise Students</h2>
          {showArchived && (
            <select className="input" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.9rem' }} value={archivedSessionFilter} onChange={e => setArchivedSessionFilter(e.target.value)}>
              <option value="">All Sessions</option>
              {distinctArchivedSessions.map(sess => (
                <option key={sess} value={sess}>{sess}</option>
              ))}
            </select>
          )}
        </div>
        {loading ? (
          <div className="skeleton-list" style={{ padding: 24 }}>{[1,2,3,4,5].map(i=><div key={i} className="skeleton-row tall"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <UserPlus size={40} />
            <p>No students found</p>
          </div>
        ) : (
          <div className="accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedClasses.map(cls => (
              <div key={cls} className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div 
                  className="accordion-header" 
                  onClick={() => toggleClass(cls)}
                  style={{ padding: '16px', background: expandedClasses[cls] ? 'var(--bg)' : 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Class {cls}
                    <span className="badge badge-gray ml-auto" style={{ marginLeft: 8 }}>
                      {groupedByClass[cls].length} students
                    </span>
                  </div>
                  {expandedClasses[cls] ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
                </div>
                
                {expandedClasses[cls] && (
                  <div className="accordion-body" style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div className="table-wrap" style={{ border: '1px solid var(--border-light)', borderRadius: 8 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ paddingLeft: '24px' }}>Name</th>
                            <th>Section</th>
                            <th>Subjects</th>
                            <th>Fee (₹/mo)</th>
                            <th>Joined</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedByClass[cls].map(s => (
                            <tr key={s.id}>
                              <td style={{ paddingLeft: '24px' }}>
                                <Link to={`/teacher/students/${s.id}`} className="table-student" style={{ textDecoration: 'none', color: 'inherit' }}>
                                  <div className="student-avatar sm">{s.name.charAt(0)}</div>
                                  <div>
                                    <div className="fw-600 hover-primary">{s.name}</div>
                                    <div className="text-muted text-sm">{s.school}</div>
                                  </div>
                                </Link>
                              </td>
                              <td>{s.section || '—'}</td>
                              <td>
                                <div className="student-subjects mt-8" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {s.subjects?.map(sub => (
                                    <span key={sub} className="badge badge-gray">{formatSubjects([sub])}</span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {showFees[s.id] ? `₹${s.confirmedFee?.toLocaleString()}` : '₹ ****'}
                                  <button onClick={() => toggleFee(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                                    {showFees[s.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                  </button>
                                </div>
                              </td>
                              <td>{s.joiningDate ? format(s.joiningDate.toDate(), 'dd MMM yyyy') : '—'}</td>
                              <td>
                                <span
                                  className={`badge cursor-pointer ${s.active ? 'badge-green' : 'badge-gray'}`}
                                  onClick={() => {
                                    if (s.active) {
                                      setArchivingStudent(s);
                                      const now = new Date();
                                      setLeavingMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                                      setShowArchiveModal(true);
                                    } else {
                                      confirm(`Are you sure you want to unarchive this student?`, () => {
                                        toggleActive(s, null);
                                      });
                                    }
                                  }}
                                  title="Click to toggle status"
                                >
                                  {s.active ? 'Active' : 'Archived'}
                                </span>
                              </td>
                              <td>
                                <div className="action-btns">
                                  {s.active && (
                                    <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit">
                                      <Pencil size={16} />
                                    </button>
                                  )}
                                  <button className="icon-btn" onClick={() => duplicateStudent(s)} title="Duplicate">
                                    <Copy size={16} />
                                  </button>
                                  {s.active && (
                                    <button className="icon-btn text-blue" onClick={() => {
                                      setPromotingStudent(s);
                                      setPromoteForm({
                                        action: 'promote',
                                        newClass: String(parseInt(s.class) + 1),
                                        newSession: getNextSession(s.session || getCurrentSession())
                                      });
                                      setShowPromoteModal(true);
                                    }} title="Promote / Retain">
                                      <GraduationCap size={16} />
                                    </button>
                                  )}
                                  <Link to={`/teacher/students/${s.id}`} className="icon-btn" title="View">
                                    <Eye size={16} />
                                  </Link>
                                  <button
                                    className="icon-btn danger"
                                    onClick={() => {
                                      setDeletingStudent(s);
                                      setConfirmAcknowledge(false);
                                      setShowDeleteModal(true);
                                    }}
                                    title="Delete Student"
                                    style={{ color: 'var(--red, #ef4444)' }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingStudentId ? 'Edit Student' : 'Add New Student'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input id="student-name" type="text" placeholder="Student name" value={form.name} onChange={set('name')} required />
                </div>
                <div className="form-group">
                  <label>Class *</label>
                  <select id="student-class" value={form.class} onChange={set('class')} required>
                    <option value="">Select class</option>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <select value={form.section} onChange={set('section')}>
                    <option value="">No section</option>
                    {masterSections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Session</label>
                  <select value={form.session} onChange={set('session')}>
                    {sessions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>School *</label>
                  <select value={form.school} onChange={set('school')} required>
                    <option value="">Select school</option>
                    {masterSchools.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Student Phone</label>
                  <input type="tel" placeholder="Phone number" value={form.phone} onChange={set('phone')} />
                </div>
                <div className="form-group">
                  <label>Parent Phone</label>
                  <input type="tel" placeholder="Parent phone" value={form.parentPhone} onChange={set('parentPhone')} />
                </div>
                <div className="form-group">
                  <label>Confirmed Monthly Fee (₹) *</label>
                  <input id="student-fee" type="number" placeholder="e.g. 1500" value={form.confirmedFee} onChange={set('confirmedFee')} required />
                </div>
                <div className="form-group">
                  <label>Date of Joining</label>
                  <input type="date" value={form.joiningDate} onChange={set('joiningDate')} />
                </div>
                <div className="form-group">
                  <label>Login Email <span className="text-muted" style={{fontWeight:400}}>(optional — for student app access)</span></label>
                  <input id="student-email" type="email" placeholder="student@email.com" value={form.email} onChange={set('email')} />
                </div>
                <div className="form-group">
                  <label>Temp Password <span className="text-muted" style={{fontWeight:400}}>(optional — min 6 chars)</span></label>
                  <input id="student-password" type="text" placeholder="Leave blank if no login needed" value={form.tempPassword} onChange={set('tempPassword')} minLength={form.tempPassword ? 6 : undefined} />
                </div>
              </div>

              {/* Subjects */}
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

              {/* Notes */}
              <div className="form-group">
                <label>Notes</label>
                <textarea placeholder="Any special notes about this student…" value={form.notes} onChange={set('notes') as React.ChangeEventHandler<HTMLTextAreaElement>} rows={3} />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button id="save-student-btn" type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : (editingStudentId ? <Pencil size={16} /> : <UserPlus size={16} />)}
                  {saving ? 'Saving…' : (editingStudentId ? 'Update Student' : 'Create Student')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promote Modal */}
      {showPromoteModal && promotingStudent && (
        <div className="modal-overlay" onClick={() => setShowPromoteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Promote/Retain Student</h2>
              <button className="modal-close" onClick={() => setShowPromoteModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handlePromote} className="modal-body">
              <div className="mb-4 text-sm" style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                <strong>{promotingStudent.name}</strong> is currently in <strong>Class {promotingStudent.class}</strong> (Session: {promotingStudent.session || getCurrentSession()})
              </div>
              <div className="form-group mb-4">
                <label>Action</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 500, padding: '12px 16px', background: promoteForm.action === 'promote' ? 'var(--primary-light, #e0f2fe)' : 'var(--surface-2)', borderRadius: '8px', border: promoteForm.action === 'promote' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                    <input type="radio" name="action" value="promote" checked={promoteForm.action === 'promote'} onChange={() => setPromoteForm({...promoteForm, action: 'promote'})} style={{ width: 'auto', margin: 0 }} />
                    <span style={{ color: promoteForm.action === 'promote' ? 'var(--primary-dark, #0369a1)' : 'var(--text)' }}>Promote to Next Class</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 500, padding: '12px 16px', background: promoteForm.action === 'retain' ? 'var(--primary-light, #e0f2fe)' : 'var(--surface-2)', borderRadius: '8px', border: promoteForm.action === 'retain' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                    <input type="radio" name="action" value="retain" checked={promoteForm.action === 'retain'} onChange={() => setPromoteForm({...promoteForm, action: 'retain'})} style={{ width: 'auto', margin: 0 }} />
                    <span style={{ color: promoteForm.action === 'retain' ? 'var(--primary-dark, #0369a1)' : 'var(--text)' }}>Retain in Same Class</span>
                  </label>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>New Class</label>
                  <select value={promoteForm.newClass} onChange={e => setPromoteForm({...promoteForm, newClass: e.target.value})} required>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>New Session</label>
                  <select value={promoteForm.newSession} onChange={e => setPromoteForm({...promoteForm, newSession: e.target.value})} required>
                    {sessions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPromoteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && archivingStudent && (
        <div className="modal-overlay" onClick={() => setShowArchiveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Archive Student</h2>
              <button className="modal-close" onClick={() => setShowArchiveModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>Please select the month <strong>{archivingStudent.name}</strong> stopped attending.</p>
              <p className="text-sm text-gray mb-4">Fees for months <strong>after</strong> this will be greyed out.</p>
              <div className="form-group">
                <label>Month of Leaving</label>
                <input type="month" value={leavingMonth} onChange={e => setLeavingMonth(e.target.value)} required />
              </div>
              <div className="modal-footer mt-4">
                <button className="btn btn-secondary" onClick={() => setShowArchiveModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  toggleActive(archivingStudent, leavingMonth);
                  setShowArchiveModal(false);
                }}>Archive</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingStudent && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <AlertTriangle size={20} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#b91c1c' }}>Delete Student Permanently</h2>
              </div>
              {!isDeleting && (
                <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="modal-body" style={{ paddingTop: '16px' }}>
              <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #ef4444' }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text)' }}>
                  {deletingStudent.name}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Class {deletingStudent.class} {deletingStudent.section ? `(${deletingStudent.section})` : ''} • {deletingStudent.school} • Session {deletingStudent.session || getCurrentSession()}
                </div>
              </div>

              <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>
                ⚠️ Warning: This action is permanent and cannot be undone!
              </p>
              
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                Deleting this student will completely erase all associated records from everywhere across the database, including:
              </p>

              <ul style={{ fontSize: '0.85rem', color: 'var(--text)', paddingLeft: '20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <li>Student profile & app login authentication account</li>
                <li>All fee payments, history & receipts</li>
                <li>All attendance logs & punch timings</li>
                <li>Tuition test marks & scorecards</li>
                <li>School exam results & marks</li>
                <li>Syllabus completion progress & topics</li>
                <li>Timetable & weekly schedule slots</li>
                <li>Homework completions & event attendees</li>
              </ul>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3', cursor: isDeleting ? 'not-allowed' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmAcknowledge}
                  onChange={e => setConfirmAcknowledge(e.target.checked)}
                  disabled={isDeleting}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', color: '#9f1239', fontWeight: 500, lineHeight: 1.4 }}>
                  I understand that all records for <strong>{deletingStudent.name}</strong> will be permanently wiped out from everywhere and cannot be recovered.
                </span>
              </label>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={!confirmAcknowledge || isDeleting}
                onClick={handleDeleteStudent}
              >
                {isDeleting ? (
                  <>
                    <span className="btn-spinner" style={{ width: 14, height: 14 }} />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Student</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
