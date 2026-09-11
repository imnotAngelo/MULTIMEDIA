# Backend Architecture Guide
## How Node.js Code is Organized for Maximum Clarity

---

## 📂 Feature-Based Folder Structure

The backend mirrors the frontend organization: **everything for one feature lives together**.

```
backend/src/
│
├── features/
│   │
│   ├── auth/                           # Authentication & Authorization
│   │   ├── routes.ts                   # POST /auth/login, /auth/register
│   │   ├── controller.ts               # Request handlers
│   │   ├── service.ts                  # Business logic
│   │   ├── middleware.ts               # JWT verification, role checking
│   │   ├── types.ts                    # User, LoginRequest, Token, etc.
│   │   └── queries.ts                  # SQL queries for users table
│   │
│   ├── lessons/                        # Lessons CRUD & Management
│   │   ├── routes.ts                   # GET /lessons, POST /lessons, etc.
│   │   ├── controller.ts               # Handle requests
│   │   ├── service.ts                  # Lesson logic
│   │   ├── types.ts                    # Lesson, LessonRequest, etc.
│   │   └── queries.ts                  # Database operations
│   │
│   ├── quizzes/                        # Quizzes & Scoring
│   │   ├── routes.ts                   # Quiz endpoints
│   │   ├── controller.ts
│   │   ├── service.ts                  # Scoring logic, validation
│   │   ├── scorer.ts                   # Calculate scores, award XP
│   │   ├── types.ts
│   │   └── queries.ts
│   │
│   ├── progress/                       # Student Progress & Dashboard
│   │   ├── routes.ts                   # GET /progress, /dashboard
│   │   ├── controller.ts
│   │   ├── service.ts                  # Aggregate progress data
│   │   ├── types.ts
│   │   └── queries.ts
│   │
│   ├── files/                          # File Uploads & Storage
│   │   ├── routes.ts                   # POST /upload, GET /download
│   │   ├── controller.ts
│   │   ├── service.ts                  # Handle uploads, manage URLs
│   │   ├── storage.ts                  # Supabase storage client
│   │   ├── types.ts
│   │   └── validation.ts               # File size, type checks
│   │
│   └── instructor/                     # Instructor Tools
│       ├── routes.ts
│       ├── controller.ts
│       ├── service.ts
│       ├── types.ts
│       └── queries.ts
│
├── middleware/                         # Shared Middleware
│   ├── auth.ts                         # JWT verification
│   ├── errorHandler.ts                 # Handle errors consistently
│   ├── cors.ts                         # CORS configuration
│   ├── logging.ts                      # Log requests
│   ├── validation.ts                   # Request validation
│   └── roleCheck.ts                    # Role authorization
│
├── database/
│   ├── db.ts                           # PostgreSQL connection pool
│   ├── migrations/                     # Schema changes over time
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_lessons.sql
│   │   └── ...
│   └── seeds/                          # Sample data for development
│       └── sample-data.sql
│
├── lib/                                # Utilities & Helpers
│   ├── jwt.ts                          # JWT creation/verification
│   ├── password.ts                     # Hash/verify passwords
│   ├── email.ts                        # Send emails
│   ├── supabase.ts                     # Supabase client setup
│   ├── errors.ts                       # Custom error classes
│   └── validation.ts                   # Data validation helpers
│
├── types/                              # Global TypeScript Types
│   ├── index.ts                        # Export all types
│   ├── database.ts                     # Database row types
│   └── api.ts                          # API request/response types
│
├── config/                             # Configuration
│   ├── env.ts                          # Environment variables
│   ├── database.ts                     # DB connection options
│   └── logger.ts                       # Logging config
│
└── app.ts                              # Express app setup
```

---

## 🔄 Request Flow Through Backend

Let's trace a request: "Student takes a quiz"

### 1. **Request arrives at Express**
```
POST /api/quizzes/123/submit
Headers: { Authorization: "Bearer JWT_TOKEN" }
Body: { answers: { q1: "A", q2: "B" }, ... }
```

### 2. **Middleware runs (in order)**
```tsx
// middleware/auth.ts - Verify JWT
const user = verifyJWT(token);  // Extract user ID from token

// middleware/errorHandler.ts - Catch errors
// middleware/logging.ts - Log the request
```

### 3. **Router matches the route**
```tsx
// features/quizzes/routes.ts
router.post('/:id/submit', quizController.submitQuiz);
```

### 4. **Controller handles request**
```tsx
// features/quizzes/controller.ts
export const submitQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;
    const studentId = req.user.id;  // From middleware
    const answers = req.body.answers;

    const result = await quizService.submitQuiz(
      quizId,
      studentId,
      answers
    );

    res.json(result);  // Send back to frontend
  } catch (error) {
    // Error middleware catches this
  }
};
```

### 5. **Service contains business logic**
```tsx
// features/quizzes/service.ts
export const submitQuiz = async (quizId, studentId, answers) => {
  // 1. Fetch quiz questions
  const quiz = await getQuiz(quizId);
  
  // 2. Score the answers
  const score = scoreAnswers(quiz, answers);
  
  // 3. Calculate XP reward
  const xp = calculateXP(score, quiz);
  
  // 4. Save submission to database
  const submission = await saveSubmission({
    quizId,
    studentId,
    answers,
    score,
    xp,
  });
  
  // 5. Return results to controller
  return {
    score,
    xp,
    feedback: generateFeedback(quiz, answers),
  };
};
```

### 6. **Queries execute against database**
```tsx
// features/quizzes/queries.ts
export const saveSubmission = async (data) => {
  const query = `
    INSERT INTO quiz_submissions 
      (quiz_id, student_id, answers, score, xp, submitted_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *;
  `;
  
  const result = await db.query(query, [
    data.quizId,
    data.studentId,
    JSON.stringify(data.answers),
    data.score,
    data.xp,
  ]);
  
  return result.rows[0];
};
```

### 7. **Response sent to frontend**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "xp": 50,
    "feedback": "Great job! You got 17 out of 20 correct.",
    "userNewXP": 1250
  }
}
```

---

## 🏗️ Layered Architecture Pattern

Each feature follows this 4-layer structure:

```
┌─────────────────────────────────┐
│ ROUTES (Express routing)        │
│ Defines which handler runs      │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ CONTROLLER (Request handlers)   │
│ Parses input, calls service,    │
│ formats response                │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ SERVICE (Business logic)        │
│ Does the actual work:           │
│ calculations, validations,      │
│ orchestration                   │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ QUERIES (Database operations)   │
│ SQL queries, data persistence   │
└─────────────────────────────────┘
```

### Why this separation?
- **Easy to test**: Mock each layer independently
- **Single responsibility**: Each layer does ONE thing
- **Reusability**: Service can be called from multiple controllers
- **Clarity**: Know exactly where to find code

---

## 📝 Code Examples

### Routes (Defines Endpoints)
```tsx
// features/lessons/routes.ts

import express from 'express';
import { verifyAuth } from '../../middleware/auth';
import { lessonsController } from './controller';

const router = express.Router();

// GET /lessons - List all lessons user has access to
router.get('/', verifyAuth, lessonsController.list);

// GET /lessons/:id - Get single lesson
router.get('/:id', verifyAuth, lessonsController.getById);

// POST /lessons/:id/complete - Mark lesson complete
router.post('/:id/complete', verifyAuth, lessonsController.complete);

export default router;
```

### Controller (Handles Requests)
```tsx
// features/lessons/controller.ts

export const lessonsController = {
  list: async (req, res, next) => {
    try {
      const userId = req.user.id;  // From auth middleware
      const lessons = await lessonService.getUserLessons(userId);
      res.json({ success: true, data: lessons });
    } catch (error) {
      next(error);  // Pass to error middleware
    }
  },

  getById: async (req, res, next) => {
    try {
      const { id: lessonId } = req.params;
      const userId = req.user.id;
      
      const lesson = await lessonService.getLesson(lessonId, userId);
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      
      res.json({ success: true, data: lesson });
    } catch (error) {
      next(error);
    }
  },

  complete: async (req, res, next) => {
    try {
      const { id: lessonId } = req.params;
      const userId = req.user.id;
      const { timeSpent } = req.body;
      
      const result = await lessonService.markComplete(
        lessonId,
        userId,
        timeSpent
      );
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
```

### Service (Business Logic)
```tsx
// features/lessons/service.ts

export const lessonService = {
  getUserLessons: async (userId: string) => {
    // Get lessons user is enrolled in
    const lessons = await lessonQueries.getLessonsByUser(userId);
    
    // For each lesson, get progress
    const withProgress = await Promise.all(
      lessons.map(async (lesson) => ({
        ...lesson,
        progress: await lessonQueries.getProgress(userId, lesson.id),
      }))
    );
    
    return withProgress;
  },

  getLesson: async (lessonId: string, userId: string) => {
    // Verify user has access to this lesson
    const hasAccess = await lessonQueries.checkAccess(userId, lessonId);
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this lesson');
    }
    
    // Get lesson content
    const lesson = await lessonQueries.getById(lessonId);
    
    // Get student's progress
    const progress = await lessonQueries.getProgress(userId, lessonId);
    
    return { ...lesson, progress };
  },

  markComplete: async (lessonId: string, userId: string, timeSpent: number) => {
    // Validate time spent
    if (timeSpent < 0) {
      throw new ValidationError('Time spent must be positive');
    }
    
    // Save progress
    const progress = await lessonQueries.updateProgress(userId, lessonId, {
      completed: true,
      timeSpent,
      completedAt: new Date(),
    });
    
    // Award XP
    const xpAwarded = calculateXP(timeSpent);
    await userQueries.addXP(userId, xpAwarded);
    
    return { progress, xpAwarded };
  },
};
```

### Queries (Database Operations)
```tsx
// features/lessons/queries.ts

export const lessonQueries = {
  getById: async (lessonId: string) => {
    const query = `
      SELECT id, title, content, video_url, duration, resources
      FROM lessons
      WHERE id = $1;
    `;
    const result = await db.query(query, [lessonId]);
    return result.rows[0];
  },

  getLessonsByUser: async (userId: string) => {
    const query = `
      SELECT DISTINCT l.id, l.title, l.content, l.video_url
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      JOIN courses c ON m.course_id = c.id
      JOIN course_enrollments ce ON c.id = ce.course_id
      WHERE ce.user_id = $1
      ORDER BY l.order_index;
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  },

  getProgress: async (userId: string, lessonId: string) => {
    const query = `
      SELECT completed, time_spent, completed_at
      FROM lesson_progress
      WHERE user_id = $1 AND lesson_id = $2;
    `;
    const result = await db.query(query, [userId, lessonId]);
    return result.rows[0] || null;
  },

  updateProgress: async (userId: string, lessonId: string, data: any) => {
    const query = `
      INSERT INTO lesson_progress (user_id, lesson_id, completed, time_spent, completed_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, lesson_id) DO UPDATE
      SET completed = $3, time_spent = $4, completed_at = $5
      RETURNING *;
    `;
    const result = await db.query(query, [
      userId,
      lessonId,
      data.completed,
      data.timeSpent,
      data.completedAt,
    ]);
    return result.rows[0];
  },
};
```

---

## 🛡️ Error Handling

Create custom error classes for different situations:

```tsx
// lib/errors.ts

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}
```

Use them in code:
```tsx
const lesson = await lessonQueries.getById(lessonId);
if (!lesson) {
  throw new NotFoundError(`Lesson ${lessonId} not found`);
}

if (!hasAccess) {
  throw new UnauthorizedError('You cannot access this lesson');
}

if (timeSpent < 0) {
  throw new ValidationError('Time spent must be positive');
}
```

Error middleware catches them:
```tsx
// middleware/errorHandler.ts

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    error: message,
  });
});
```

---

## 🧪 Testing Example

Each layer is independently testable:

```tsx
// __tests__/lessonService.test.ts

import { lessonService } from '../service';
import * as queries from '../queries';

jest.mock('../queries');

describe('lessonService', () => {
  it('marks lesson complete and awards XP', async () => {
    jest.mocked(queries.updateProgress).mockResolvedValue({
      completed: true,
      timeSpent: 600,
    });

    const result = await lessonService.markComplete('lesson-1', 'user-1', 600);

    expect(result.xpAwarded).toBe(50);
    expect(queries.updateProgress).toHaveBeenCalled();
  });
});
```

---

## 🚀 Adding a New Endpoint

1. Create feature folder: `features/newfeature/`
2. Create `routes.ts` with Express routes
3. Create `controller.ts` with request handlers
4. Create `service.ts` with business logic
5. Create `queries.ts` with database operations
6. Import routes in `app.ts`: `app.use('/api/newfeature', newfeatureRoutes)`

**Example**: Adding "Bookmarks"
```
features/bookmarks/
├── routes.ts          # POST /bookmarks, DELETE /bookmarks/:id
├── controller.ts      # Handle bookmark add/remove
├── service.ts         # Bookmark logic
├── queries.ts         # Database operations
└── types.ts           # Bookmark types
```

---

## 💡 Best Practices

✅ **DO**:
- Keep layers separate (don't call queries from routes)
- Use TypeScript for all data structures
- Throw custom errors with appropriate status codes
- Validate all input in controller
- Write JSDoc for functions
- Test each layer independently

❌ **DON'T**:
- Put database queries in controllers
- Mix business logic with request handling
- Return database errors directly to client
- Skip error handling
- Have functions that do multiple things
- Use `any` type

---

## 🔍 Debugging Tips

### Problem: Request fails
1. Check Express logs: `console.log(req.body, req.params)`
2. Check controller is being called
3. Check service logic
4. Check database query

### Problem: Database query fails
1. Test query in database client
2. Check parameter count matches `$1, $2`
3. Check row-level security (RLS) policies
4. Check user has permission

### Problem: Data doesn't match frontend expectations
1. Check API response format in controller
2. Check service returns correct shape
3. Frontend TypeScript types should match API response

