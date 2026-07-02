import { useState, useEffect } from 'react';
import {
  collection, query, getDocs, addDoc, updateDoc,
  doc, orderBy, deleteDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../firebase/config';
import { setDoc } from 'firebase/firestore';
import { Search, Eye, EyeOff, X, UserPlus, ChevronDown, ChevronRight, Pencil, Copy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Student } from '../../types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import MultiSelect from '../../components/common/MultiSelect';
import { useConfirm } from '../../hooks/useConfirm';
import { getCurrentSession, getNextSession } from '../../utils/dateUtils';
import { GraduationCap } from 'lucide-react';

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
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);
  const [masterSchools, setMasterSchools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [showFees, setShowFees] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  
  // Archive State
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivingStudent, setArchivingStudent] = useState<Student | null>(null);
  const [leavingMonth, setLeavingMonth] = useState('');
  
  // Promotion State
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promotingStudent, setPromotingStudent] = useState<Student | null>(null);
  const [promoteForm, setPromoteForm] = useState({ action: 'promote', newClass: '', newSession: '' });

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
    getDocs(collection(db, 'subjects')).then(snap => {
      setMasterSubjects(snap.docs.map(d => d.data().name));
    });
    getDocs(collection(db, 'schools')).then(snap => {
      setMasterSchools(snap.docs.map(d => d.data().name));
    });
  }, []);

  useEffect(() => {
    let list = students.filter(s => showArchived ? !s.active : s.active !== false);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [search, students, showArchived]);

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

  const groupedByClass = filtered.reduce((acc, s) => {
    if (!acc[s.class]) acc[s.class] = [];
    acc[s.class].push(s);
    return acc;
  }, {} as Record<string, Student[]>);

  const sortedClasses = Object.keys(groupedByClass).sort((a,b) => parseInt(a) - parseInt(b));

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
        <h2 className="section-title mb-16">Class-wise Students</h2>
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
                                <div className="subject-chips">
                                  {s.subjects?.map(sub => (
                                    <span key={sub} className="chip">{sub}</span>
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
                                  <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit">
                                    <Pencil size={16} />
                                  </button>
                                  <button className="icon-btn" onClick={() => duplicateStudent(s)} title="Duplicate">
                                    <Copy size={16} />
                                  </button>
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
                                  <Link to={`/teacher/students/${s.id}`} className="icon-btn" title="View">
                                    <Eye size={16} />
                                  </Link>
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
                  <input type="text" placeholder="A / B / C" value={form.section} onChange={set('section')} />
                </div>
                <div className="form-group">
                  <label>Session</label>
                  <select value={form.session} onChange={set('session')}>
                    {['2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029'].map(s => <option key={s} value={s}>{s}</option>)}
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
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="action" value="promote" checked={promoteForm.action === 'promote'} onChange={e => setPromoteForm({...promoteForm, action: 'promote'})} />
                    Promote to Next Class
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="action" value="retain" checked={promoteForm.action === 'retain'} onChange={e => setPromoteForm({...promoteForm, action: 'retain'})} />
                    Retain in Same Class
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
                    {['2024-2025','2025-2026','2026-2027','2026-2028','2028-2029','2029-2030'].map(s => <option key={s} value={s}>{s}</option>)}
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
      {ConfirmDialog}
    </div>
  );
}
