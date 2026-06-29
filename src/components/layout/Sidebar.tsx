import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, Wallet, BookOpen,
  ClipboardList, BarChart3, PartyPopper, LogOut, GraduationCap,
  Menu, ChevronRight, Building, FileText, Key, X
} from 'lucide-react';
import { signOut, changeUserPassword } from '../../firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.png';

const teacherLinks = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teacher/students', label: 'Students', icon: Users },
  { to: '/teacher/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/teacher/fees', label: 'Fees', icon: Wallet },
  { to: '/teacher/syllabus', label: 'Syllabus', icon: BookOpen },
  { to: '/teacher/tests', label: 'Tuition Tests', icon: ClipboardList },
  { to: '/teacher/exams', label: 'School Exams', icon: FileText },
  { to: '/teacher/homework', label: 'Homework', icon: BookOpen },
  { to: '/teacher/events', label: 'Events', icon: PartyPopper },
  { to: '/teacher/subjects', label: 'Subjects Master', icon: BookOpen },
  { to: '/teacher/schools', label: 'Schools Master', icon: Building },
];

const studentLinks = [
  { to: '/student', label: 'My Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/fees', label: 'My Fees', icon: Wallet },
  { to: '/student/syllabus', label: 'My Syllabus', icon: BookOpen },
  { to: '/student/results', label: 'My Results', icon: BarChart3 },
  { to: '/student/homework', label: 'My Homework', icon: BookOpen },
  { to: '/student/events', label: 'Events', icon: PartyPopper },
];

interface SidebarProps {
  role: 'teacher' | 'student';
}

export default function Sidebar({ role }: SidebarProps) {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const links = role === 'teacher' ? teacherLinks : studentLinks;

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsChangingPassword(true);
    try {
      await changeUserPassword(newPassword);
      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please sign out and sign in again to change your password');
      } else {
        toast.error(error.message);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-brand">
          <img src={logo} alt="Tuition Plus" className="sidebar-logo" />
          <span className="brand-name">TUITION PLUS</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={closeMobile} style={{ display: 'block' }} />}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          {(!collapsed || mobileOpen) && (
            <div className="sidebar-brand">
              <img src={logo} alt="Tuition Plus" className="sidebar-logo" />
              <div className="sidebar-brand-text">
                <span className="brand-name">TUITION PLUS</span>
                <span className="brand-sub">Empowering Young Minds</span>
              </div>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Role badge */}
        {(!collapsed || mobileOpen) && (
          <div className="sidebar-role-badge">
            <GraduationCap size={14} />
            <span>{role === 'teacher' ? 'Teacher Portal' : 'Student Portal'}</span>
          </div>
        )}

        {/* Nav links */}
        <nav className="sidebar-nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMobile}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed && !mobileOpen ? 'collapsed' : ''}`
              }
            >
              <Icon size={20} className="sidebar-icon" />
              {(!collapsed || mobileOpen) && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {(!collapsed || mobileOpen) && appUser && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {appUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{appUser.name}</span>
                <span className="sidebar-user-email">{appUser.email}</span>
              </div>
            </div>
          )}
          {role === 'teacher' && (
            <button
              className={`sidebar-action ${(collapsed && !mobileOpen) ? 'collapsed' : ''}`}
              onClick={() => setShowPasswordModal(true)}
              title="Change Password"
              style={{ marginBottom: '8px' }}
            >
              <Key size={18} />
              {(!collapsed || mobileOpen) && <span>Change Password</span>}
            </button>
          )}
          <button
            className={`sidebar-signout ${(collapsed && !mobileOpen) ? 'collapsed' : ''}`}
            onClick={handleSignOut}
            title="Sign Out"
          >
            <LogOut size={18} />
            {(!collapsed || mobileOpen) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                    placeholder="Enter new password (min 6 chars)"
                    required
                    minLength={6}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
