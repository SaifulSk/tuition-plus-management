import { useState, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, query, orderBy, where, Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, FeePayment, PaymentMode } from '../../types';
import { Plus, X, Printer, Share2, Receipt, Search, Pencil, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import logo from '../../assets/logo.png';

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'PhonePe', 'Google Pay', 'Paytm', 'Online'];

function formatMonthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo)-1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function Fees() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<FeePayment | null>(null);
  const [search, setSearch] = useState('');
  const receiptRef = useRef<HTMLDivElement>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '',
    mode: 'Cash' as PaymentMode,
    datePaid: new Date().toISOString().split('T')[0],
    monthInput: new Date().toISOString().slice(0,7),
    monthsPaid: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [showFees, setShowFees] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db,'students'), orderBy('name'))).then(snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Student));
    });
  }, []);

  const loadPayments = async (studentId: string) => {
    const snap = await getDocs(query(collection(db,'fees',studentId,'payments'), orderBy('datePaid','desc')));
    setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }) as FeePayment));
  };

  useEffect(() => {
    if (selectedStudent) loadPayments(selectedStudent);
    else setPayments([]);
  }, [selectedStudent]);

  const addMonth = () => {
    const m = form.monthInput;
    if (!m || form.monthsPaid.includes(m)) return;
    setForm(f => ({ ...f, monthsPaid: [...f.monthsPaid, m] }));
  };

  const openEditModal = (p: FeePayment) => {
    setEditingPaymentId(p.id);
    setForm({
      amount: p.amount?.toString() || '',
      mode: p.mode || 'Cash',
      datePaid: p.datePaid ? new Date(p.datePaid.toDate().getTime() - p.datePaid.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      monthInput: new Date().toISOString().slice(0,7),
      monthsPaid: p.monthsPaid || [],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPaymentId(null);
    setForm({ amount:'', mode:'Cash', datePaid: new Date().toISOString().split('T')[0], monthInput: new Date().toISOString().slice(0,7), monthsPaid: [] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !form.amount || form.monthsPaid.length === 0) {
      toast.error('Fill all fields and add at least one month'); return;
    }
    setSaving(true);
    const student = students.find(s => s.id === selectedStudent)!;
    try {
      const payment: Omit<FeePayment,'id'> = {
        studentId: selectedStudent,
        studentName: student.name,
        studentClass: student.class,
        amount: Number(form.amount),
        mode: form.mode,
        monthsPaid: form.monthsPaid,
        datePaid: Timestamp.fromDate(new Date(form.datePaid)),
      };
      
      let refId = '';
      if (editingPaymentId) {
        // Need to updateDoc instead of addDoc
        import('firebase/firestore').then(({ updateDoc, doc }) => {
           updateDoc(doc(db, 'fees', selectedStudent, 'payments', editingPaymentId), payment);
        });
        toast.success('Payment updated!');
        refId = editingPaymentId;
      } else {
        const ref = await addDoc(collection(db,'fees',selectedStudent,'payments'), payment);
        toast.success('Payment recorded!');
        refId = ref.id;
      }
      
      closeModal();
      loadPayments(selectedStudent);
      // Auto show receipt
      setCurrentReceipt({ id: refId, ...payment });
      setShowReceipt(true);
    } finally { setSaving(false); }
  };

  const shareReceipt = async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    canvas.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], 'fee-receipt.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Fee Receipt - Tuition Plus' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'fee-receipt.png'; a.click();
        toast.success('Receipt downloaded!');
      }
    });
  };

  const student = students.find(s => s.id === selectedStudent);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount||0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            Fee Management
            <button onClick={() => setShowFees(!showFees)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
              {showFees ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </h1>
          <p className="page-sub">Track payments and generate receipts</p>
        </div>
        {selectedStudent && (
          <button className="btn-primary" onClick={() => { setEditingPaymentId(null); setForm({ amount:'', mode:'Cash', datePaid: new Date().toISOString().split('T')[0], monthInput: new Date().toISOString().slice(0,7), monthsPaid: [] }); setShowModal(true); }}>
            <Plus size={18}/> Record Payment
          </button>
        )}
      </div>

      {/* Student selector */}
      <div className="card mb-16">
        <div className="form-group" style={{marginBottom:0}}>
          <label>Select Student</label>
          <select id="fees-student-select" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
            <option value="">— Choose a student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>)}
          </select>
        </div>
      </div>

      {!selectedStudent ? (
        <div className="empty-state"><Receipt size={48}/><p>Select a student to view fee history</p></div>
      ) : (
        <>
          {/* Summary */}
          <div className="stats-grid-sm">
            <div className="stat-card stat-blue">
              <div className="stat-icon"><Receipt size={20}/></div>
              <div className="stat-body">
                <div className="stat-value">{showFees ? `₹${student?.confirmedFee?.toLocaleString()}/mo` : '₹****'}</div>
                <div className="stat-label">Confirmed Fee</div>
              </div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-icon"><Receipt size={20}/></div>
              <div className="stat-body">
                <div className="stat-value">{showFees ? `₹${totalPaid.toLocaleString()}` : '₹****'}</div>
                <div className="stat-label">Total Collected</div>
              </div>
            </div>
            <div className="stat-card stat-purple">
              <div className="stat-icon"><Receipt size={20}/></div>
              <div className="stat-body">
                <div className="stat-value">{payments.length}</div>
                <div className="stat-label">Transactions</div>
              </div>
            </div>
          </div>

          {/* Payment history */}
          <div className="card">
            <h3 className="section-title">Payment History — {student?.name}</h3>
            {payments.length === 0 ? (
              <div className="empty-state"><Receipt size={32}/><p>No payments yet</p></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Amount</th><th>Months Paid</th><th>Mode</th><th>Receipt</th></tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td>{p.datePaid ? format(p.datePaid.toDate(),'dd MMM yyyy') : '—'}</td>
                        <td className="fw-600">{showFees ? `₹${p.amount?.toLocaleString()}` : '₹****'}</td>
                        <td>
                          <div className="subject-chips">
                            {p.monthsPaid?.map(m => <span key={m} className="chip">{formatMonthLabel(m)}</span>)}
                          </div>
                        </td>
                        <td><span className="badge badge-blue">{p.mode}</span></td>
                        <td>
                          <div className="action-btns">
                            <button
                              className="icon-btn"
                              title="Edit Payment"
                              onClick={() => openEditModal(p)}
                            >
                              <Pencil size={16}/>
                            </button>
                            <button
                              className="icon-btn"
                              title="View Receipt"
                              onClick={() => { setCurrentReceipt(p); setShowReceipt(true); }}
                            >
                              <Printer size={16}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Payment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input type="number" placeholder="e.g. 1500" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Date Paid *</label>
                  <input type="date" value={form.datePaid} onChange={e => setForm(f=>({...f,datePaid:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Payment Mode *</label>
                  <select value={form.mode} onChange={e => setForm(f=>({...f,mode:e.target.value as PaymentMode}))}>
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Months Paid For *</label>
                <div className="month-picker-row">
                  <input type="month" value={form.monthInput} onChange={e => setForm(f=>({...f,monthInput:e.target.value}))} />
                  <button type="button" className="btn-secondary" onClick={addMonth}><Plus size={16}/> Add Month</button>
                </div>
                <div className="subject-chips mt-8">
                  {form.monthsPaid.map(m => (
                    <span key={m} className="chip removable">
                      {formatMonthLabel(m)}
                      <button type="button" onClick={() => setForm(f=>({...f,monthsPaid:f.monthsPaid.filter(x=>x!==m)}))}>
                        <X size={12}/>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : null}
                  {saving ? 'Saving…' : (editingPaymentId ? 'Update Payment' : 'Record & Generate Receipt')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && currentReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(false)}>
          <div className="modal large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Fee Receipt</h2>
              <button className="modal-close" onClick={() => setShowReceipt(false)}><X size={20}/></button>
            </div>
            <div className="modal-body">
              {/* Receipt (html2canvas target) */}
              <div ref={receiptRef} className="receipt-card">
                <img src={logo} alt="Tuition Plus" className="receipt-logo" />
                <div className="receipt-title">FEES PAID</div>
                <div className="receipt-subtitle">Fees Payment Received</div>
                <table className="receipt-table">
                  <tbody>
                    <tr><td className="receipt-label">Student Name</td><td>{currentReceipt.studentName || student?.name}</td></tr>
                    <tr><td className="receipt-label">Class</td><td>{currentReceipt.studentClass || student?.class}</td></tr>
                    <tr><td className="receipt-label">Date Paid On</td><td>{currentReceipt.datePaid ? format(currentReceipt.datePaid.toDate(),'d MMMM yyyy') : '—'}</td></tr>
                    <tr><td className="receipt-label">Month Paid For</td><td>{currentReceipt.monthsPaid?.map(formatMonthLabel).join(', ')}</td></tr>
                    <tr><td className="receipt-label">Amount</td><td className="fw-600">₹{currentReceipt.amount?.toLocaleString()}</td></tr>
                    <tr><td className="receipt-label">Mode Of Payment</td><td>{currentReceipt.mode}</td></tr>
                  </tbody>
                </table>
                <div className="receipt-address">
                  Pirtala Bulu Market below Pirtala Nursing Home | Few metres away from KECS
                </div>
                <div className="receipt-footer">
                  <div className="receipt-footer-brand">
                    <img src={logo} alt="logo" style={{width:30,height:30,objectFit:'contain'}}/>
                    <div>
                      <strong>TUITION PLUS</strong><br/>
                      <small>Empowering Young Minds</small>
                    </div>
                  </div>
                  <div className="receipt-phone">8013753344</div>
                </div>
              </div>

              <div className="receipt-actions">
                <button className="btn-primary" onClick={shareReceipt}>
                  <Share2 size={18}/> Share / Download
                </button>
                <button className="btn-ghost" onClick={() => window.print()}>
                  <Printer size={18}/> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
