import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  role: 'teacher' | 'student';
}

export default function AuthGuard({ children, role }: Props) {
  const { currentUser, appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    );
  }

  if (!currentUser || !appUser) {
    return <Navigate to="/login" replace />;
  }

  if (appUser.role !== role) {
    return <Navigate to={appUser.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return <>{children}</>;
}
