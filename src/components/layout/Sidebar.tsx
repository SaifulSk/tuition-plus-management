import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, Wallet, BookOpen,
  ClipboardList, BarChart3, PartyPopper, LogOut, GraduationCap,
  Menu, ChevronRight, Building, FileText
} from 'lucide-react';
import { signOut } from '../../firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import logo from '../../assets/logo.png';

const teacherLinks = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teacher/students', label: 'Students', icon: Users },
  { to: '/teacher/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/teacher/fees', label: 'Fees', icon: Wallet },
  { to: '/teacher/syllabus', label: 'Syllabus', icon: BookOpen },
  { to: '/teacher/tests', label: 'Tuition Tests', icon: ClipboardList },
  { to: '/teacher/exams', label: 'School Exams', icon: FileText },
  { to: '/teacher/events', label: 'Events', icon: PartyPopper },
  { to: '/teacher/subjects', label: 'Subjects Master', icon: BookOpen },
  { to: '/teacher/schools', label: 'Schools Master', icon: Building },
];

const studentLinks = [
  { to: '/student', label: 'My Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/fees', label: 'My Fees', icon: Wallet },
  { to: '/student/syllabus', label: 'My Syllabus', icon: BookOpen },
  { to: '/student/results', label: 'My Results', icon: BarChart3 },
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
  const links = role === 'teacher' ? teacherLinks : studentLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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
    </>
  );
}
