import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CursorTrail } from '@/components/CursorTrail';
import { AetherLoader } from '@/components/AetherLoader';

// Auth Pages
import { LoginPage, SignupPage } from '@/pages/auth';

// Layouts
import { StudentLayout, InstructorLayout } from '@/components/layout';
import { AdminLayout } from '@/pages/admin';

// Student Pages
import { StudentDashboard, Lessons, Assessments, StudentQuizTaker, Laboratories, Portfolio, StudentQuizzes, Announcements, Chatbox, StudentSettings } from '@/pages/student';

// Instructor Pages
import { InstructorDashboard, UnitsManagement, ViewLesson, InstructorAssessments, CreateAssessment, QuizManagement, QuizMethodPicker, CreateQuiz, AutoGenerateQuiz, LaboratorySubmissions, LaboratoriesManagement, AnnouncementsManagement, InstructorMessages, InstructorSettings, StudentApprovals } from '@/pages/instructor';
import { InstructorApprovals } from '@/pages/admin';


export function App() {
  const { isAuthenticated, user, isHydrated, verifySession } = useAuthStore();

  // Verify session on app load
  useEffect(() => {
    verifySession();
  }, []);

  // Wait for auth state to hydrate from localStorage
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 aether-loading-screen"><AetherLoader /></div>
    );
  }

  return (
    <BrowserRouter>
      <CursorTrail />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Quiz Creation Routes (Full Page, No Layout) */}
        <Route
          path="/instructor/quiz/create"
          element={
            <ProtectedRoute requiredRole="instructor">
              <QuizMethodPicker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor/quiz/create-manual"
          element={
            <ProtectedRoute requiredRole="instructor">
              <CreateQuiz />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor/quiz/create-auto"
          element={
            <ProtectedRoute requiredRole="instructor">
              <AutoGenerateQuiz />
            </ProtectedRoute>
          }
        />

        {/* Student Routes with Layout */}
        <Route
          element={
            <ProtectedRoute requiredRole="student">
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/laboratories" element={<Laboratories />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/assessments" element={<Assessments />} />
          <Route path="/quizzes" element={<StudentQuizzes />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/chatbox" element={<Chatbox />} />
          <Route path="/settings" element={<StudentSettings />} />
          <Route path="/assessment/:id" element={<StudentQuizTaker />} />
        </Route>

        {/* Instructor Routes with Layout */}
        <Route
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
          <Route path="/instructor/courses" element={<UnitsManagement />} />
          <Route path="/instructor/lesson/:unitId/:lessonId" element={<ViewLesson />} />
          <Route path="/instructor/assessments" element={<InstructorAssessments />} />
          <Route path="/instructor/assessments/create" element={<CreateAssessment />} />
          <Route path="/instructor/quizzes" element={<QuizManagement />} />
          <Route path="/instructor/laboratory-submissions" element={<LaboratorySubmissions />} />
          <Route path="/instructor/laboratories" element={<LaboratoriesManagement />} />
          <Route path="/instructor/laboratories/create" element={<LaboratoriesManagement />} />
          <Route path="/instructor/announcements" element={<AnnouncementsManagement />} />
          <Route path="/instructor/messages" element={<InstructorMessages />} />
          <Route path="/instructor/settings" element={<InstructorSettings />} />
          <Route path="/instructor/student-approvals" element={<StudentApprovals />} />
          {/* Backward-compatible route */}
          <Route path="/instructor/canva-submissions" element={<LaboratorySubmissions />} />
        </Route>

        {/* Admin Routes with Layout */}
        <Route
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/instructors" element={<InstructorApprovals />} />
        </Route>

        {/* Default Route */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              user?.role === 'student' ? (
                <Navigate to="/dashboard" replace />
              ) : user?.role === 'admin' ? (
                <Navigate to="/admin/instructors" replace />
              ) : (
                <Navigate to="/instructor/dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* 404 Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
