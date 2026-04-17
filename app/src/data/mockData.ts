import type { 
  User, 
  Course, 
  Module, 
  Lesson, 
  Achievement,
  DashboardStats,
  WeeklyActivity,
  Recommendation,
  LeaderboardEntry,
  ForumTopic,
  Assessment
} from '@/types';

// Mock User Data
export const mockUser: User = {
  id: 'user-1',
  email: 'student@example.com',
  full_name: 'Alex Johnson',
  avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  role: 'student',
  xp_total: 1840,
  streak_days: 5,
  last_active: new Date().toISOString(),
  created_at: '2024-01-01T00:00:00Z',
};

// Mock Course Data
export const mockCourse: Course = {
  id: 'course-1',
  title: 'Fundamentals of Multimedia',
  description: 'Master the essential concepts of digital multimedia including imaging, audio, video, animation, and interactive media.',
  thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop',
  instructor_id: 'instructor-1',
  status: 'published',
  module_count: 7,
  lesson_count: 32,
  created_at: '2024-01-01T00:00:00Z',
};

// Mock Module Data
export const mockModules: Module[] = [
  {
    id: 'module-0',
    course_id: 'course-1',
    title: 'Unit 0: Orientation',
    description: 'Course overview and getting started',
    order_index: 0,
    status: 'active',
    progress: 100,
    completed_lessons: 2,
    total_lessons: 2,
  },
  {
    id: 'module-1',
    course_id: 'course-1',
    title: 'Unit I: Intro to Multimedia',
    description: 'Introduction to multimedia concepts and applications',
    order_index: 1,
    status: 'active',
    progress: 75,
    completed_lessons: 3,
    total_lessons: 4,
  },
  {
    id: 'module-2',
    course_id: 'course-1',
    title: 'Unit II: Digital Imaging',
    description: 'Image formats, color models, and basic editing',
    order_index: 2,
    status: 'active',
    progress: 50,
    completed_lessons: 2,
    total_lessons: 4,
  },
  {
    id: 'module-3',
    course_id: 'course-1',
    title: 'Unit III: Animation Basics',
    description: 'Animation principles and keyframe techniques',
    order_index: 3,
    status: 'active',
    progress: 25,
    completed_lessons: 1,
    total_lessons: 4,
  },
  {
    id: 'module-4',
    course_id: 'course-1',
    title: 'Unit IV: Video Production',
    description: 'Video formats, codecs, and editing fundamentals',
    order_index: 4,
    status: 'locked',
    progress: 0,
    completed_lessons: 0,
    total_lessons: 4,
  },
  {
    id: 'module-5',
    course_id: 'course-1',
    title: 'Unit V: Audio Processing',
    description: 'Digital audio concepts and editing',
    order_index: 5,
    status: 'locked',
    progress: 0,
    completed_lessons: 0,
    total_lessons: 4,
  },
  {
    id: 'module-6',
    course_id: 'course-1',
    title: 'Unit VI: Interactive Media',
    description: 'Web multimedia and interactivity',
    order_index: 6,
    status: 'locked',
    progress: 0,
    completed_lessons: 0,
    total_lessons: 4,
  },
];

// Mock Lesson Data
export const mockLessons: Lesson[] = [
  {
    id: 'lesson-1',
    module_id: 'module-1',
    title: 'What is Multimedia?',
    content: 'Multimedia refers to content that uses a combination of different content forms...',
    video_url: 'https://example.com/video1',
    duration: 15,
    order_index: 1,
    status: 'active',
    xp_reward: 10,
    is_completed: true,
  },
  {
    id: 'lesson-2',
    module_id: 'module-1',
    title: 'Multimedia Applications',
    content: 'Multimedia is used in various fields including education, entertainment...',
    video_url: 'https://example.com/video2',
    duration: 20,
    order_index: 2,
    status: 'active',
    xp_reward: 10,
    is_completed: true,
  },
  {
    id: 'lesson-3',
    module_id: 'module-1',
    title: 'Hardware and Software Requirements',
    content: 'To work with multimedia, you need specific hardware and software...',
    video_url: 'https://example.com/video3',
    duration: 18,
    order_index: 3,
    status: 'active',
    xp_reward: 10,
    is_completed: true,
  },
  {
    id: 'lesson-4',
    module_id: 'module-1',
    title: 'Introduction to Multimedia Tools',
    content: 'Overview of popular multimedia creation and editing tools...',
    video_url: 'https://example.com/video4',
    duration: 25,
    order_index: 4,
    status: 'active',
    xp_reward: 15,
    is_completed: false,
  },
];

// Mock Achievement Data
export const mockAchievements: Achievement[] = [
  {
    id: 'ach-1',
    title: 'First Steps',
    description: 'Complete your first lesson',
    icon_url: 'Footprints',
    xp_reward: 50,
    criteria: { type: 'lessons_completed', threshold: 1 },
    category: 'beginner',
    earned_at: '2024-01-05T14:30:00Z',
  },
  {
    id: 'ach-2',
    title: 'Quiz Master',
    description: 'Score 100% on any quiz',
    icon_url: 'Target',
    xp_reward: 100,
    criteria: { type: 'quizzes_passed', threshold: 1 },
    category: 'intermediate',
    earned_at: '2024-01-10T16:00:00Z',
  },
  {
    id: 'ach-3',
    title: 'On Fire',
    description: 'Maintain a 7-day learning streak',
    icon_url: 'Flame',
    xp_reward: 150,
    criteria: { type: 'streak_days', threshold: 7 },
    category: 'intermediate',
    earned_at: '2024-01-12T10:00:00Z',
  },
  {
    id: 'ach-4',
    title: 'XP Hunter',
    description: 'Earn 1000 XP',
    icon_url: 'Trophy',
    xp_reward: 200,
    criteria: { type: 'xp_reached', threshold: 1000 },
    category: 'advanced',
    earned_at: '2024-01-15T09:00:00Z',
  },
];

// Mock Dashboard Stats
export const mockDashboardStats: DashboardStats = {
  xp: {
    total: 1840,
    this_week: 240,
    trend: 'up',
  },
  progress: {
    lessons_completed: 9,
    total_lessons: 32,
    percentage: 28,
  },
  quizzes: {
    average: 76,
    passed: 5,
    total: 7,
  },
  streak: {
    current: 5,
    longest: 12,
  },
};

// Mock Weekly Activity
export const mockWeeklyActivity: WeeklyActivity[] = [
  { day: 'Mon', lessons: 2, xp: 50 },
  { day: 'Tue', lessons: 1, xp: 30 },
  { day: 'Wed', lessons: 3, xp: 80 },
  { day: 'Thu', lessons: 2, xp: 40 },
  { day: 'Fri', lessons: 1, xp: 25 },
  { day: 'Sat', lessons: 0, xp: 0 },
  { day: 'Sun', lessons: 2, xp: 60 },
];

// Mock Recommendations
export const mockRecommendations: Recommendation[] = [
  {
    type: 'review',
    title: 'Review Animation Basics',
    reason: 'You scored 65% on the Animation quiz. Reviewing this topic will help strengthen your understanding.',
    link: '/lessons/animation-basics',
  },
  {
    type: 'continue',
    title: 'Continue Digital Imaging',
    reason: 'You are 75% through this module. Complete the remaining lessons to earn 30 XP.',
    link: '/modules/digital-imaging',
  },
  {
    type: 'practice',
    title: 'Practice Color Models',
    reason: 'Try the interactive playground to practice RGB and CMYK conversions.',
    link: '/playground/color-models',
  },
];

// Mock Leaderboard Data
export const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    user_id: 'user-2',
    full_name: 'Sarah Chen',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    xp_total: 3240,
    achievement_count: 12,
    streak_days: 15,
  },
  {
    rank: 2,
    user_id: 'user-3',
    full_name: 'Mike Rodriguez',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
    xp_total: 2890,
    achievement_count: 10,
    streak_days: 8,
  },
  {
    rank: 3,
    user_id: 'user-4',
    full_name: 'Emma Watson',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    xp_total: 2650,
    achievement_count: 9,
    streak_days: 12,
  },
  {
    rank: 4,
    user_id: 'user-5',
    full_name: 'James Park',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
    xp_total: 2100,
    achievement_count: 7,
    streak_days: 5,
  },
  {
    rank: 5,
    user_id: 'user-1',
    full_name: 'Alex Johnson',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    xp_total: 1840,
    achievement_count: 6,
    streak_days: 5,
  },
];

// Mock Forum Topics
export const mockForumTopics: ForumTopic[] = [
  {
    id: 'topic-1',
    title: 'Help with RGB color model',
    content: 'I\'m confused about how RGB values work. Can someone explain?',
    user_id: 'user-5',
    views: 45,
    replies_count: 3,
    is_pinned: false,
    is_locked: false,
    created_at: '2024-01-15T10:00:00Z',
    last_reply_at: '2024-01-15T14:00:00Z',
  },
  {
    id: 'topic-2',
    title: 'Best practices for image compression?',
    content: 'What are the recommended settings for web images?',
    user_id: 'user-3',
    views: 32,
    replies_count: 5,
    is_pinned: false,
    is_locked: false,
    created_at: '2024-01-14T16:00:00Z',
    last_reply_at: '2024-01-15T09:00:00Z',
  },
  {
    id: 'topic-3',
    title: 'Welcome to the Forum - Read First!',
    content: 'Welcome! Please read our community guidelines before posting.',
    user_id: 'instructor-1',
    views: 156,
    replies_count: 0,
    is_pinned: true,
    is_locked: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

// Mock Assessment Data
export const mockAssessments: Assessment[] = [
  {
    id: 'assess-1',
    title: 'Digital Imaging Quiz',
    description: 'Test your knowledge of image formats and color models',
    type: 'quiz',
    time_limit: 30,
    passing_score: 70,
    max_attempts: 2,
    xp_reward: 50,
    question_count: 10,
    status: 'published',
    attempts_allowed: 2,
    attempts_made: 1,
  },
  {
    id: 'assess-2',
    title: 'Animation Principles Quiz',
    description: 'Assessment on animation basics and keyframing',
    type: 'quiz',
    time_limit: 25,
    passing_score: 65,
    max_attempts: 3,
    xp_reward: 50,
    question_count: 8,
    status: 'published',
    attempts_allowed: 3,
    attempts_made: 0,
  },
  {
    id: 'assess-3',
    title: 'Midterm Examination',
    description: 'Comprehensive assessment covering Units I-III',
    type: 'exam',
    time_limit: 90,
    passing_score: 75,
    max_attempts: 1,
    xp_reward: 200,
    question_count: 50,
    status: 'published',
    attempts_allowed: 1,
    attempts_made: 0,
  },
];

// Grading Weights
export const gradingWeights = {
  midterm: 33.33,
  final: 66.67,
  lecture: {
    weight: 40,
    breakdown: {
      quizzes: 30,
      supplementary: 20,
      exam: 50,
    },
  },
  laboratory: {
    weight: 60,
    breakdown: {
      activities: 20,
      practical: 30,
      project: 50,
    },
  },
  passingGrade: 75,
};

// Upcoming Deadlines
export const upcomingDeadlines = [
  {
    id: 'deadline-1',
    title: 'Digital Imaging Quiz',
    due_date: '2024-01-18T23:59:00Z',
    type: 'quiz',
    module: 'Unit II: Digital Imaging',
  },
  {
    id: 'deadline-2',
    title: 'Animation Practice Assignment',
    due_date: '2024-01-22T23:59:00Z',
    type: 'assignment',
    module: 'Unit III: Animation Basics',
  },
  {
    id: 'deadline-3',
    title: 'Midterm Examination',
    due_date: '2024-02-01T09:00:00Z',
    type: 'exam',
    module: 'Units I-III',
  },
];
