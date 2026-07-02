import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/layout/AuthGuard';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';

// Teacher pages
import TeacherDashboard from './pages/teacher/Dashboard';
import Students from './pages/teacher/Students';
import StudentDetail from './pages/teacher/StudentDetail';
import Schedule from './pages/teacher/Schedule';
import Fees from './pages/teacher/Fees';
import Syllabus from './pages/teacher/Syllabus';
import Tests from './pages/teacher/Tests';
import SchoolExams from './pages/teacher/SchoolExams';
import TeacherHomework from './pages/teacher/Homework';
import Events from './pages/teacher/Events';
import SubjectsMaster from './pages/teacher/SubjectsMaster';
import SchoolsMaster from './pages/teacher/SchoolsMaster';
import ExamNamesMaster from './pages/teacher/ExamNamesMaster';
import SectionMaster from './pages/teacher/SectionMaster';

// Student pages
import StudentDashboard from './pages/student/Dashboard';
import StudentFees from './pages/student/Fees';
import StudentSyllabus from './pages/student/Syllabus';
import StudentResults from './pages/student/Results';
import StudentHomework from './pages/student/Homework';
import StudentEvents from './pages/student/Events';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/tuition-plus-management">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '10px',
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#C1121F', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Teacher routes */}
          <Route
            path="/teacher"
            element={
              <AuthGuard role="teacher">
                <AppLayout role="teacher" />
              </AuthGuard>
            }
          >
            <Route index element={<TeacherDashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentDetail />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="fees" element={<Fees />} />
            <Route path="syllabus" element={<Syllabus />} />
            <Route path="tests" element={<Tests />} />
            <Route path="exams" element={<SchoolExams />} />
            <Route path="homework" element={<TeacherHomework />} />
            <Route path="events" element={<Events />} />
            <Route path="subjects" element={<SubjectsMaster />} />
            <Route path="schools" element={<SchoolsMaster />} />
            <Route path="exam-names" element={<ExamNamesMaster />} />
            <Route path="sections" element={<SectionMaster />} />
          </Route>

          {/* Student routes */}
          <Route
            path="/student"
            element={
              <AuthGuard role="student">
                <AppLayout role="student" />
              </AuthGuard>
            }
          >
            <Route index element={<StudentDashboard />} />
            <Route path="fees" element={<StudentFees />} />
            <Route path="syllabus" element={<StudentSyllabus />} />
            <Route path="results" element={<StudentResults />} />
            <Route path="homework" element={<StudentHomework />} />
            <Route path="events" element={<StudentEvents />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
