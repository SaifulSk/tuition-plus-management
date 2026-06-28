import { useState, useEffect } from 'react';
import {
  collection, query, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { setDoc } from 'firebase/firestore';
import { Search, Plus, Trash2, Eye, EyeOff, X, UserPlus, ChevronDown, ChevronRight, Pencil, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Student } from '../../types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import MultiSelect from '../../components/common/MultiSelect';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const EMPTY_FORM = {
  name: '', class: '', section: '', school: '',
  phone: '', parentPhone: '', confirmedFee: '',
  joiningDate: new Date().toISOString().split('T')[0],
  notes: '', email: '', tempPassword: '',
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

  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [showFees, setShowFees] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);

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
    if (!form.name || !form.class || !form.school) {
      toast.error('Name, Class, and School are required'); return;
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
        });
        
        const s = students.find(x => x.id === editingStudentId);
        if (s?.uid) {
           await updateDoc(doc(db, 'users', s.uid), { name: form.name });
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
          const cred = await createUserWithEmailAndPassword(auth, form.email, form.tempPassword);
          uid = cred.user.uid;
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

  const toggleActive = async (s: Student) => {
    await updateDoc(doc(db, 'students', s.id), { active: !s.active });
    loadStudents();
    toast.success(`${s.name} marked ${!s.active ? 'active' : 'inactive'}`);
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
      <div className="card" style={{ padding: '0' }}>
        {loading ? (
          <div className="skeleton-list" style={{ padding: 24 }}>{[1,2,3,4,5].map(i=><div key={i} className="skeleton-row tall"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <UserPlus size={40} />
            <p>No students found</p>
          </div>
        ) : (
          <div className="accordion-container">
            {sortedClasses.map(cls => (
              <div key={cls} className="accordion-class-group">
                <div 
                  className="accordion-header" 
                  onClick={() => toggleClass(cls)}
                  style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', background: 'var(--surface-2)', fontWeight: 700 }}
                >
                  {expandedClasses[cls] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span style={{ marginLeft: 8 }}>Class {cls}</span>
                  <span className="badge badge-gray ml-auto">
                    {groupedByClass[cls].length} students
                  </span>
                </div>
                
                {expandedClasses[cls] && (
                  <div className="accordion-class-content" style={{ padding: '0' }}>
                    <div className="table-wrap" style={{ borderBottom: '1px solid var(--border-light)' }}>
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
                                <div className="table-student">
                                  <div className="student-avatar sm">{s.name.charAt(0)}</div>
                                  <div>
                                    <div className="fw-600">{s.name}</div>
                                    <div className="text-muted text-sm">{s.school}</div>
                                  </div>
                                </div>
                              </td>
                              <td>{s.section || '—'}</td>
                              <td>
                                <div className="subject-chips">
                                  {s.subjects?.slice(0,3).map(sub => (
                                    <span key={sub} className="chip">{sub}</span>
                                  ))}
                                  {s.subjects?.length > 3 && <span className="chip muted">+{s.subjects.length-3}</span>}
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
                                    if (window.confirm(`Are you sure you want to ${s.active ? 'archive' : 'unarchive'} this student?`)) {
                                      toggleActive(s);
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
                {!editingStudentId && (
                  <>
                    <div className="form-group">
                      <label>Login Email <span className="text-muted" style={{fontWeight:400}}>(optional — for student app access)</span></label>
                      <input id="student-email" type="email" placeholder="student@email.com" value={form.email} onChange={set('email')} />
                    </div>
                    <div className="form-group">
                      <label>Temp Password <span className="text-muted" style={{fontWeight:400}}>(optional — min 6 chars)</span></label>
                      <input id="student-password" type="text" placeholder="Leave blank if no login needed" value={form.tempPassword} onChange={set('tempPassword')} minLength={form.tempPassword ? 6 : undefined} />
                    </div>
                  </>
                )}
              </div>

              {/* Subjects */}
              <div className="form-group">
                <label>Subjects</label>
                <MultiSelect 
                  options={masterSubjects}
                  selected={subjects}
                  onChange={setSubjects}
                  placeholder="Select subjects"
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
    </div>
  );
}
