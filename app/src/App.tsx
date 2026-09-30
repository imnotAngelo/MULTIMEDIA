import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AetherLoader } from '@/components/AetherLoader';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Layouts (Static for instant shell)
import { StudentLayout, InstructorLayout } from '@/components/layout';

// Auth Core Pages (Loaded directly for fastest TTFB)
import { LoginPage, SignupPage } from '@/pages/auth';

// Lazy Loaded Auth Secondary Pages
const AdminLoginPage = lazy(() => import('@/pages/auth/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const AdminSignupPage = lazy(() => import('@/pages/auth/AdminSignupPage').then((m) => ({ default: m.AdminSignupPage })));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const CheckEmailPage = lazy(() => import('@/pages/auth/CheckEmailPage').then((m) => ({ default: m.CheckEmailPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

// Lazy Loaded Student Pages
const StudentDashboard = lazy(() => import('@/pages/student/Dashboard').then((m) => ({ default: m.Dashboard })));
const Lessons = lazy(() => import('@/pages/student/Lessons').then((m) => ({ default: m.Lessons })));
const Laboratories = lazy(() => import('@/pages/student/Laboratories').then((m) => ({ default: m.Laboratories })));
const Portfolio = lazy(() => import('@/pages/student/Portfolio').then((m) => ({ default: m.Portfolio })));
const StudentQuizzes = lazy(() => import('@/pages/student/StudentQuizzes').then((m) => ({ default: m.StudentQuizzes })));
const StudentQuizTaker = lazy(() => import('@/pages/student/StudentQuizTaker').then((m) => ({ default: m.StudentQuizTaker })));
const Chatbox = lazy(() => import('@/pages/student/Chatbox').then((m) => ({ default: m.Chatbox })));
const StudentSettings = lazy(() => import('@/pages/student/Settings').then((m) => ({ default: m.StudentSettings })));

// Lazy Loaded Instructor Pages
const InstructorDashboard = lazy(() => import('@/pages/instructor/Dashboard').then((m) => ({ default: m.InstructorDashboard })));
const CoursesManagement = lazy(() => import('@/pages/instructor/CoursesManagement').then((m) => ({ default: m.CoursesManagement })));
const ViewLesson = lazy(() => import('@/pages/instructor/ViewLesson').then((m) => ({ default: m.ViewLesson })));
const InstructorAssessments = lazy(() => import('@/pages/instructor/AssessmentsManagement').then((m) => ({ default: m.InstructorAssessments })));
const CreateAssessment = lazy(() => import('@/pages/instructor/CreateAssessment').then((m) => ({ default: m.CreateAssessment })));
const QuizManagement = lazy(() => import('@/pages/instructor/QuizManagement').then((m) => ({ default: m.QuizManagement })));
const QuizMethodPicker = lazy(() => import('@/pages/instructor/QuizMethodPicker').then((m) => ({ default: m.QuizMethodPicker })));
const CreateQuiz = lazy(() => import('@/pages/instructor/CreateQuiz').then((m) => ({ default: m.CreateQuiz })));
const AutoGenerateQuiz = lazy(() => import('@/pages/instructor/AutoGenerateQuiz').then((m) => ({ default: m.AutoGenerateQuiz })));
const ExamDocument = lazy(() => import('@/pages/instructor/ExamDocument').then((m) => ({ default: m.ExamDocument })));
const LaboratorySubmissions = lazy(() => import('@/pages/instructor/LaboratorySubmissions').then((m) => ({ default: m.LaboratorySubmissions })));
const LaboratoriesManagement = lazy(() => import('@/pages/instructor/LaboratoriesManagement').then((m) => ({ default: m.LaboratoriesManagement })));
const InstructorMessages = lazy(() => import('@/pages/instructor/InstructorMessages').then((m) => ({ default: m.InstructorMessages })));
const InstructorSettings = lazy(() => import('@/pages/instructor/Settings').then((m) => ({ default: m.InstructorSettings })));
const StudentApprovals = lazy(() => import('@/pages/instructor/StudentApprovals').then((m) => ({ default: m.StudentApprovals })));
const StudentPerformance = lazy(() => import('@/pages/instructor/StudentPerformance').then((m) => ({ default: m.StudentPerformance })));

// Lazy Loaded Admin Pages
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })));
const InstructorApprovals = lazy(() => import('@/pages/admin/InstructorApprovals').then((m) => ({ default: m.InstructorApprovals })));

function RouteFallback() {
  return (
    <div className="min-h-[60vh] p-6 sm:p-10 flex items-center justify-center">
      <AetherLoader variant="dashboard" label="Loading..." />
    </div>
  );
}

export function App() {
  const { isAuthenticated, user, isHydrated, verifySession } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  // Verify session and clear stale persisted user identity before the UI renders the old account
  useEffect(() => {
    const persistedUserId = (() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return null;
        return JSON.parse(raw)?.state?.user?.id ?? null;
      } catch {
        return null;
      }
    })();

    if (persistedUserId && user && user.id && persistedUserId !== user.id) {
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.reload();
      return;
    }

    verifySession();
    // Apply theme from store
    setTheme(theme);
  }, [theme, setTheme, user?.id, verifySession]);

  // Wait for auth state to hydrate from localStorage
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 sm:p-10 flex items-center justify-center">
        <AetherLoader variant="dashboard" label="Initializing Interactive Learning Platform..." />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" closeButton />
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/signup" element={<AdminSignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
            <Route path="/check-email" element={<CheckEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

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
              <Route path="/assessments" element={<StudentQuizzes />} />
              <Route path="/quizzes" element={<StudentQuizzes />} />
              <Route path="/announcements" element={<Chatbox />} />
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
              <Route path="/instructor/courses" element={<CoursesManagement />} />
              <Route path="/instructor/lesson/:unitId/:lessonId" element={<ViewLesson />} />
              <Route path="/instructor/assessments" element={<InstructorAssessments />} />
              <Route path="/instructor/assessments/create" element={<CreateAssessment />} />
              <Route path="/instructor/quizzes" element={<QuizManagement />} />
              <Route path="/instructor/exam/:id" element={<ExamDocument />} />
              <Route path="/instructor/laboratory-submissions" element={<LaboratorySubmissions />} />
              <Route path="/instructor/laboratories" element={<LaboratoriesManagement />} />
              <Route path="/instructor/laboratories/create" element={<LaboratoriesManagement />} />
              <Route path="/instructor/announcements" element={<InstructorMessages />} />
              <Route path="/instructor/messages" element={<InstructorMessages />} />
              <Route path="/instructor/settings" element={<InstructorSettings />} />
              <Route path="/instructor/student-approvals" element={<StudentApprovals />} />
              <Route path="/instructor/student-performance" element={<StudentPerformance />} />
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
              <Route path="/admin/settings" element={<AdminSettings />} />
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
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
