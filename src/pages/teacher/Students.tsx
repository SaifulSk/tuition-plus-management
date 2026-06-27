import { useState, useEffect, useRef } from 'react';
import {
  collection, query, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { setDoc } from 'firebase/firestore';
import { Search, Plus, Trash2, Eye, X, UserPlus, ChevronDown, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Student } from '../../types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const EMPTY_FORM = {
  name: '', class: '', section: '', school: '',
  phone: '', parentPhone: '', confirmedFee: '',
  joiningDate: new Date().toISOString().split('T')[0],
  notes: '', email: '', tempPassword: '',
  subjectInput: '',
};

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
  }, []);

  useEffect(() => {
    let list = students;
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    if (classFilter) list = list.filter(s => s.class === classFilter);
    setFiltered(list);
  }, [search, classFilter, students]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const addSubject = () => {
    const s = form.subjectInput.trim();
    if (!s || subjects.includes(s)) return;
    setSubjects(p => [...p, s]);
    setForm(f => ({ ...f, subjectInput: '' }));
  };

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
      subjectInput: '',
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
    if (!form.name || !form.class) {
      toast.error('Name and Class are required'); return;
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
        // If one of email/password is filled but not the other, warn
        if ((form.email && !form.tempPassword) || (!form.email && form.tempPassword)) {
          toast.error('Provide both email and password to enable student login, or leave both blank'); return;
        }
        if (form.tempPassword && form.tempPassword.length < 6) {
          toast.error('Password must be at least 6 characters'); return;
        }

        let uid = '';
        // Only create Firebase Auth account if email + password are both provided
        if (form.email && form.tempPassword) {
          const cred = await createUserWithEmailAndPassword(auth, form.email, form.tempPassword);
          uid = cred.user.uid;
        }
        // Save student doc
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
        // Create user profile only if login credentials were provided
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-sub">{students.length} students enrolled</p>
        </div>
        <button id="add-student-btn" className="btn-primary" onClick={() => { setEditingStudentId(null); setForm(EMPTY_FORM); setSubjects([]); setShowModal(true); }}>
          <UserPlus size={18} /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            id="student-search"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          id="class-filter"
          className="select-filter"
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
        >
          <option value="">All Classes</option>
          {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="skeleton-list">{[1,2,3,4,5].map(i=><div key={i} className="skeleton-row tall"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <UserPlus size={40} />
            <p>No students found</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Subjects</th>
                  <th>Fee (₹/mo)</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="table-student">
                        <div className="student-avatar sm">{s.name.charAt(0)}</div>
                        <div>
                          <div className="fw-600">{s.name}</div>
                          <div className="text-muted text-sm">{s.school}</div>
                        </div>
                      </div>
                    </td>
                    <td>Class {s.class}{s.section && ` - ${s.section}`}</td>
                    <td>
                      <div className="subject-chips">
                        {s.subjects?.slice(0,3).map(sub => (
                          <span key={sub} className="chip">{sub}</span>
                        ))}
                        {s.subjects?.length > 3 && <span className="chip muted">+{s.subjects.length-3}</span>}
                      </div>
                    </td>
                    <td>₹{s.confirmedFee?.toLocaleString()}</td>
                    <td>{s.joiningDate ? format(s.joiningDate.toDate(), 'dd MMM yyyy') : '—'}</td>
                    <td>
                      <span
                        className={`badge cursor-pointer ${s.active ? 'badge-green' : 'badge-red'}`}
                        onClick={() => toggleActive(s)}
                        title="Click to toggle"
                      >
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit">
                          <Pencil size={16} />
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
                  <label>School</label>
                  <input type="text" placeholder="School name" value={form.school} onChange={set('school')} />
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
                <div className="subject-input-row">
                  <select
                    value={form.subjectInput}
                    onChange={set('subjectInput')}
                  >
                    <option value="">Select a subject</option>
                    {masterSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" className="btn-secondary" onClick={addSubject} disabled={!form.subjectInput}>
                    <Plus size={16} /> Add
                  </button>
                </div>
                <div className="subject-chips mt-8">
                  {subjects.map(s => (
                    <span key={s} className="chip removable">
                      {s}
                      <button type="button" onClick={() => setSubjects(p => p.filter(x => x !== s))}><X size={12} /></button>
                    </span>
                  ))}
                </div>
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
