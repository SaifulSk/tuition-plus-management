import type { Student, TuitionTest } from '../../types';
import { X, ClipboardList, Award, Users, TrendingUp, Pencil, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useSubjects } from '../../hooks/useSubjects';

interface ViewTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: TuitionTest | null;
  students: Student[];
  onEdit?: (test: TuitionTest) => void;
}

const getMarksBadgeClass = (pct: number) => {
  if (pct >= 90) return 'badge-excel-dark-green';
  if (pct >= 71) return 'badge-excel-light-green';
  if (pct >= 51) return 'badge-excel-yellow';
  if (pct >= 31) return 'badge-excel-pink';
  return 'badge-excel-red';
};

export default function ViewTestModal({
  isOpen,
  onClose,
  test,
  students,
  onEdit,
}: ViewTestModalProps) {
  const { formatSubjects } = useSubjects();

  if (!isOpen || !test) return null;

  // Find all students who have a mark recorded for this test
  const marksEntries = Object.entries(test.studentMarks || {});
  
  // Create student results list
  const results = marksEntries
    .map(([studentId, mark]) => {
      const student = students.find(s => s.id === studentId);
      const studentName = student ? student.name : 'Unknown Student';
      const studentClass = student?.class || test.targetClass || '—';
      const pct = test.maxMarks > 0 ? Math.round((mark / test.maxMarks) * 100) : 0;
      return {
        studentId,
        student,
        studentName,
        studentClass,
        mark,
        pct,
      };
    })
    // Sort results by mark descending (highest first)
    .sort((a, b) => b.mark - a.mark);

  // Summary statistics
  const totalStudents = results.length;
  const marksArray = results.map(r => r.mark);
  const avgScore = totalStudents > 0 ? Math.round(marksArray.reduce((a, b) => a + b, 0) / totalStudents) : null;
  const avgPct = avgScore !== null && test.maxMarks > 0 ? Math.round((avgScore / test.maxMarks) * 100) : null;
  const highest = totalStudents > 0 ? results[0] : null;
  const lowest = totalStudents > 0 ? results[results.length - 1] : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'var(--navy-light, rgba(30, 58, 95, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ClipboardList size={20} color="var(--navy)" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{test.title}</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                {test.targetClass ? `Class ${test.targetClass} • ` : ''}
                {formatSubjects(test.subjects)} • Max Marks: {test.maxMarks}
                {test.date ? ` • ${format(test.date.toDate(), 'dd MMM yyyy')}` : ''}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          {/* Summary Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-muted)' }}>
                <Users size={14} color="var(--navy)" /> Appeared
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                {totalStudents} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>students</span>
              </div>
            </div>

            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-muted)' }}>
                <TrendingUp size={14} color="#00B050" /> Class Average
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                {avgScore !== null ? `${avgScore} / ${test.maxMarks}` : '—'}
                {avgPct !== null && (
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>
                    ({avgPct}%)
                  </span>
                )}
              </div>
            </div>

            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-muted)' }}>
                <Award size={14} color="#D97706" /> Highest Score
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                {highest ? `${highest.mark} / ${test.maxMarks}` : '—'}
              </div>
              {highest && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {highest.studentName}
                </div>
              )}
            </div>

            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={14} color="var(--text-muted)" /> Lowest Score
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                {lowest ? `${lowest.mark} / ${test.maxMarks}` : '—'}
              </div>
              {lowest && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lowest.studentName}
                </div>
              )}
            </div>
          </div>

          {/* Table of Students who took the test */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Students List ({totalStudents})
            </h3>
            {test.targetClass && (
              <span className="badge badge-blue">Class {test.targetClass}</span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px', background: 'var(--bg)', borderRadius: '10px' }}>
              <ClipboardList size={36} color="var(--text-light)" />
              <p style={{ marginTop: 8, fontSize: '14px' }}>No student marks recorded for this test.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Marks</th>
                    <th>Percentage</th>
                    <th style={{ textAlign: 'center' }}>Badge</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={r.studentId}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            background: 'var(--navy)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}>
                            {r.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{r.studentName}</div>
                            {r.student?.phone && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.student.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gray">Class {r.studentClass}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {r.mark} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>/ {test.maxMarks}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1,
                            height: 6,
                            background: 'var(--border)',
                            borderRadius: 3,
                            overflow: 'hidden',
                            maxWidth: 60,
                          }}>
                            <div style={{
                              width: `${Math.min(r.pct, 100)}%`,
                              height: '100%',
                              background: r.pct >= 70 ? '#00B050' : r.pct >= 50 ? '#f59e0b' : '#ef4444',
                              borderRadius: 3,
                            }} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.pct}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${getMarksBadgeClass(r.pct)}`}>
                          {r.pct >= 90 ? 'Outstanding' : r.pct >= 71 ? 'Good' : r.pct >= 51 ? 'Average' : r.pct >= 31 ? 'Below Avg' : 'Needs Help'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {onEdit && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  onClose();
                  onEdit(test);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Pencil size={15} /> Edit Test Marks
              </button>
            )}
          </div>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
