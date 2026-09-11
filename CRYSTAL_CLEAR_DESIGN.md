# Crystal Clear System Design
## Interactive Learning Platform for Multimedia Fundamentals

**Version 1.0** | *Designed for clarity and developer onboarding*

---

## 🎯 One-Sentence System Summary

**A three-tier web application where students learn multimedia through video lessons, interactive quizzes, and hands-on labs, while instructors manage content and track progress.**

---

## 🏗️ The Three Tiers (Simplified)

Think of the system as three connected layers:

```
┌──────────────────────────────────────────┐
│  WHAT USERS SEE                          │
│  (React Web App - Browser)               │
│  - Student dashboards                    │
│  - Lesson viewers                        │
│  - Quiz interfaces                       │
│  - Progress tracking                     │
└──────────────────────────────────────────┘
                    ↕
           (JSON requests over HTTPS)
                    ↕
┌──────────────────────────────────────────┐
│  THE BRAIN (Logic)                       │
│  (Node.js Express Server)                │
│  - Handles login/authorization           │
│  - Processes lesson/quiz data            │
│  - Calculates grades and XP              │
│  - Manages file uploads                  │
└──────────────────────────────────────────┘
                    ↕
           (Queries and Files)
                    ↕
┌──────────────────────────────────────────┐
│  THE STORAGE (Data)                      │
│  (Supabase - Database + Files)           │
│  - User accounts                         │
│  - Course/lesson/quiz content            │
│  - Student progress                      │
│  - Uploaded files (videos, PDFs, labs)   │
└──────────────────────────────────────────┘
```

---

## 🎓 User Roles & What They Do

| Role | Main Actions | Can Access |
|------|--------------|-----------|
| **Student** | View lessons, take quizzes, submit labs | Their own progress, lessons, assessments |
| **Instructor** | Create lessons, build quizzes, view grades | Their courses, all student submissions |
| **Admin** | Approve users, manage system settings | Everything (read-only reports) |

---

## 📦 What Gets Stored (Data Model)

### Core Objects:
- **Users**: Student/Instructor/Admin accounts
- **Courses**: Collections of learning units (e.g., "Multimedia Fundamentals")
- **Units/Modules**: Sections within a course (e.g., "Video Production", "Audio Basics")
- **Lessons**: Individual learning items (with video, text, resources)
- **Assessments**: Quizzes and tests
- **Progress**: What students completed and their scores
- **Lab Submissions**: Code/project submissions

### Relationships:
```
Course → Units → Lessons
            ↓
         Assessments → Student Progress
         
Lessons → Resources (files, videos)
       → Lab Submissions
```

---

## 🔄 How Data Flows Through the System

### Scenario 1: A Student Watching a Lesson

```
1. Student clicks "View Lesson" in browser
   ↓
2. React app sends request: "GET /lesson/123"
   ↓
3. Express server checks: "Is this user authorized? Does lesson exist?"
   ↓
4. Server queries database: "Get lesson content, video URL, resources"
   ↓
5. Server responds with all the data (JSON)
   ↓
6. React renders the lesson, student watches video
   ↓
7. When done, React sends: "Mark lesson 123 as complete"
   ↓
8. Express updates database: lesson_progress record updated
   ↓
9. Dashboard instantly shows new progress (XP, completion %)
```

### Scenario 2: Taking a Quiz

```
1. Student clicks "Take Quiz"
   ↓
2. React loads quiz questions from server
   ↓
3. Student answers questions in browser
   ↓
4. Student submits answers
   ↓
5. Express scores the answers
   ↓
6. Express awards XP and updates grade
   ↓
7. Database stores submission with score
   ↓
8. React shows results instantly
```

---

## 📁 Frontend File Organization (What Goes Where)

```
app/src/
├── pages/                    # Full page views
│   ├── StudentDashboard.tsx
│   ├── LessonPage.tsx
│   ├── QuizPage.tsx
│   └── InstructorPanel.tsx
│
├── features/                 # Feature modules (grouped by what they do)
│   ├── lessons/             # Everything about lessons
│   │   ├── components/      # UI components for lessons
│   │   ├── hooks/          # Custom hooks (e.g., useLessonData)
│   │   └── api.ts          # API calls for lessons
│   │
│   ├── quizzes/            # Everything about quizzes
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api.ts
│   │
│   ├── progress/           # XP, badges, tracking
│   │   ├── components/
│   │   └── api.ts
│   │
│   └── auth/               # Login, registration, permissions
│       ├── components/
│       └── api.ts
│
├── shared/                  # Reusable everywhere
│   ├── components/         # Button, Card, Layout, etc.
│   ├── hooks/             # useAuth, useLocalStorage, etc.
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Helper functions
│
└── App.tsx                 # Main app entry point
```

**Why this structure?**
- New developers can find all lesson-related code in `/features/lessons`
- No hunting through scattered files
- Dependencies are clear
- Easy to add new features

---

## 🔌 Backend API Structure (Simple Endpoints)

```
Express Server at /api/

AUTHENTICATION
├── POST /auth/login           → Verify password, return JWT token
├── POST /auth/register        → Create new user
└── GET  /auth/me              → Current user info

LESSONS
├── GET  /lessons              → List all lessons user can access
├── GET  /lessons/:id          → Get single lesson content
└── POST /lessons/:id/complete → Mark lesson as done

QUIZZES
├── GET  /quizzes              → List quizzes for user
├── GET  /quizzes/:id          → Get quiz questions
├── POST /quizzes/:id/submit   → Submit answers, get score

PROGRESS
├── GET  /progress             → Student's progress data (for dashboard)
└── GET  /instructor/grades    → Instructor's view of all students

UPLOADS
├── POST /upload               → Upload file, return URL
└── GET  /download/:fileId     → Secure file download
```

**Key principle:** Each endpoint does ONE thing. No god endpoints.

---

## 🛡️ Security (How We Protect Data)

1. **Authentication**: Supabase Auth creates JWT tokens
   - Token included in every request header
   - Server verifies token before accessing data

2. **Authorization**: Server checks role
   - Student sees only their own progress
   - Instructor sees only their courses
   - Admin sees everything (read-only)

3. **Row-Level Security (RLS)**: Database enforces rules
   - Even if someone hacks the token, database blocks unauthorized data access

---

## 📊 Deployment (Getting to Users)

```
Developer's Computer
        ↓
   Git Commit
        ↓
   Push to GitHub
        ↓
   Deployment Service (Render/Vercel)
        ↓
   Runs build & tests
        ↓
   Deployed Frontend (Vercel CDN)  ← Users access here
   Deployed Backend (Render)        ← Handles API requests
   Deployed Database (Supabase)     ← Stores everything
```

---

## ✨ Key Design Principles

| Principle | What It Means | Example |
|-----------|--------------|---------|
| **Single Responsibility** | Each component/function does ONE thing | A "LessonViewer" component just displays lessons, doesn't handle grades |
| **Feature Isolation** | Related code lives together | All quiz code in `/features/quizzes` |
| **Clear Dependencies** | Know what depends on what | Every component imports what it needs |
| **Progressive Disclosure** | Start simple, add detail as needed | API response has basic lesson data; optional `?include=resources` for more |
| **Obvious Naming** | Names tell you what code does | `useLessonProgress()` not `useLP()` |

---

## 🚀 Adding a New Feature (The Process)

### Example: Add a "Bookmark Lesson" Feature

1. **Frontend**:
   - Create `/features/bookmarks/components/BookmarkButton.tsx`
   - Create `/features/bookmarks/api.ts` with `saveBookmark()` function
   - Import button in lesson page: `<BookmarkButton lessonId={id} />`

2. **Backend**:
   - Create route: `POST /bookmarks` in `src/routes/bookmarks.ts`
   - Route calls controller: `bookmarkController.create()`
   - Controller calls service: `BookmarkService.save()`
   - Service talks to database

3. **Database**:
   - Add `bookmarks` table with columns: `id`, `user_id`, `lesson_id`, `created_at`
   - Add RLS policy: users can only see their own bookmarks

4. **Done!** Feature is end-to-end and isolated.

---

## 🐛 Debugging (If Something's Wrong)

**Flow**: User reports "My quiz isn't saving"

1. **Check Frontend**: Open browser DevTools → Network tab
   - Look for `POST /quizzes/123/submit`
   - See what data was sent
   - See what response came back

2. **Check Backend**: Look at server logs
   - Did Express receive the request?
   - Did validation pass?
   - Did database save succeed?

3. **Check Database**: Run a query
   - `SELECT * FROM submissions WHERE user_id = X AND quiz_id = 123`
   - Is the record there?

4. **Trace backwards**:
   - If database has no record → backend issue
   - If backend shows error → frontend sent bad data
   - If frontend looks fine → check network/CORS

---

## 📚 Technology Choices Explained

| Tech | Why We Use It | Alternative We Rejected |
|------|---------------|-----------------------|
| React | Builds interactive UIs with reusable components | Angular (more complex for small team) |
| TypeScript | Catches bugs before runtime | JavaScript (easier to break things) |
| Express | Lightweight, flexible API framework | Django (heavier, different language) |
| Supabase | Managed PostgreSQL + Auth + Files | Firebase (less flexible), rolling our own DB (too risky) |
| Tailwind | Utility classes for fast styling | Material-UI (lots of unnecessary code) |

---

## 📖 How to Use This Document

**You're a new developer?**
→ Start here, read top-to-bottom

**You need to add a feature?**
→ Read "Adding a New Feature", then look at similar features in codebase

**You're debugging something?**
→ Jump to "Debugging" section and trace the flow

**You need to understand data?**
→ Check "What Gets Stored" and "How Data Flows" sections

---

## 🔗 Next Steps

1. Read the specific **Feature Guides** for details on:
   - Lesson System
   - Quiz Engine
   - Progress Tracking
   - User Authentication

2. Clone and run locally:
   ```bash
   cd app && npm install && npm run dev
   cd backend && npm install && npm start
   ```

3. Open `http://localhost:5173` in browser

---

**Questions?** Review the specific feature documentation or check the codebase patterns.

*Last Updated: 2026-09-07*
