import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getFeeForMonth } from '../../utils/feeUtils';
import type { Student, PaymentMode, FeePayment } from '../../types';
import { X, Wallet, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const PAYMENT_MODES: PaymentMode[] = ['Cash', 'PhonePe', 'Google Pay', 'Paytm', 'Online', 'Waived / Leave'];

function formatMonthLabel(mStr: string) {
  if (!mStr) return '';
  const [y, m] = mStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleString('default', { month: 'short', year: 'numeric' });
}

interface TransactionItem {
  id: string;
  mode: PaymentMode;
  datePaid: string;
  monthInput: string;
  monthsPaid: string[];
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
  const [transactions, setTransactions] = useState<TransactionItem[]>([
    {
      id: Date.now().toString(),
      mode: 'Cash',
      datePaid: new Date().toISOString().split('T')[0],
      monthInput: new Date().toISOString().slice(0, 7),
      monthsPaid: []
    }
  ]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => s.active !== false && (!filterClass || s.class === filterClass));
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const addMonth = (tId: string) => {
    setTransactions(txs => txs.map(t => {
      if (t.id === tId) {
        if (!t.monthInput) return t;
        if (t.monthsPaid.includes(t.monthInput)) {
          toast.error('Month already added');
          return t;
        }
        return {
          ...t,
          monthsPaid: [...t.monthsPaid, t.monthInput].sort()
        };
      }
      return t;
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || transactions.some(t => t.monthsPaid.length === 0)) {
      toast.error('Fill all fields and add at least one month for each transaction');
      return;
    }
    if (!selectedStudent) return;

    setSaving(true);
    try {
      await Promise.all(transactions.map(async (t) => {
        const payment: Omit<FeePayment, 'id'> = {
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          studentClass: selectedStudent.class,
          amount: t.monthsPaid.reduce((sum, m) => sum + getFeeForMonth(m, selectedStudent), 0),
          mode: t.mode,
          monthsPaid: t.monthsPaid,
          datePaid: Timestamp.fromDate(new Date(t.datePaid)),
        };
        return addDoc(collection(db, 'fees', selectedStudent.id, 'payments'), payment);
      }));

      toast.success(transactions.length === 1 ? 'Payment recorded!' : `${transactions.length} payments recorded!`);
      
      // Reset form
      setTransactions([{
        id: Date.now().toString(),
        mode: 'Cash',
        datePaid: new Date().toISOString().split('T')[0],
        monthInput: new Date().toISOString().slice(0, 7),
        monthsPaid: []
      }]);
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
                  if (selectedStudentId) {
                    const st = students.find(s => s.id === selectedStudentId);
                    if (st && e.target.value && st.class !== e.target.value) {
                      setSelectedStudentId('');
                    }
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
                <option value="">Select a student...</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                ))}
              </select>
            </div>
          </div>

          {transactions.map((t, idx) => (
            <div key={t.id} style={{ marginBottom: transactions.length > 1 ? 24 : 0, paddingBottom: transactions.length > 1 ? 24 : 0, borderBottom: transactions.length > 1 && idx < transactions.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
              {transactions.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, color: 'var(--navy)' }}>Transaction {idx + 1}</h4>
                  <button type="button" className="icon-btn danger" style={{ height: 'auto', padding: 4 }} onClick={() => setTransactions(txs => txs.filter(x => x.id !== t.id))}>
                    <X size={16}/>
                  </button>
                </div>
              )}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Date Paid *</label>
                  <input type="date" value={t.datePaid} onChange={e => setTransactions(txs => txs.map(x => x.id === t.id ? {...x,datePaid:e.target.value} : x))} required />
                </div>
                <div className="form-group">
                  <label>Payment Mode *</label>
                  <select value={t.mode} onChange={e => setTransactions(txs => txs.map(x => x.id === t.id ? {...x,mode:e.target.value as PaymentMode} : x))}>
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Months Paid For *</label>
                <div className="month-picker-row">
                  <input type="month" value={t.monthInput} onChange={e => setTransactions(txs => txs.map(x => x.id === t.id ? {...x,monthInput:e.target.value} : x))} />
                  <button type="button" className="btn-secondary" onClick={() => addMonth(t.id)}>
                    <Plus size={16}/> Add Month
                  </button>
                </div>
                <div className="subject-chips mt-8">
                  {t.monthsPaid.map(m => (
                    <span key={m} className="chip removable">
                      {formatMonthLabel(m)}
                      <button type="button" onClick={() => setTransactions(txs => txs.map(x => x.id === t.id ? {...x,monthsPaid:x.monthsPaid.filter(y=>y!==m)} : x))}>
                        <X size={12}/>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button 
            type="button" 
            className="btn-ghost" 
            style={{ width: '100%', marginBottom: 16, color: 'var(--primary)', border: '1px dashed var(--border)' }} 
            onClick={() => setTransactions(txs => [...txs, { id: Date.now().toString(), mode: 'Cash', datePaid: new Date().toISOString().split('T')[0], monthInput: new Date().toISOString().slice(0,7), monthsPaid: [] }])}
          >
            <Plus size={16}/> Add another transaction
          </button>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Recording...' : (transactions.length === 1 ? 'Record & Generate Receipt' : 'Record Payments')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
