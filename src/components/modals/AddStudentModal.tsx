import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, setDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../firebase/config';
import { useSubjects } from '../../hooks/useSubjects';
import MultiSelect from '../common/MultiSelect';
import { X, UserPlus, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStudentModal({ isOpen, onClose, onSuccess }: AddStudentModalProps) {
  const { masterSubjects } = useSubjects();
  const [masterSchools, setMasterSchools] = useState<string[]>([]);
  const [masterSections, setMasterSections] = useState<string[]>(['A', 'B', 'C', 'D', 'E', 'F']);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    class: '',
    section: '',
    school: '',
    phone: '',
    parentPhone: '',
    confirmedFee: '',
    joiningDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    email: '',
    tempPassword: '',
    session: '2026-2027',
  });

  useEffect(() => {
    if (isOpen) {
      getDocs(query(collection(db, 'schools'), orderBy('name'))).then(snap => {
        setMasterSchools(snap.docs.map(d => d.data().name).filter(Boolean));
      }).catch(console.error);

      getDocs(query(collection(db, 'sections'), orderBy('name'))).then(snap => {
        const secs = snap.docs.map(d => d.data().name).filter(Boolean);
        if (secs.length > 0) setMasterSections(secs);
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.class || !form.school || subjects.length === 0) {
      toast.error('Name, Class, School, and Subjects are required');
      return;
    }

    if ((form.email && !form.tempPassword) || (!form.email && form.tempPassword)) {
      toast.error('Provide both email and password to enable student login, or leave both blank');
      return;
    }
    if (form.tempPassword && form.tempPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
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
            } catch {
              toast.error('This email is already registered. To link it, use its existing password or a different email.');
              setSaving(false);
              return;
            }
          } else {
            throw err;
          }
        }
      }

      const studentRef = await addDoc(collection(db, 'students'), {
        name: form.name.trim(),
        class: form.class,
        section: form.section.trim(),
        school: form.school.trim(),
        phone: form.phone.trim(),
        parentPhone: form.parentPhone.trim(),
        confirmedFee: Number(form.confirmedFee) || 0,
        joiningDate: Timestamp.fromDate(new Date(form.joiningDate)),
        notes: form.notes.trim(),
        subjects,
        email: form.email.trim(),
        uid,
        active: true,
        feeHistory: [],
        session: form.session,
      });

      if (uid) {
        await setDoc(doc(db, 'users', uid), {
          role: 'student',
          name: form.name.trim(),
          email: form.email.trim(),
          studentId: studentRef.id,
        });
      }

      toast.success(`${form.name} created successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={20} color="var(--navy)" />
            <h2>Add New Student</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Full Name *</label>
              <input type="text" placeholder="e.g. Rahul Sharma" value={form.name} onChange={set('name')} required />
            </div>

            <div className="form-group">
              <label>Class *</label>
              <select value={form.class} onChange={set('class')} required>
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
              <input type="number" placeholder="e.g. 1500" value={form.confirmedFee} onChange={set('confirmedFee')} required />
            </div>

            <div className="form-group">
              <label>Date of Joining</label>
              <input type="date" value={form.joiningDate} onChange={set('joiningDate')} />
            </div>

            <div className="form-group">
              <label>Login Email <span className="text-muted" style={{fontWeight:400}}>(optional — for student app access)</span></label>
              <input type="email" placeholder="student@email.com" value={form.email} onChange={set('email')} />
            </div>

            <div className="form-group">
              <label>Temp Password <span className="text-muted" style={{fontWeight:400}}>(optional — min 6 chars)</span></label>
              <div className="input-with-icon">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Leave blank if no login needed" 
                  value={form.tempPassword} 
                  onChange={set('tempPassword')} 
                  minLength={form.tempPassword ? 6 : undefined} 
                />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
          </div>

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

          <div className="form-group">
            <label>Notes</label>
            <textarea placeholder="Any special notes about this student…" value={form.notes} onChange={set('notes')} rows={3} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
