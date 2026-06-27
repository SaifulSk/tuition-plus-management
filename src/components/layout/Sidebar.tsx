import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, Wallet, BookOpen,
  ClipboardList, BarChart3, PartyPopper, LogOut, GraduationCap,
  Menu, X, ChevronRight
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
  { to: '/teacher/events', label: 'Events', icon: PartyPopper },
  { to: '/teacher/subjects', label: 'Subjects Master', icon: BookOpen },
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
  const links = role === 'teacher' ? teacherLinks : studentLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && <div className="sidebar-overlay" onClick={() => setCollapsed(true)} />}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          {!collapsed && (
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
        {!collapsed && (
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
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`
              }
            >
              <Icon size={20} className="sidebar-icon" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!collapsed && appUser && (
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
            className={`sidebar-signout ${collapsed ? 'collapsed' : ''}`}
            onClick={handleSignOut}
            title="Sign Out"
          >
            <LogOut size={18} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
