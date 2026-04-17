# Database Schema (Supabase/PostgreSQL)

## Overview

This document defines the complete database schema for the Interactive Learning System for Fundamentals of Multimedia. The schema is designed for PostgreSQL with Supabase extensions, including Row Level Security (RLS) policies for data protection.

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │     courses     │     │     modules     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ email           │◄────│ instructor_id   │     │ course_id (FK)  │◄──┐
│ full_name       │     │ title           │     │ title           │   │
│ avatar_url      │     │ description     │     │ description     │   │
│ role            │     │ thumbnail_url   │     │ order_index     │   │
│ xp_total        │     │ status          │     │ status          │   │
│ streak_days     │     │ created_at      │     │ created_at      │   │
│ last_active     │     └─────────────────┘     └─────────────────┘   │
│ created_at      │                                                   │
└─────────────────┘                                                   │
         │                                                            │
         │     ┌─────────────────┐     ┌─────────────────┐            │
         │     │    lessons      │     │  lesson_progress│            │
         │     ├─────────────────┤     ├─────────────────┤            │
         │     │ id (PK)         │     │ id (PK)         │            │
         │     │ module_id (FK)  │◄────│ lesson_id (FK)  │            │
         │     │ title           │     │ user_id (FK)    │────────────┘
         │     │ content         │     │ completed       │
         │     │ video_url       │     │ time_spent      │
         │     │ duration        │     │ completed_at    │
         │     │ order_index     │     │ created_at      │
         │     │ status          │     └─────────────────┘
         │     └─────────────────┘
         │
         │     ┌─────────────────┐     ┌─────────────────┐
         │     │  assessments    │     │  submissions    │
         │     ├─────────────────┤     ├─────────────────┤
         │     │ id (PK)         │     │ id (PK)         │
         └────▶│ created_by (FK) │     │ assessment_id   │◄──┐
               │ title           │     │ student_id (FK) │   │
               │ description     │     │ answers         │   │
               │ type            │     │ score           │   │
               │ time_limit      │     │ feedback        │   │
               │ passing_score   │     │ status          │   │
               │ module_id (FK)  │◄────│ submitted_at    │   │
               └─────────────────┘     └─────────────────┘   │
                                                              │
┌─────────────────┐     ┌─────────────────┐     ┌─────────────┘
│  achievements   │     │  user_achievements     │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ achievement_id  │
│ title           │     │ user_id (FK)    │
│ description     │     │ earned_at       │
│ icon_url        │     └─────────────────┘
│ xp_reward       │
│ criteria        │
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  forum_topics   │     │  forum_replies  │     │    resources    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ title           │     │ topic_id (FK)   │◄────│ lesson_id (FK)  │
│ content         │     │ user_id (FK)    │     │ title           │
│ user_id (FK)    │────▶│ content         │     │ file_url        │
│ lesson_id (FK)  │     │ created_at      │     │ file_type       │
│ tags            │     └─────────────────┘     │ file_size       │
│ views           │                             │ uploaded_by     │
│ created_at      │                             └─────────────────┘
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   xp_history    │     │  notifications  │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ user_id (FK)    │     │ user_id (FK)    │
│ amount          │     │ title           │
│ reason          │     │ message         │
│ source_type     │     │ type            │
│ source_id       │     │ is_read         │
│ created_at      │     │ created_at      │
└─────────────────┘     └─────────────────┘
```

## Table Definitions

### 1. Users Table

Stores user account information and gamification data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
    xp_total INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_xp ON users(xp_total DESC);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
    ON users FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON users FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Instructors can view student profiles" 
    ON users FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin')
        )
    );
```

### 2. Courses Table

Stores course information and metadata.

```sql
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_courses_status ON courses(status);

-- RLS Policies
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published courses" 
    ON courses FOR SELECT 
    USING (status = 'published');

CREATE POLICY "Instructors can manage their own courses" 
    ON courses FOR ALL 
    USING (instructor_id = auth.uid());

CREATE POLICY "Admins can manage all courses" 
    ON courses FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### 3. Modules Table

Stores course modules (units) with ordering.

```sql
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_modules_course ON modules(course_id);
CREATE INDEX idx_modules_order ON modules(course_id, order_index);

-- RLS Policies
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view modules in published courses" 
    ON modules FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = modules.course_id 
            AND courses.status = 'published'
        )
    );

CREATE POLICY "Instructors can manage modules in their courses" 
    ON modules FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = modules.course_id 
            AND courses.instructor_id = auth.uid()
        )
    );
```

### 4. Lessons Table

Stores lesson content and metadata.

```sql
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    video_url TEXT,
    duration INTEGER, -- in minutes
    order_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'archived')),
    xp_reward INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lessons_module ON lessons(module_id);
CREATE INDEX idx_lessons_order ON lessons(module_id, order_index);

-- RLS Policies
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view lessons in published courses" 
    ON lessons FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM modules 
            JOIN courses ON modules.course_id = courses.id
            WHERE modules.id = lessons.module_id 
            AND courses.status = 'published'
        )
    );

CREATE POLICY "Instructors can manage lessons in their courses" 
    ON lessons FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM modules 
            JOIN courses ON modules.course_id = courses.id
            WHERE modules.id = lessons.module_id 
            AND courses.instructor_id = auth.uid()
        )
    );
```

### 5. Lesson Progress Table

Tracks student progress through lessons.

```sql
CREATE TABLE lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    time_spent INTEGER DEFAULT 0, -- in seconds
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Indexes
CREATE INDEX idx_progress_user ON lesson_progress(user_id);
CREATE INDEX idx_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX idx_progress_completed ON lesson_progress(user_id, completed);

-- RLS Policies
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress" 
    ON lesson_progress FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own progress" 
    ON lesson_progress FOR ALL 
    USING (user_id = auth.uid());

CREATE POLICY "Instructors can view student progress" 
    ON lesson_progress FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin')
        )
    );
```

### 6. Assessments Table

Stores quiz and assessment information.

```sql
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('quiz', 'assignment', 'exam')),
    time_limit INTEGER, -- in minutes, NULL for no limit
    passing_score INTEGER DEFAULT 70, -- percentage
    max_attempts INTEGER DEFAULT 1,
    xp_reward INTEGER DEFAULT 50,
    questions JSONB NOT NULL, -- array of question objects
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assessments_creator ON assessments(created_by);
CREATE INDEX idx_assessments_module ON assessments(module_id);
CREATE INDEX idx_assessments_type ON assessments(type);
CREATE INDEX idx_assessments_status ON assessments(status);

-- RLS Policies
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view published assessments" 
    ON assessments FOR SELECT 
    USING (status = 'published');

CREATE POLICY "Instructors can manage their assessments" 
    ON assessments FOR ALL 
    USING (created_by = auth.uid());

CREATE POLICY "Admins can manage all assessments" 
    ON assessments FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### 7. Submissions Table

Stores student assessment submissions.

```sql
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score INTEGER,
    feedback TEXT,
    status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
    attempt_number INTEGER DEFAULT 1,
    started_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_submissions_assessment ON submissions(assessment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- RLS Policies
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own submissions" 
    ON submissions FOR SELECT 
    USING (student_id = auth.uid());

CREATE POLICY "Students can create their own submissions" 
    ON submissions FOR INSERT 
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Instructors can grade submissions" 
    ON submissions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM assessments 
            WHERE assessments.id = submissions.assessment_id 
            AND assessments.created_by = auth.uid()
        )
    );
```

### 8. Achievements Table

Stores available achievement badges.

```sql
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url TEXT,
    xp_reward INTEGER DEFAULT 0,
    criteria JSONB NOT NULL, -- criteria for earning
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_achievements_category ON achievements(category);

-- RLS Policies (Public read, Admin write)
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements" 
    ON achievements FOR SELECT 
    TO PUBLIC;

CREATE POLICY "Only admins can manage achievements" 
    ON achievements FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### 9. User Achievements Table

Links users to their earned achievements.

```sql
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement ON user_achievements(achievement_id);

-- RLS Policies
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements" 
    ON user_achievements FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Instructors can view student achievements" 
    ON user_achievements FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin')
        )
    );
```

### 10. XP History Table

Tracks XP point transactions.

```sql
CREATE TABLE xp_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'lesson', 'quiz', 'achievement', etc.
    source_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_xp_history_user ON xp_history(user_id);
CREATE INDEX idx_xp_history_created ON xp_history(created_at DESC);

-- RLS Policies
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own XP history" 
    ON xp_history FOR SELECT 
    USING (user_id = auth.uid());
```

### 11. Forum Topics Table

Stores discussion forum topics.

```sql
CREATE TABLE forum_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[],
    views INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_forum_topics_user ON forum_topics(user_id);
CREATE INDEX idx_forum_topics_lesson ON forum_topics(lesson_id);
CREATE INDEX idx_forum_topics_created ON forum_topics(created_at DESC);

-- RLS Policies
ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view forum topics" 
    ON forum_topics FOR SELECT 
    TO PUBLIC;

CREATE POLICY "Authenticated users can create topics" 
    ON forum_topics FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own topics" 
    ON forum_topics FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own topics" 
    ON forum_topics FOR DELETE 
    USING (user_id = auth.uid());
```

### 12. Forum Replies Table

Stores replies to forum topics.

```sql
CREATE TABLE forum_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_solution BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_forum_replies_topic ON forum_replies(topic_id);
CREATE INDEX idx_forum_replies_user ON forum_replies(user_id);
CREATE INDEX idx_forum_replies_created ON forum_replies(created_at);

-- RLS Policies
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view forum replies" 
    ON forum_replies FOR SELECT 
    TO PUBLIC;

CREATE POLICY "Authenticated users can create replies" 
    ON forum_replies FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies" 
    ON forum_replies FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own replies" 
    ON forum_replies FOR DELETE 
    USING (user_id = auth.uid());
```

### 13. Resources Table

Stores downloadable lesson resources.

```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER, -- in bytes
    uploaded_by UUID NOT NULL REFERENCES users(id),
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_resources_lesson ON resources(lesson_id);

-- RLS Policies
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view resources in published courses" 
    ON resources FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM lessons 
            JOIN modules ON lessons.module_id = modules.id
            JOIN courses ON modules.course_id = courses.id
            WHERE lessons.id = resources.lesson_id 
            AND courses.status = 'published'
        )
    );

CREATE POLICY "Instructors can manage resources" 
    ON resources FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM lessons 
            JOIN modules ON lessons.module_id = modules.id
            JOIN courses ON modules.course_id = courses.id
            WHERE lessons.id = resources.lesson_id 
            AND courses.instructor_id = auth.uid()
        )
    );
```

### 14. Notifications Table

Stores user notifications.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general' CHECK (type IN ('general', 'achievement', 'grade', 'forum', 'deadline')),
    link_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" 
    ON notifications FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" 
    ON notifications FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications" 
    ON notifications FOR DELETE 
    USING (user_id = auth.uid());
```

## Database Functions and Triggers

### Update User XP Total

```sql
CREATE OR REPLACE FUNCTION update_user_xp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET xp_total = xp_total + NEW.amount,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_xp
AFTER INSERT ON xp_history
FOR EACH ROW
EXECUTE FUNCTION update_user_xp();
```

### Update Lesson Progress Stats

```sql
CREATE OR REPLACE FUNCTION update_lesson_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
        -- Award XP for lesson completion
        INSERT INTO xp_history (user_id, amount, reason, source_type, source_id)
        VALUES (
            NEW.user_id, 
            (SELECT xp_reward FROM lessons WHERE id = NEW.lesson_id),
            'Lesson completed',
            'lesson',
            NEW.lesson_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lesson_stats
AFTER UPDATE ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION update_lesson_stats();
```

### Update User Streak

```sql
CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
    last_activity DATE;
    current_streak INTEGER;
BEGIN
    SELECT last_active::DATE, streak_days 
    INTO last_activity, current_streak
    FROM users 
    WHERE id = NEW.user_id;
    
    IF last_activity = CURRENT_DATE - 1 THEN
        -- Continue streak
        UPDATE users 
        SET streak_days = streak_days + 1,
            last_active = NOW()
        WHERE id = NEW.user_id;
    ELSIF last_activity < CURRENT_DATE - 1 THEN
        -- Reset streak
        UPDATE users 
        SET streak_days = 1,
            last_active = NOW()
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_streak
AFTER INSERT ON lesson_progress
FOR EACH ROW
WHEN (NEW.completed = TRUE)
EXECUTE FUNCTION update_user_streak();
```

## Views

### Student Progress View

```sql
CREATE VIEW student_progress_view AS
SELECT 
    u.id AS user_id,
    u.full_name,
    c.id AS course_id,
    c.title AS course_title,
    m.id AS module_id,
    m.title AS module_title,
    COUNT(DISTINCT l.id) AS total_lessons,
    COUNT(DISTINCT CASE WHEN lp.completed THEN l.id END) AS completed_lessons,
    ROUND(
        COUNT(DISTINCT CASE WHEN lp.completed THEN l.id END) * 100.0 / 
        NULLIF(COUNT(DISTINCT l.id), 0), 
        2
    ) AS progress_percentage
FROM users u
CROSS JOIN courses c
JOIN modules m ON m.course_id = c.id
JOIN lessons l ON l.module_id = m.id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = u.id
WHERE c.status = 'published'
GROUP BY u.id, u.full_name, c.id, c.title, m.id, m.title;
```

### Leaderboard View

```sql
CREATE VIEW leaderboard_view AS
SELECT 
    u.id,
    u.full_name,
    u.avatar_url,
    u.xp_total,
    u.streak_days,
    COUNT(DISTINCT ua.achievement_id) AS achievement_count,
    RANK() OVER (ORDER BY u.xp_total DESC) AS rank
FROM users u
LEFT JOIN user_achievements ua ON ua.user_id = u.id
WHERE u.role = 'student'
GROUP BY u.id, u.full_name, u.avatar_url, u.xp_total, u.streak_days;
```

## Summary

This database schema provides a comprehensive foundation for the Interactive Learning System for Fundamentals of Multimedia. The design emphasizes:

1. **Data Integrity**: Foreign key constraints and check constraints ensure data quality
2. **Security**: Row Level Security policies protect sensitive data
3. **Performance**: Strategic indexes optimize query performance
4. **Scalability**: Normalized structure supports growth
5. **Flexibility**: JSONB fields allow extensible data structures

The schema supports all core features including user management, course content, progress tracking, assessments, gamification, and collaboration.
