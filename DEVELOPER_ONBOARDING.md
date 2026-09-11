# Developer Onboarding Guide
## Getting Started with the Interactive Learning Platform

---

## ⏱️ 5-Minute Quick Start

### 1. Clone and Setup
```bash
git clone <repo>
cd Interacticelearning

# Install frontend dependencies
cd app
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Environment Setup
Create `.env` files for configuration:

```bash
# backend/.env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
PORT=3000
NODE_ENV=development

# app/.env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=xxx
```

### 3. Start Development
```bash
# Terminal 1: Backend
cd backend
npm start              # Runs on http://localhost:3000

# Terminal 2: Frontend
cd app
npm run dev            # Runs on http://localhost:5173
```

### 4. Open in Browser
Go to `http://localhost:5173` → Log in with test account

---

## 🗺️ System Map (One Page Overview)

```
┌─────────────────────────────────────────────────────────────┐
│                    WHAT YOU SEE                             │
│  React Frontend (app/) - Browser at localhost:5173          │
│  - Dashboards, lesson viewers, quizzes, login              │
│  - Code: TypeScript, React, Tailwind CSS                    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS JSON Requests
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  THE BACKEND LOGIC                          │
│  Node.js Express Server (backend/) - localhost:3000         │
│  - Handles requests, verifies auth, calculates scores       │
│  - Code: TypeScript, Express, PostgreSQL queries            │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL Queries
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA STORAGE                              │
│  Supabase (PostgreSQL + Auth + File Storage)                │
│  - Users, courses, lessons, progress, files                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Folder Guide

### **app/** - Frontend React Code
```
app/src/
├── features/          ← Feature modules (lessons, quizzes, etc.)
├── pages/             ← Full page components
├── shared/            ← Reusable UI components
├── stores/            ← Global state (Zustand)
└── App.tsx            ← Main app
```

**Common Tasks**:
- Add a new UI component? → `app/src/features/[feature]/components/`
- Add a new page? → `app/src/pages/`
- Fix styling? → `app/src/shared/components/` or `app/src/App.css`

### **backend/** - Node.js Express API
```
backend/src/
├── features/          ← Feature modules (auth, lessons, quizzes)
├── middleware/        ← Request processing (auth, errors)
├── database/          ← Database connections & migrations
├── lib/               ← Utilities (JWT, passwords, errors)
└── app.ts             ← Express setup
```

**Common Tasks**:
- Add an API endpoint? → `backend/src/features/[feature]/routes.ts`
- Fix a business logic issue? → `backend/src/features/[feature]/service.ts`
- Need a database query? → `backend/src/features/[feature]/queries.ts`

---

## 🔄 Typical Development Flow

### Adding a New Feature (Bookmark Lessons)

**1. Database**
```bash
# Create migration file
cd backend/src/database/migrations
touch 006_create_bookmarks.sql
```

Write SQL:
```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_see_own_bookmarks ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);
```

Run migration:
```bash
npm run migrate:up    # In backend folder
```

**2. Backend API**
```bash
cd backend/src/features
mkdir bookmarks
touch bookmarks/routes.ts bookmarks/controller.ts bookmarks/service.ts
```

Write `bookmarks/routes.ts`:
```tsx
router.post('/:lessonId', verifyAuth, controller.toggleBookmark);
router.get('/', verifyAuth, controller.getBookmarks);
```

Write `bookmarks/controller.ts`:
```tsx
export const toggleBookmark = async (req, res) => {
  const lessonId = req.params.lessonId;
  const userId = req.user.id;
  const result = await bookmarkService.toggle(userId, lessonId);
  res.json({ success: true, data: result });
};
```

Write `bookmarks/service.ts`:
```tsx
export const toggle = async (userId, lessonId) => {
  // Check if already bookmarked
  const existing = await query.findBookmark(userId, lessonId);
  
  if (existing) {
    // Remove bookmark
    await query.removeBookmark(userId, lessonId);
    return { bookmarked: false };
  } else {
    // Add bookmark
    await query.addBookmark(userId, lessonId);
    return { bookmarked: true };
  }
};
```

Add to `app.ts`:
```tsx
import bookmarkRoutes from './features/bookmarks/routes';
app.use('/api/bookmarks', bookmarkRoutes);
```

**3. Frontend Components**
```bash
cd app/src/features
mkdir bookmarks
touch bookmarks/BookmarkButton.tsx bookmarks/api.ts bookmarks/hooks.ts
```

Write `BookmarkButton.tsx`:
```tsx
export const BookmarkButton = ({ lessonId }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  const handleClick = async () => {
    const result = await toggleBookmark(lessonId);
    setIsBookmarked(result.bookmarked);
  };
  
  return (
    <button onClick={handleClick}>
      {isBookmarked ? '❤️ Bookmarked' : '🤍 Bookmark'}
    </button>
  );
};
```

Use in lesson page:
```tsx
// In LessonPage.tsx
<BookmarkButton lessonId={lesson.id} />
```

**4. Test**
- Frontend: http://localhost:5173 → View lesson → Click bookmark
- Check database: Query `SELECT * FROM bookmarks WHERE user_id = 'X'`
- Check backend logs: Should see API calls

---

## 🐛 Debugging: The Flow

**User reports: "Can't save quiz answers"**

### Step 1: Check Frontend
Open browser DevTools (F12):
```
Network tab → Look for "POST /api/quizzes/submit"
  ✓ Is it being sent? 
  ✓ What data is in the body?
  ✓ What status code is returned?
  ✓ What's in the response?
```

### Step 2: Check Backend
Look at server logs:
```bash
# Terminal where backend is running
[2026-09-07] POST /api/quizzes/submit - 200 OK
[2026-09-07] Student ID: student-123
[2026-09-07] Quiz score: 85
```

Or add debugging:
```tsx
// In quizController.ts
console.log('Received answers:', req.body);
console.log('User ID:', req.user.id);
const result = await quizService.submitQuiz(...);
console.log('Submission result:', result);
```

### Step 3: Check Database
Connect to Supabase and run:
```sql
SELECT * FROM assessment_submissions 
WHERE user_id = 'student-123' 
ORDER BY submitted_at DESC 
LIMIT 5;
```

Is the record there? 
- Yes → Problem is in frontend display
- No → Problem is in backend/database layer

### Step 4: Trace Backwards
- Database has no record → Backend didn't save
- Backend shows error in logs → Check service logic
- Service throws error → Check validation or API call
- API doesn't work → Check network request format

---

## 📚 Key Files Reference

| What You Need | File | What It Does |
|---------------|------|------------|
| Learn system architecture | [CRYSTAL_CLEAR_DESIGN.md](CRYSTAL_CLEAR_DESIGN.md) | Overview of everything |
| Frontend patterns | [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | React code organization |
| Backend patterns | [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) | Express code organization |
| Database schema | [DATABASE_DESIGN.md](DATABASE_DESIGN.md) | Tables and relationships |
| Run locally | This file (Onboarding) | Getting started |

---

## 🚀 Common Commands

### Frontend
```bash
cd app

npm install                # Install dependencies
npm run dev               # Start dev server (localhost:5173)
npm run build             # Build for production
npm run lint              # Check code quality
npm run type-check        # Check TypeScript errors
```

### Backend
```bash
cd backend

npm install                # Install dependencies
npm start                 # Start server (localhost:3000)
npm run migrate:up        # Run database migrations
npm run migrate:down      # Undo migrations
npm run seed              # Load sample data
npm test                  # Run tests
```

---

## 🧪 Testing

### Frontend Tests
```bash
cd app
npm run test              # Run Jest tests
npm run test:watch       # Watch mode
```

### Backend Tests
```bash
cd backend
npm run test
npm run test:coverage    # See which code is tested
```

---

## 🔑 Important Concepts

### Authentication Flow
1. User enters email/password on login page
2. Frontend sends to `POST /api/auth/login`
3. Backend verifies credentials with Supabase
4. Backend returns JWT token
5. Frontend stores token (in browser storage)
6. All future requests include token in header
7. Backend verifies token before processing

### Authorization (Roles)
```
Student → Can view own lessons/progress
Instructor → Can manage own courses/see submissions
Admin → Can view everything (read-only)
```

### Progress Tracking
```
Student completes lesson → Frontend calls `POST /lessons/123/complete`
Backend → Updates lesson_progress table + awards XP
Dashboard → Automatically refreshes with new XP
```

---

## 🆘 If Something's Broken

### Backend Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check environment variables
cat .env

# Look at error message carefully
```

### Database Connection Fails
```bash
# Check Supabase URL in .env is correct
# Check API key is valid
# Try connecting via Supabase dashboard directly
```

### Frontend won't load
```bash
# Check backend is running first
# Clear browser cache (Ctrl+Shift+Delete)
# Check browser console for errors (F12)
# Try different port: npm run dev -- --port 5174
```

### RLS Policy blocking access
```sql
-- Check what policies exist
SELECT * FROM pg_policies WHERE tablename = 'lessons';

-- Temporarily disable for debugging
ALTER TABLE lessons DISABLE ROW LEVEL SECURITY;

-- Re-enable when done
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
```

---

## 📖 How to Learn the Codebase

### Day 1: Understand the System
- Read [CRYSTAL_CLEAR_DESIGN.md](CRYSTAL_CLEAR_DESIGN.md) (30 min)
- Run the app locally (30 min)
- Click around the UI, understand what users do

### Day 2: Understand Frontend
- Read [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) (1 hour)
- Open `app/src/features/lessons/` folder
- Read `LessonViewer.tsx`, `useLessonData.ts`, `api.ts`
- Follow the code: what does it do?

### Day 3: Understand Backend
- Read [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) (1 hour)
- Open `backend/src/features/lessons/` folder
- Read `routes.ts` → `controller.ts` → `service.ts` → `queries.ts`
- See how data flows

### Day 4: Understand Database
- Read [DATABASE_DESIGN.md](DATABASE_DESIGN.md) (1 hour)
- Open Supabase dashboard
- Look at actual tables, relationships
- Run a few test queries

### Day 5: Make a Small Change
- Add a new field to lesson (e.g., "difficulty level")
- Update database (migration)
- Update backend (API)
- Update frontend (UI)
- Test end-to-end

---

## 💡 Pro Tips

1. **Use browser DevTools constantly** (F12)
   - Network tab to see API requests
   - Console tab for errors
   - Application tab to view stored data

2. **Log everything during debugging**
   ```tsx
   console.log('🎯 checkpoint name:', variable);
   ```

3. **TypeScript catches bugs early**
   - If TypeScript complains, listen to it!
   - Don't use `any` type

4. **Test your changes**
   - Manual testing in browser
   - Unit tests for critical logic
   - Check database directly

5. **Commit frequently**
   ```bash
   git add .
   git commit -m "Add bookmark feature"
   ```

---

## 🎓 Key Takeaways

✨ **This system is organized by FEATURE**:
- All lesson code in `/lessons/`
- All quiz code in `/quizzes/`
- Each feature has same 4-layer structure (routes → controller → service → queries)

🏗️ **Data flows in ONE DIRECTION**:
- Frontend → Backend → Database → Back to Frontend

🔐 **Security is multi-layered**:
- JWT tokens authenticate users
- Row-level security in database
- Input validation at every step

🚀 **Adding features is systematic**:
1. Database (add table/column)
2. Backend (add route/logic)
3. Frontend (add component)
4. Test end-to-end

---

## 📞 Getting Help

1. **Check the documentation** first (this file, architecture guides)
2. **Search the codebase** for similar code patterns
3. **Read error messages** carefully
4. **Use browser DevTools** to debug
5. **Check database directly** to verify data
6. **Ask for help** (share error message + what you've tried)

---

**Last Updated**: 2026-09-07
**Version**: 1.0 - Crystal Clear Design

Questions? Read the architecture guides. Already have an answer there!

