import { useState, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, query, orderBy, Timestamp, collectionGroup
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, FeePayment, PaymentMode } from '../../types';
import { getFeeForMonth } from '../../utils/feeUtils';
import { Plus, X, Printer, Share2, Receipt, Pencil, Eye, EyeOff, ChevronDown, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import logo from '../../assets/logo.png';

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'PhonePe', 'Google Pay', 'Paytm', 'Online', 'Waived / Leave'];

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
    const receiptRef = useRef<HTMLDivElement>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState([{
    id: Date.now().toString(),
    mode: 'Cash' as PaymentMode,
    datePaid: new Date().toISOString().split('T')[0],
    monthInput: new Date().toISOString().slice(0,7),
    monthsPaid: [] as string[],
  }]);
  const [saving, setSaving] = useState(false);
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [showPaymentAmounts, setShowPaymentAmounts] = useState<Record<string, boolean>>({});
  const [showDueModal, setShowDueModal] = useState(false);
  const [isStudentLocked, setIsStudentLocked] = useState(false);

  const [viewMode, setViewMode] = useState<'student' | 'master' | 'history'>('master');
  const [historyMonth, setHistoryMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [masterYear, setMasterYear] = useState<number>(new Date().getFullYear());
  const [allPayments, setAllPayments] = useState<Record<string, FeePayment[]>>({});
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const loadMasterData = async () => {
    setLoadingMaster(true);
    try {
      const all: Record<string, FeePayment[]> = {};
      const snap = await getDocs(collectionGroup(db, 'payments'));
      snap.docs.forEach(d => {
        const studentId = d.ref.parent.parent?.id;
        if (studentId) {
          if (!all[studentId]) all[studentId] = [];
          all[studentId].push({ id: d.id, ...d.data() } as FeePayment);
        }
      });
      setAllPayments(all);
    } finally {
      setLoadingMaster(false);
    }
  };

  useEffect(() => {
    if ((viewMode === 'master' || viewMode === 'history') && students.length > 0) {
      loadMasterData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, students]);

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

  const handleDueCellClick = (studentId: string, monthStr: string) => {
    setSelectedStudent(studentId);
    setEditingPaymentId(null);
    setTransactions([{
      id: Date.now().toString(),
      mode: 'Cash',
      datePaid: new Date().toISOString().split('T')[0],
      monthInput: monthStr,
      monthsPaid: [monthStr]
    }]);
    setShowModal(true);
  };

  const addMonth = (txId: string) => {
    setTransactions(txs => txs.map(t => {
      if (t.id !== txId) return t;
      const m = t.monthInput;
      if (!m || t.monthsPaid.includes(m)) return t;
      return { ...t, monthsPaid: [...t.monthsPaid, m] };
    }));
  };

  const openEditModal = (p: FeePayment) => {
    setSelectedStudent(p.studentId);
    setIsStudentLocked(true);
    setEditingPaymentId(p.id);
    setTransactions([{
      id: p.id,
      mode: p.mode || 'Cash',
      datePaid: p.datePaid ? new Date(p.datePaid.toDate().getTime() - p.datePaid.toDate().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      monthInput: new Date().toISOString().slice(0,7),
      monthsPaid: p.monthsPaid || [],
    }]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPaymentId(null);
    setTransactions([{ id: Date.now().toString(), mode:'Cash', datePaid: new Date().toISOString().split('T')[0], monthInput: new Date().toISOString().slice(0,7), monthsPaid: [] }]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || transactions.some(t => t.monthsPaid.length === 0)) {
      toast.error('Fill all fields and add at least one month for each transaction'); return;
    }
    setSaving(true);
    const student = students.find(s => s.id === selectedStudent)!;
    try {
      if (editingPaymentId) {
        const t = transactions[0];
        const payment: Omit<FeePayment,'id'> = {
          studentId: selectedStudent,
          studentName: student.name,
          studentClass: student.class,
          amount: t.monthsPaid.reduce((sum, m) => sum + getFeeForMonth(m, student), 0),
          mode: t.mode,
          monthsPaid: t.monthsPaid,
          datePaid: Timestamp.fromDate(new Date(t.datePaid)),
        };
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'fees', selectedStudent, 'payments', editingPaymentId), payment);
        toast.success('Payment updated!');
      } else {
        const addedPayments = await Promise.all(transactions.map(async (t) => {
          const payment: Omit<FeePayment,'id'> = {
            studentId: selectedStudent,
            studentName: student.name,
            studentClass: student.class,
            amount: t.monthsPaid.reduce((sum, m) => sum + getFeeForMonth(m, student), 0),
            mode: t.mode,
            monthsPaid: t.monthsPaid,
            datePaid: Timestamp.fromDate(new Date(t.datePaid)),
          };
          const ref = await addDoc(collection(db,'fees',selectedStudent,'payments'), payment);
          return { id: ref.id, ...payment };
        }));
        
        toast.success(transactions.length === 1 ? 'Payment recorded!' : `${transactions.length} payments recorded!`);
        
        if (transactions.length === 1) {
          setCurrentReceipt(addedPayments[0]);
          setShowReceipt(true);
        }
      }
      
      closeModal();
      loadPayments(selectedStudent);
      if (viewMode === 'master') loadMasterData();
    } finally { setSaving(false); }
  };

  const student = students.find(s => s.id === selectedStudent);

  const shareReceipt = async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    canvas.toBlob(async blob => {
      if (!blob) return;
      const sName = currentReceipt?.studentName || student?.name || 'Student';
      const mPaid = currentReceipt?.monthsPaid?.map(formatMonthLabel).join(', ') || '';
      const shareText = `Fee Receipt - Tuition Plus - ${sName} (${mPaid})`;
      const filename = `Fee_Receipt_${sName.replace(/\s+/g, '_')}.png`;

      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareText, text: shareText });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        toast.success('Receipt downloaded!');
      }
    });
  };

  
  let monthsDueCount = 0;
  const dueMonthsList: string[] = [];
  
  if (student && student.joiningDate) {
    const joinDate = student.joiningDate.toDate();
    const currentDate = new Date();
    
    const uniquePaidMonths = new Set<string>();
    payments.forEach(p => {
      p.monthsPaid?.forEach(m => uniquePaidMonths.add(m));
    });
    
    // Calculate actual months due
    const startYear = joinDate.getFullYear();
    const startMonth = joinDate.getMonth();
    const endYear = currentDate.getFullYear();
    const endMonth = currentDate.getMonth();

    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m < endMonth)) {
      const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!uniquePaidMonths.has(monthStr)) {
        dueMonthsList.push(monthStr);
      }
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    monthsDueCount = dueMonthsList.length;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Fee Management
          </h1>
          <p className="page-sub">Track payments and generate receipts</p>
        </div>
        <button className="btn-primary" onClick={() => { 
          const isStudentView = viewMode === 'student' && !!selectedStudent;
          if (!isStudentView) setSelectedStudent(''); 
          setIsStudentLocked(isStudentView);
          setEditingPaymentId(null); 
          setTransactions([{ id: Date.now().toString(), mode:'Cash', datePaid: new Date().toISOString().split('T')[0], monthInput: new Date().toISOString().slice(0,7), monthsPaid: [] }]); 
          setShowModal(true); 
        }}>
          <Plus size={18}/> Record Payment
        </button>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: 16 }}>
        <div className="tabs">
          <button className={`tab-btn ${viewMode === 'master' ? 'active' : ''}`} onClick={() => setViewMode('master')}>
            Master View
          </button>
          <button className={`tab-btn ${viewMode === 'student' ? 'active' : ''}`} onClick={() => setViewMode('student')}>
            Student View
          </button>
          <button className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`} onClick={() => setViewMode('history')}>
            History
          </button>
        </div>
      </div>

      {viewMode === 'master' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Master Fee View</h2>
            <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
              <select value={masterYear} onChange={e => setMasterYear(Number(e.target.value))}>
                {[2023, 2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}-{y+1}</option>
                ))}
              </select>
            </div>
          </div>
          
          {loadingMaster ? (
            <div style={{ padding: '40px', textAlign: 'center' }}><span className="btn-spinner" style={{ borderColor: 'var(--navy)', borderTopColor: 'transparent', width: 24, height: 24 }}/></div>
          ) : (
            <div className="accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                const studentsByClass = students.reduce((acc, s) => {
                  const c = s.class || 'Other';
                  if (!acc[c]) acc[c] = [];
                  acc[c].push(s);
                  return acc;
                }, {} as Record<string, typeof students>);
                
                const classKeys = Object.keys(studentsByClass).sort((a, b) => {
                  if (a === 'Other') return 1;
                  if (b === 'Other') return -1;
                  return Number(a) - Number(b);
                });

                return classKeys.map(cls => {
                  const isExpanded = expandedClasses[cls] !== false;
                  return (
                  <div key={cls} className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div 
                      className="accordion-header" 
                      onClick={() => setExpandedClasses(prev => ({...prev, [cls]: !isExpanded}))}
                      style={{ padding: '16px', background: isExpanded ? 'var(--bg)' : 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Class {cls}
                      </div>
                      {isExpanded ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
                    </div>
                    {isExpanded && (
                    <div className="accordion-body" style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div className="table-wrap" style={{ border: '1px solid var(--border-light)', borderRadius: 8 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ minWidth: 110, background: 'var(--surface-2)', color: 'var(--text)', padding: '12px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left', position: 'sticky', left: 0, zIndex: 10, borderRight: '1px solid var(--border-light)' }}>Students</th>
                            {Array.from({length: 12}).map((_, i) => {
                              const d = new Date(masterYear, 2 + i);
                              return <th key={i} style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '12px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px' }}>{d.toLocaleString('en-US', {month:'short'})}</th>;
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {studentsByClass[cls].map(s => (
                            <tr key={s.id}>
                              <td 
                                style={{ background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, padding: '12px 16px', borderBottom: '1px solid var(--border-light)', position: 'sticky', left: 0, zIndex: 5, borderRight: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.2s' }}
                                onClick={() => { setSelectedStudent(s.id); setViewMode('student'); }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {s.name}
                                </div>
                              </td>
                              {Array.from({length: 12}).map((_, i) => {
                                const cellDate = new Date(masterYear, 2 + i);
                                const cellYear = cellDate.getFullYear();
                                const cellMonth = cellDate.getMonth() + 1;
                                const monthStr = `${cellYear}-${String(cellMonth).padStart(2, '0')}`;
                                const isBeforeJoining = s.joiningDate && s.joiningDate.toDate() > new Date(cellYear, cellMonth, 0); // End of month
                                const paymentsForStudent = allPayments[s.id] || [];
                                const matchingPayment = paymentsForStudent.find(p => p.monthsPaid?.includes(monthStr));
                                
                                let bgColor = '#e2e8f0'; // Slate-200 (before joining)
                                let text = '';
                                let subText = '';
                                let color = 'transparent';
                                let isDue = false;

                                if (!isBeforeJoining) {
                                  if (matchingPayment) {
                                    if (matchingPayment.mode === 'Waived / Leave') {
                                      bgColor = '#e2e8f0'; // Slate-200
                                      text = 'Leave';
                                      subText = '';
                                      color = '#64748b'; // Slate-500
                                      isDue = false;
                                    } else {
                                      text = matchingPayment.datePaid ? format(matchingPayment.datePaid.toDate(), 'dd-MMM') : 'Paid';
                                      subText = matchingPayment.mode;
                                      bgColor = matchingPayment.mode === 'Cash' ? '#10b981' : '#6366f1';
                                      color = '#ffffff';
                                    }
                                  } else {
                                    const now = new Date();
                                    const currYear = now.getFullYear();
                                    const currMonth = now.getMonth() + 1;
                                    const isFuture = cellYear > currYear || (cellYear === currYear && cellMonth >= currMonth);

                                    if (s.active === false && isFuture) {
                                      bgColor = '#e2e8f0'; // Slate-200 (Archived)
                                      color = 'transparent';
                                      isDue = false;
                                    } else if (isFuture) {
                                      bgColor = '#bae6fd'; // Sky-200 (Upcoming)
                                      color = '#0f172a';
                                      isDue = false;
                                    } else {
                                      bgColor = '#ef4444'; // Red-500 (Due)
                                      color = '#ffffff';
                                      isDue = true;
                                    }
                                  }
                                }

                                return (
                                  <td 
                                    key={i} 
                                    onClick={isDue ? () => handleDueCellClick(s.id, monthStr) : undefined}
                                    style={{ background: bgColor, color, textAlign: 'center', padding: '8px 6px', borderBottom: '1px solid var(--border-light)', minWidth: '70px', whiteSpace: 'nowrap', cursor: isDue ? 'pointer' : 'default' }}
                                  >
                                    {text && <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: subText ? '2px' : '0' }}>{text}</div>}
                                    {subText && <div style={{ fontSize: '10px', opacity: 0.9, background: 'rgba(0,0,0,0.2)', display: 'inline-block', padding: '2px 6px', borderRadius: '12px' }}>{subText}</div>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </div>
                    )}
                  </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {viewMode === 'student' && (
        <>

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
                <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(() => {
                    const currentMStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    const currentFee = student ? getFeeForMonth(currentMStr, student) : 0;
                    return showConfirmed ? `₹${currentFee.toLocaleString()}/mo` : '₹****';
                  })()}
                  <button onClick={() => setShowConfirmed(!showConfirmed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                    {showConfirmed ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="stat-label">Confirmed Fee</div>
              </div>
            </div>
            <div className="stat-card stat-red" onClick={() => setShowDueModal(true)} style={{ cursor: 'pointer' }}>
              <div className="stat-icon"><Receipt size={20}/></div>
              <div className="stat-body">
                <div className="stat-value">{monthsDueCount}</div>
                <div className="stat-label">Months Due</div>
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
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Months Paid</th>
                      <th>Mode</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td>{p.datePaid ? format(p.datePaid.toDate(),'dd MMM yyyy') : '—'}</td>
                        <td className="fw-600">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {showPaymentAmounts[p.id!] ? `₹${p.amount?.toLocaleString()}` : '₹****'}
                            <button onClick={() => setShowPaymentAmounts(prev => ({ ...prev, [p.id!]: !prev[p.id!] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                              {showPaymentAmounts[p.id!] ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        </td>
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
              <div className="form-group">
                <label>Student *</label>
                {isStudentLocked ? (
                  <div className="fw-600" style={{ fontSize: 15, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {students.find(s => s.id === selectedStudent)?.name || '—'} 
                    <span style={{color: 'var(--text-muted)', fontSize: 13, marginLeft: 8}}>
                      (Class {students.find(s => s.id === selectedStudent)?.class || '—'})
                    </span>
                  </div>
                ) : (
                  <select 
                    className="input" 
                    value={selectedStudent} 
                    onChange={e => setSelectedStudent(e.target.value)}
                    required
                  >
                    <option value="">Select a student...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                    ))}
                  </select>
                )}
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
                      <button type="button" className="btn-secondary" onClick={() => addMonth(t.id)}><Plus size={16}/> Add Month</button>
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

              {!editingPaymentId && (
                <button 
                  type="button" 
                  className="btn-ghost" 
                  style={{ width: '100%', marginBottom: 16, color: 'var(--primary)', border: '1px dashed var(--border)' }} 
                  onClick={() => setTransactions(txs => [...txs, { id: Date.now().toString(), mode: 'Cash', datePaid: new Date().toISOString().split('T')[0], monthInput: new Date().toISOString().slice(0,7), monthsPaid: [] }])}
                >
                  <Plus size={16}/> Add another transaction
                </button>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner"/> : null}
                  {saving ? 'Saving…' : (editingPaymentId ? 'Update Payment' : (transactions.length === 1 ? 'Record & Generate Receipt' : 'Record Payments'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'history' && (
        <div className="card">
          <div className="flex-between mb-16">
            <h3 className="section-title" style={{ marginBottom: 0 }}>Payment History</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Month:</label>
              <input 
                type="month" 
                className="input" 
                value={historyMonth} 
                onChange={e => setHistoryMonth(e.target.value)} 
                style={{ width: 'auto' }}
              />
            </div>
          </div>

          {loadingMaster ? (
            <div className="loader" style={{ margin: '40px auto' }} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Paid Via</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const activePayments = Object.entries(allPayments)
                      .filter(([sid]) => students.some(s => s.id === sid))
                      .flatMap(([_, pmts]) => pmts);

                    const filtered = activePayments.filter(p => {
                      if (!p.datePaid) return false;
                      const d = p.datePaid.toDate();
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      return `${yyyy}-${mm}` === historyMonth;
                    }).sort((a, b) => b.datePaid!.toMillis() - a.datePaid!.toMillis());

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="text-center text-muted" style={{ padding: '24px 0' }}>
                            No payments found in {formatMonthLabel(historyMonth + '-01')}.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map(p => (
                      <tr key={p.id}>
                        <td>{p.datePaid ? format(p.datePaid.toDate(), 'dd MMM yyyy') : '—'}</td>
                        <td className="fw-600">{p.studentName || '—'}</td>
                        <td>{p.studentClass || '—'}</td>
                        <td>{p.mode}</td>
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
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
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
                    <tr><td className="receipt-label">Month Paid</td><td>{currentReceipt.monthsPaid?.map(formatMonthLabel).join(', ')}</td></tr>
                    <tr><td className="receipt-label">Paid Via</td><td>{currentReceipt.mode}</td></tr>
                  </tbody>
                </table>
                <div className="receipt-address">
                  Pirtala Bulu Market below Pirtala Nursing Home | Few metres away from KECS
                </div>
                <div className="receipt-footer">
                  <div className="receipt-footer-brand">
                    <img src={logo} alt="logo" style={{width:30,height:30,objectFit:'contain'}}/>
                    <div>
                      <strong>TUITION PLUS</strong>
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

      {/* Due Months Modal */}
      {showDueModal && (
        <div className="modal-overlay" onClick={() => setShowDueModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Months Due</h2>
              <button className="modal-close" onClick={() => setShowDueModal(false)}><X size={20}/></button>
            </div>
            <div className="modal-body" style={{ padding: '24px 20px' }}>
              {dueMonthsList.length === 0 ? (
                <p className="text-muted" style={{ margin: 0 }}>No months are currently due.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {dueMonthsList.map(m => (
                    <span key={m} className="badge badge-red" style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '16px' }}>{formatMonthLabel(m)}</span>
                  ))}
                </div>
              )}
              <div className="modal-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: dueMonthsList.length > 2 && student?.parentPhone ? 'space-between' : 'flex-end' }}>
                 {dueMonthsList.length >= 2 && student?.parentPhone && (
                   <a 
                     href={`https://wa.me/${student.parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Dear Parent,\n\nThis is a gentle reminder that the tuition fees for ${student.name} are pending for the following months:\n${dueMonthsList.map(formatMonthLabel).join(', ')}.\n\nPlease clear the dues at your earliest convenience.\n\nThank you.`)}`} 
                     target="_blank" 
                     rel="noreferrer" 
                     className="btn-primary" 
                     style={{ background: '#25D366', borderColor: '#25D366', color: '#fff', textDecoration: 'none' }}
                   >
                     Send Reminder on WhatsApp
                   </a>
                 )}
                 <button className="btn-ghost" onClick={() => setShowDueModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
