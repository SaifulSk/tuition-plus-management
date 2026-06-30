import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Student, FeePayment } from '../../types';
import { Receipt, Share2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import logo from '../../assets/logo.png';
import toast from 'react-hot-toast';

function formatMonthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo)-1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function StudentFees() {
  const { appUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<FeePayment[]>([]);
  const [currentReceipt, setCurrentReceipt] = useState<FeePayment | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const userDoc = await getDoc(doc(db, 'users', appUser!.uid));
      const sid = userDoc.data()?.studentId;
      if (!sid) { setLoading(false); return; }
      const sSnap = await getDoc(doc(db, 'students', sid));
      if (sSnap.exists()) setStudent({ id: sSnap.id, ...sSnap.data() } as Student);
      const fSnap = await getDocs(query(collection(db,'fees',sid,'payments'), orderBy('datePaid','desc')));
      setFees(fSnap.docs.map(d => ({ id: d.id, ...d.data() }) as FeePayment));
      setLoading(false);
    }
    load();
  }, [appUser]);

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
        const a = document.createElement('a'); a.href = url; a.download = 'fee-receipt.png'; a.click();
        toast.success('Receipt downloaded!');
      }
    });
  };

  const totalPaid = fees.reduce((sum, f) => sum + (f.amount || 0), 0);

  if (loading) return <div className="page"><div className="loader large" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Fee Payments</h1>
          <p className="page-sub">Your complete payment history</p>
        </div>
      </div>

      <div className="stats-grid-sm">
        <div className="stat-card stat-blue">
          <div className="stat-icon"><Receipt size={20}/></div>
          <div className="stat-body">
            <div className="stat-value">₹{student?.confirmedFee?.toLocaleString()}/mo</div>
            <div className="stat-label">Monthly Fee</div>
          </div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-icon"><Receipt size={20}/></div>
          <div className="stat-body">
            <div className="stat-value">₹{totalPaid.toLocaleString()}</div>
            <div className="stat-label">Total Paid</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Payment History</h3>
        {fees.length === 0 ? (
          <div className="empty-state"><Receipt size={32}/><p>No payments recorded yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Amount</th><th>Months</th><th>Mode</th><th>Receipt</th></tr></thead>
              <tbody>
                {fees.map(f => (
                  <tr key={f.id}>
                    <td>{f.datePaid ? format(f.datePaid.toDate(),'dd MMM yyyy') : '—'}</td>
                    <td className="fw-600">₹{f.amount?.toLocaleString()}</td>
                    <td>
                      <div className="subject-chips">
                        {f.monthsPaid?.map(m => <span key={m} className="chip">{formatMonthLabel(m)}</span>)}
                      </div>
                    </td>
                    <td><span className="badge badge-blue">{f.mode}</span></td>
                    <td>
                      <button className="icon-btn" onClick={() => setCurrentReceipt(f)} title="View Receipt">
                        <Printer size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt viewer */}
      {currentReceipt && (
        <div className="modal-overlay" onClick={() => setCurrentReceipt(null)}>
          <div className="modal large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Fee Receipt</h2>
              <button className="modal-close" onClick={() => setCurrentReceipt(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div ref={receiptRef} className="receipt-card">
                <img src={logo} alt="Tuition Plus" className="receipt-logo"/>
                <div className="receipt-title">FEES PAID</div>
                <div className="receipt-subtitle">Fees Payment Received</div>
                <table className="receipt-table">
                  <tbody>
                    <tr><td className="receipt-label">Student Name</td><td>{student?.name}</td></tr>
                    <tr><td className="receipt-label">Class</td><td>Class {student?.class}</td></tr>
                    <tr><td className="receipt-label">Date Paid On</td><td>{currentReceipt.datePaid ? format(currentReceipt.datePaid.toDate(),'d MMMM yyyy') : '—'}</td></tr>
                    <tr><td className="receipt-label">Month Paid</td><td>{currentReceipt.monthsPaid?.map(formatMonthLabel).join(', ')}</td></tr>
                    <tr><td className="receipt-label">Amount</td><td className="fw-600">₹{currentReceipt.amount?.toLocaleString()}</td></tr>
                    <tr><td className="receipt-label">Paid Via</td><td>{currentReceipt.mode}</td></tr>
                  </tbody>
                </table>
                <div className="receipt-address">Pirtala Bulu Market below Pirtala Nursing Home | Few metres away from KECS</div>
                <div className="receipt-footer">
                  <div className="receipt-footer-brand">
                    <img src={logo} alt="logo" style={{width:30,height:30,objectFit:'contain'}}/>
                    <div><strong>TUITION PLUS</strong><br/><small>Empowering Young Minds</small></div>
                  </div>
                  <div className="receipt-phone">8013753344</div>
                </div>
              </div>
              <div className="receipt-actions">
                <button className="btn-primary" onClick={shareReceipt}><Share2 size={18}/> Share / Download</button>
                <button className="btn-ghost" onClick={() => window.print()}><Printer size={18}/> Print</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
