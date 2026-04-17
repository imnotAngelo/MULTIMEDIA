// User Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'student' | 'instructor' | 'admin';
  xp_total: number;
  streak_days: number;
  last_active?: string;
  created_at: string;
}

export interface UserProfile extends User {
  achievements: Achievement[];
  progress: UserProgress;
}

// Course Types
export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url?: string;
  instructor_id: string;
  instructor?: User;
  status: 'draft' | 'published' | 'archived';
  module_count?: number;
  lesson_count?: number;
  created_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  order_index: number;
  status: 'active' | 'locked' | 'archived';
  lessons?: Lesson[];
  progress?: number;
  completed_lessons?: number;
  total_lessons?: number;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content?: string;
  video_url?: string;
  duration?: number;
  order_index: number;
  status: 'active' | 'locked' | 'archived';
  xp_reward: number;
  resources?: Resource[];
  is_completed?: boolean;
  progress?: LessonProgress;
}

export interface Resource {
  id: string;
  lesson_id: string;
  title: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
}

export interface LessonProgress {
  completed: boolean;
  time_spent: number;
  completed_at?: string;
  last_accessed?: string;
}

// Assessment Types
export interface Assessment {
  id: string;
  title: string;
  description?: string;
  type: 'quiz' | 'assignment' | 'exam';
  time_limit?: number;
  passing_score: number;
  max_attempts: number;
  xp_reward: number;
  question_count?: number;
  status: 'draft' | 'published' | 'closed';
  attempts_allowed?: number;
  attempts_made?: number;
}

export interface Question {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'matching' | 'short_answer';
  question: string;
  options?: string[];
  correct_answer?: string | string[];
  points: number;
}

export interface Submission {
  id: string;
  assessment_id: string;
  student_id: string;
  answers: Answer[];
  score?: number;
  feedback?: string;
  status: 'submitted' | 'graded' | 'returned';
  attempt_number: number;
  started_at?: string;
  submitted_at?: string;
  graded_at?: string;
}

export interface Answer {
  question_id: string;
  answer: string | string[];
  is_correct?: boolean;
}

// Gamification Types
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon_url: string;
  xp_reward: number;
  criteria: AchievementCriteria;
  category: string;
  earned_at?: string;
}

export interface AchievementCriteria {
  type: 'lessons_completed' | 'quizzes_passed' | 'streak_days' | 'xp_reached';
  threshold: number;
}

export interface XPHistory {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  source_type: string;
  source_id?: string;
  created_at: string;
}

// Forum Types
export interface ForumTopic {
  id: string;
  title: string;
  content: string;
  user_id: string;
  author?: User;
  lesson_id?: string;
  tags?: string[];
  views: number;
  replies_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  last_reply_at?: string;
}

export interface ForumReply {
  id: string;
  topic_id: string;
  user_id: string;
  author?: User;
  content: string;
  is_solution: boolean;
  created_at: string;
}

// Analytics Types
export interface DashboardStats {
  xp: {
    total: number;
    this_week: number;
    trend: 'up' | 'down' | 'stable';
  };
  progress: {
    lessons_completed: number;
    total_lessons: number;
    percentage: number;
  };
  quizzes: {
    average: number;
    passed: number;
    total: number;
  };
  streak: {
    current: number;
    longest: number;
  };
}

export interface WeeklyActivity {
  day: string;
  lessons: number;
  xp: number;
}

export interface Recommendation {
  type: 'review' | 'practice' | 'continue';
  title: string;
  reason: string;
  link: string;
}

export interface ModuleProgress {
  module_id: string;
  title: string;
  progress: number;
  completed_lessons: number;
  total_lessons: number;
}

export interface UserProgress {
  overall_progress: number;
  total_lessons: number;
  completed_lessons: number;
  modules_progress: ModuleProgress[];
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  xp_total: number;
  achievement_count: number;
  streak_days: number;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'general' | 'achievement' | 'grade' | 'forum' | 'deadline';
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

// UI Types
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}
