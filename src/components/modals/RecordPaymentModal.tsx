import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getFeeForMonth } from '../../utils/feeUtils';
import type { Student, PaymentMode, FeePayment } from '../../types';
import { X, Wallet, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

function formatMonthLabel(mStr: string) {
  if (!mStr) return '';
  const [y, m] = mStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleString('default', { month: 'short', year: 'numeric' });
}

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export default function RecordPaymentModal({ isOpen, onClose, onSuccess, students }: RecordPaymentModalProps) {
  const [filterClass, setFilterClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [datePaid, setDatePaid] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [monthInput, setMonthInput] = useState(new Date().toISOString().slice(0, 7));
  const [monthsPaid, setMonthsPaid] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => s.active !== false && (!filterClass || s.class === filterClass));
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const addMonth = () => {
    if (!monthInput) return;
    if (monthsPaid.includes(monthInput)) {
      toast.error('Month already added');
      return;
    }
    setMonthsPaid(prev => [...prev, monthInput].sort());
  };

  const removeMonth = (m: string) => {
    setMonthsPaid(prev => prev.filter(x => x !== m));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }
    if (monthsPaid.length === 0) {
      toast.error('Please add at least one month');
      return;
    }
    if (!selectedStudent) return;

    setSaving(true);
    try {
      const payment: Omit<FeePayment, 'id'> = {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentClass: selectedStudent.class,
        amount: monthsPaid.reduce((sum, m) => sum + getFeeForMonth(m, selectedStudent), 0),
        mode,
        monthsPaid,
        datePaid: Timestamp.fromDate(new Date(datePaid)),
      };

      await addDoc(collection(db, 'fees', selectedStudent.id, 'payments'), payment);
      toast.success(`Payment recorded for ${selectedStudent.name}!`);
      
      // Reset form
      setMonthsPaid([]);
      setSelectedStudentId('');
      setFilterClass('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={20} color="var(--navy)" />
            <h2>Record Payment</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Filter by Class</label>
              <select 
                value={filterClass} 
                onChange={e => {
                  setFilterClass(e.target.value);
                  if (selectedStudent && e.target.value && selectedStudent.class !== e.target.value) {
                    setSelectedStudentId('');
                  }
                }}
              >
                <option value="">All Classes</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Student *</label>
              <select 
                value={selectedStudentId} 
                onChange={e => {
                  setSelectedStudentId(e.target.value);
                  const st = students.find(s => s.id === e.target.value);
                  if (st && !filterClass) setFilterClass(st.class);
                }} 
                required
              >
                <option value="">Select student</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Date Paid *</label>
              <input type="date" value={datePaid} onChange={e => setDatePaid(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Payment Mode *</label>
              <select value={mode} onChange={e => setMode(e.target.value as PaymentMode)}>
                {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Months Paid For *</label>
            <div className="month-picker-row">
              <input type="month" value={monthInput} onChange={e => setMonthInput(e.target.value)} />
              <button type="button" className="btn-secondary" onClick={addMonth}>
                <Plus size={16}/> Add Month
              </button>
            </div>
            <div className="subject-chips mt-8">
              {monthsPaid.map(m => (
                <span key={m} className="chip removable">
                  {formatMonthLabel(m)}
                  <button type="button" onClick={() => removeMonth(m)}>
                    <X size={12}/>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {selectedStudent && monthsPaid.length > 0 && (
            <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Total Calculated Fee:</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>
                ₹{monthsPaid.reduce((sum, m) => sum + getFeeForMonth(m, selectedStudent), 0).toLocaleString()}
              </span>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
