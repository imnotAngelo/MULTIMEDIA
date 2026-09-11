# Database Design & Data Models
## Simple, Scalable PostgreSQL Schema

---

## 🎯 Core Concept

The database stores all permanent information about users, courses, lessons, progress, etc. Think of it as a filing system:

- Each **table** = a type of document
- Each **row** = one instance
- Each **column** = a piece of information

```
Table: users
┌────┬──────────────┬───────────────┐
│ id │ email        │ full_name     │
├────┼──────────────┼───────────────┤
│ 1  │ john@ex.com  │ John Smith    │
│ 2  │ jane@ex.com  │ Jane Doe      │
└────┴──────────────┴───────────────┘
```

---

## 📊 Database Tables (Simplified View)

### **users** - User Accounts
Stores: Who is in the system
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,                    -- Unique identifier
  email VARCHAR UNIQUE NOT NULL,          -- Email (for login)
  password_hash VARCHAR NOT NULL,         -- Hashed password (not plaintext!)
  full_name VARCHAR NOT NULL,             -- Display name
  role VARCHAR NOT NULL,                  -- 'student' | 'instructor' | 'admin'
  avatar_url VARCHAR,                     -- Profile picture
  bio TEXT,                               -- User bio
  created_at TIMESTAMP DEFAULT NOW(),     -- When account created
  updated_at TIMESTAMP DEFAULT NOW(),     -- Last updated
  last_active TIMESTAMP                   -- Last login
);
```

### **courses** - Learning Courses
Stores: Collections like "Multimedia Fundamentals"
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY,
  instructor_id UUID NOT NULL,            -- FK to users
  title VARCHAR NOT NULL,                 -- Course name
  description TEXT,                       -- Course details
  thumbnail_url VARCHAR,                  -- Course image
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **modules** - Course Sections
Stores: Chapters within a course
```sql
CREATE TABLE modules (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL,                -- FK to courses
  title VARCHAR NOT NULL,                 -- Module name (e.g., "Video Production")
  description TEXT,
  order_index INTEGER,                    -- Display order
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **lessons** - Individual Learning Items
Stores: Actual lessons with content
```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL,                -- FK to modules
  title VARCHAR NOT NULL,                 -- Lesson name
  content TEXT,                           -- HTML/Markdown content
  video_url VARCHAR,                      -- URL to video
  video_duration_seconds INTEGER,         -- How long is the video
  order_index INTEGER,                    -- Order within module
  status VARCHAR DEFAULT 'draft',         -- 'draft' | 'published'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **lesson_progress** - Student Progress
Stores: Which lessons each student completed
```sql
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,                  -- FK to users
  lesson_id UUID NOT NULL,                -- FK to lessons
  completed BOOLEAN DEFAULT FALSE,        -- Did they finish?
  time_spent_seconds INTEGER,             -- How long they spent
  completed_at TIMESTAMP,                 -- When completed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)              -- One row per user+lesson combo
);
```

### **assessments** - Quizzes & Tests
Stores: Quiz definitions
```sql
CREATE TABLE assessments (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL,                -- FK to modules
  created_by UUID NOT NULL,               -- FK to users (instructor)
  title VARCHAR NOT NULL,                 -- Quiz name
  description TEXT,
  type VARCHAR,                           -- 'quiz' | 'exam' | 'survey'
  time_limit_seconds INTEGER,             -- How long they have (null = unlimited)
  passing_score INTEGER,                  -- % needed to pass
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **assessment_questions** - Quiz Questions
Stores: Individual questions within a quiz
```sql
CREATE TABLE assessment_questions (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL,            -- FK to assessments
  question_text TEXT NOT NULL,            -- The actual question
  question_type VARCHAR,                  -- 'multiple_choice' | 'short_answer' | 'essay'
  options JSONB,                          -- For multiple choice: ["A", "B", "C", "D"]
  correct_answer VARCHAR,                 -- The right answer
  points INTEGER DEFAULT 1,               -- Points for this question
  order_index INTEGER,                    -- Question order
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **assessment_submissions** - Quiz Answers
Stores: When students submit quiz answers
```sql
CREATE TABLE assessment_submissions (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL,            -- FK to assessments
  user_id UUID NOT NULL,                  -- FK to users (student)
  answers JSONB NOT NULL,                 -- Their answers: {"q1": "A", "q2": "B"}
  score INTEGER,                          -- Points earned
  percentage INTEGER,                     -- % correct
  feedback TEXT,                          -- Instructor feedback
  submitted_at TIMESTAMP DEFAULT NOW(),
  graded_at TIMESTAMP,                    -- When instructor graded it
  status VARCHAR DEFAULT 'submitted'      -- 'submitted' | 'graded'
);
```

### **resources** - Files Associated with Lessons
Stores: PDFs, images, download links
```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY,
  lesson_id UUID NOT NULL,                -- FK to lessons
  title VARCHAR NOT NULL,                 -- Display name
  file_url VARCHAR NOT NULL,              -- Download URL
  file_type VARCHAR,                      -- 'pdf' | 'image' | 'video' | etc.
  file_size_bytes INTEGER,                -- For download info
  order_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **achievements** - Badges & Milestones
Stores: Achievements users can earn
```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY,
  title VARCHAR NOT NULL,                 -- "Video Master"
  description TEXT,
  icon_url VARCHAR,
  xp_reward INTEGER,                      -- XP for earning this
  criteria JSONB,                         -- Requirements to earn
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **user_achievements** - Earned Badges
Stores: Which achievements each user has earned
```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,                  -- FK to users
  achievement_id UUID NOT NULL,           -- FK to achievements
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)         -- Each user earns each badge once
);
```

### **xp_history** - Experience Points Log
Stores: Every XP gain for auditing
```sql
CREATE TABLE xp_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,                  -- FK to users
  amount INTEGER NOT NULL,                -- XP gained/lost
  reason VARCHAR,                         -- "lesson_complete" | "quiz_pass" | etc.
  source_type VARCHAR,                    -- 'lesson' | 'quiz' | 'achievement'
  source_id UUID,                         -- Which lesson/quiz (FK)
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **course_enrollments** - Student Enrollment
Stores: Which students are in which courses
```sql
CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL,                -- FK to courses
  user_id UUID NOT NULL,                  -- FK to users
  enrolled_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR DEFAULT 'active'         -- 'active' | 'completed' | 'dropped'
);
```

---

## 🔗 How Tables Connect (Data Relationships)

```
users (many)
  ├─→ courses (1)          [instructor_id]
  ├─→ lesson_progress (many) [user_id]
  ├─→ assessments (many)   [created_by]
  ├─→ assessments_submissions (many)
  ├─→ user_achievements (many)
  └─→ xp_history (many)

courses (many)
  ├─→ modules (many)
  └─→ course_enrollments (many)

modules (many)
  ├─→ lessons (many)
  └─→ assessments (many)

lessons (many)
  ├─→ lesson_progress (many)
  └─→ resources (many)

assessments (many)
  ├─→ assessment_questions (many)
  └─→ assessment_submissions (many)
```

---

## 🔍 Common Queries (How to Get Data)

### Find all lessons for a student
```sql
SELECT l.id, l.title, l.content, l.video_url
FROM lessons l
JOIN modules m ON l.module_id = m.id
JOIN courses c ON m.course_id = c.id
JOIN course_enrollments ce ON c.id = ce.course_id
WHERE ce.user_id = 'student-id-here';
```

### Get student's progress across all lessons
```sql
SELECT 
  l.title,
  lp.completed,
  lp.time_spent_seconds,
  CASE WHEN lp.completed THEN '✓ Done' ELSE 'In Progress' END as status
FROM lessons l
LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id 
  AND lp.user_id = 'student-id-here'
ORDER BY l.order_index;
```

### Calculate student's dashboard stats
```sql
SELECT 
  (SELECT COUNT(*) FROM lesson_progress WHERE user_id = 'X' AND completed) as lessons_completed,
  (SELECT COUNT(*) FROM assessment_submissions WHERE user_id = 'X') as quizzes_taken,
  (SELECT SUM(amount) FROM xp_history WHERE user_id = 'X') as total_xp;
```

### Get quiz results for an instructor
```sql
SELECT 
  u.full_name,
  a.title as quiz_name,
  sub.percentage,
  sub.submitted_at
FROM assessment_submissions sub
JOIN users u ON sub.user_id = u.id
JOIN assessments a ON sub.assessment_id = a.id
WHERE a.created_by = 'instructor-id'
ORDER BY sub.submitted_at DESC;
```

---

## 🛡️ Security: Row-Level Security (RLS)

RLS means the database enforces who can see what data:

```sql
-- Students can only see their own progress
CREATE POLICY student_see_own_progress ON lesson_progress
  FOR SELECT USING (auth.uid() = user_id);

-- Students cannot see other students' grades
CREATE POLICY student_see_own_submissions ON assessment_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Instructors can see submissions for their courses
CREATE POLICY instructor_see_submissions ON assessment_submissions
  FOR SELECT USING (
    assessment_id IN (
      SELECT a.id FROM assessments a 
      WHERE a.created_by = auth.uid()
    )
  );
```

**Why?** Even if someone hacks the API, the database blocks unauthorized access.

---

## 📈 Indexing (Making Queries Fast)

Add indexes for common searches:

```sql
-- Students looking up their progress (common)
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);

-- Instructors viewing submissions
CREATE INDEX idx_submissions_assessment_id ON assessment_submissions(assessment_id);

-- Finding lessons in a module
CREATE INDEX idx_lessons_module_id ON lessons(module_id);

-- Preventing duplicate enrollments
CREATE UNIQUE INDEX idx_unique_enrollment ON course_enrollments(course_id, user_id);
```

---

## 🗄️ Data Types & Choices

| Field Type | When to Use | Example |
|-----------|-----------|---------|
| **UUID** | Unique IDs (better than numbers) | `id UUID PRIMARY KEY` |
| **VARCHAR(n)** | Short text (email, titles) | `email VARCHAR` |
| **TEXT** | Long text (content, descriptions) | `description TEXT` |
| **JSONB** | Flexible data (quiz answers, settings) | `answers JSONB` |
| **INTEGER** | Numbers (time, scores) | `time_spent_seconds INTEGER` |
| **BOOLEAN** | True/False | `completed BOOLEAN` |
| **TIMESTAMP** | Date & Time | `created_at TIMESTAMP DEFAULT NOW()` |

---

## 🚀 Adding a New Table

1. Create the table in a migration file:
```sql
-- migrations/005_create_bookmarks.sql

CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  bookmarked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
```

2. Add RLS policy:
```sql
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_see_own_bookmarks ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);
```

3. Create `queries.ts` to interact with it
4. Create routes in backend
5. Use from frontend

---

## 💡 Design Principles

✅ **DO**:
- Use foreign keys to link related data
- Add timestamps to every table
- Use unique constraints for user+item combos
- Index columns you search by
- Add RLS policies for security

❌ **DON'T**:
- Store passwords in plaintext (use hashing)
- Duplicate data across tables
- Store large files in database (use storage bucket)
- Create circular dependencies
- Have tables with 50+ columns

---

## 🔄 Schema Evolution

As system grows, update schema with migrations:

```
migrations/
├── 001_initial_schema.sql       -- Created tables
├── 002_add_video_duration.sql   -- Added new column
├── 003_create_bookmarks.sql     -- Added new feature
└── 004_add_instructor_feedback.sql
```

Each migration is **version controlled** and **reversible**:
- Upgrade: `npm run migrate:up`
- Downgrade: `npm run migrate:down`

This ensures database is always in a known state.

---

## 📞 Common Issues & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Data not saving | RLS policy blocking | Check `ALTER TABLE` RLS settings |
| Slow queries | Missing index | Add `CREATE INDEX` for search columns |
| Duplicates | No unique constraint | Add `UNIQUE(col1, col2)` |
| Foreign key error | Deleting referenced row | Add `ON DELETE CASCADE` |

