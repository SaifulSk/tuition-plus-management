import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

interface Props {
  role: 'teacher' | 'student';
}

export default function AppLayout({ role }: Props) {
  return (
    <div className="app-layout">
      <Sidebar role={role} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
