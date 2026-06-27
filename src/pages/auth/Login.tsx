import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, BookOpen, Shield } from 'lucide-react';
import { signIn, registerTeacher } from '../../firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.png';

type Mode = 'login' | 'register';

export default function Login() {
  const navigate = useNavigate();
  const { appUser, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  // Redirect once auth state is ready — fires on fresh login and on revisit
  useEffect(() => {
    if (!authLoading && appUser) {
      navigate(appUser.role === 'teacher' ? '/teacher' : '/student', { replace: true });
    }
  }, [appUser, authLoading, navigate]);

  // While Firebase is resolving the saved session, show a spinner instead of
  // flashing the login form at already-authenticated users.
  if (authLoading) {
    return (
      <div className="loading-screen" style={{ background: 'linear-gradient(135deg, #0f1923 0%, #1E3A5F 50%, #0f1923 100%)' }}>
        <div className="loader" />
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!form.name.trim()) { toast.error('Enter your name'); return; }
        await registerTeacher(form.email, form.password, form.name);
        toast.success('Account created! Welcome, ' + form.name);
        // Navigation handled by the useEffect above once appUser updates
      } else {
        await signIn(form.email, form.password);
        toast.success('Welcome back!');
        // Navigation handled by the useEffect above once appUser updates
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-circle c1" />
        <div className="login-bg-circle c2" />
        <div className="login-bg-circle c3" />
      </div>

      <div className="login-container">
        {/* Logo panel */}
        <div className="login-brand-panel">
          <img src={logo} alt="Tuition Plus" className="login-logo" />
          <h1 className="login-brand-title">TUITION PLUS</h1>
          <p className="login-brand-sub">Empowering Young Minds</p>
          <div className="login-brand-since">Since 2018</div>

          <div className="login-features">
            <div className="login-feature">
              <BookOpen size={18} />
              <span>Student Management</span>
            </div>
            <div className="login-feature">
              <GraduationCap size={18} />
              <span>Syllabus Tracking</span>
            </div>
            <div className="login-feature">
              <Shield size={18} />
              <span>Secure &amp; Private</span>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="login-form-panel">
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              className={`login-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              Register Teacher
            </button>
          </div>

          <h2 className="login-form-title">
            {mode === 'login' ? 'Welcome back!' : 'Create Teacher Account'}
          </h2>
          <p className="login-form-sub">
            {mode === 'login'
              ? 'Sign in to access your dashboard'
              : 'Register as the coaching center teacher'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            {mode === 'register' && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  id="register-name"
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={set('name')}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPwd(s => !s)}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn-primary btn-full"
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : null}
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="login-note">
              Students — use your credentials provided by the teacher.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
