import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Auth Pages
import { LoginPage, SignupPage } from '@/pages/auth';

// Layouts
import { StudentLayout, InstructorLayout } from '@/components/layout';

// Student Pages
import { StudentDashboard, Lessons, Assessments, StudentQuizTaker, Laboratories, Portfolio, StudentQuizzes, Announcements } from '@/pages/student';

// Instructor Pages
import { InstructorDashboard, UnitsManagement, ViewLesson, InstructorAssessments, CreateAssessment, QuizManagement, QuizMethodPicker, CreateQuiz, AutoGenerateQuiz, LaboratorySubmissions, LaboratoriesManagement, AnnouncementsManagement } from '@/pages/instructor';


export function App() {
  const { isAuthenticated, user, isHydrated, verifySession } = useAuthStore();

  // Verify session on app load
  useEffect(() => {
    verifySession();
  }, []);

  // Wait for auth state to hydrate from localStorage
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
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
          {/* Backward-compatible route */}
          <Route path="/instructor/canva-submissions" element={<LaboratorySubmissions />} />
        </Route>

        {/* Default Route */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              user?.role === 'student' ? (
                <Navigate to="/dashboard" replace />
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
