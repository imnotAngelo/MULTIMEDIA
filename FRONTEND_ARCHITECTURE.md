# Frontend Architecture Guide
## How React Code is Organized for Maximum Clarity

---

## 📂 Feature-Based Folder Structure

Instead of organizing by type (all components together, all hooks together), we organize by **feature** (everything for a feature lives together).

```
app/src/
│
├── features/
│   │
│   ├── auth/                           # Authentication (Login, Register, Logout)
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts              # Get current user
│   │   │   └── useLogin.ts             # Login logic
│   │   ├── api.ts                      # API calls: POST /auth/login, etc.
│   │   └── types.ts                    # AuthUser, LoginCredentials, etc.
│   │
│   ├── lessons/                        # Lessons (View, List, Complete)
│   │   ├── components/
│   │   │   ├── LessonCard.tsx          # Small card in list view
│   │   │   ├── LessonViewer.tsx        # Full lesson with video/content
│   │   │   ├── VideoPlayer.tsx         # Video playback
│   │   │   └── ResourceList.tsx        # Downloads, PDFs, etc.
│   │   ├── hooks/
│   │   │   ├── useLessonData.ts        # Fetch lesson by ID
│   │   │   ├── useLessonList.ts        # Fetch user's lessons
│   │   │   └── useMarkComplete.ts      # Mark lesson done
│   │   ├── api.ts                      # API calls for lessons
│   │   └── types.ts                    # Lesson, LessonProgress, etc.
│   │
│   ├── quizzes/                        # Quizzes (Take, View, Results)
│   │   ├── components/
│   │   │   ├── QuizCard.tsx            # Quiz in list
│   │   │   ├── QuizEngine.tsx          # Quiz interface
│   │   │   ├── QuestionRenderer.tsx    # Render single question
│   │   │   ├── AnswerOption.tsx        # Multiple choice option
│   │   │   └── QuizResults.tsx         # Show score and feedback
│   │   ├── hooks/
│   │   │   ├── useQuizData.ts
│   │   │   ├── useQuizState.ts         # Track answers
│   │   │   └── useQuizSubmit.ts
│   │   ├── api.ts
│   │   └── types.ts                    # Quiz, Question, Answer, etc.
│   │
│   ├── progress/                       # Progress & Dashboard
│   │   ├── components/
│   │   │   ├── ProgressCard.tsx        # Current progress display
│   │   │   ├── XPBadge.tsx             # XP counter
│   │   │   ├── CompletionChart.tsx     # Progress bars
│   │   │   └── AchievementsList.tsx
│   │   ├── hooks/
│   │   │   └── useProgress.ts
│   │   ├── api.ts
│   │   └── types.ts                    # Progress, Achievement, etc.
│   │
│   └── instructor/                     # Instructor Dashboard & Tools
│       ├── components/
│       │   ├── CourseEditor.tsx
│       │   ├── LessonUploader.tsx
│       │   ├── GradeViewer.tsx
│       │   └── StudentList.tsx
│       ├── hooks/
│       └── api.ts
│
├── pages/                              # Full page views (what user sees)
│   ├── StudentDashboard.tsx            # Main student view
│   ├── LessonPage.tsx                  # Full lesson + video + resources
│   ├── QuizPage.tsx                    # Quiz taking interface
│   ├── Login.tsx
│   ├── Register.tsx
│   └── InstructorDashboard.tsx
│
├── shared/                             # Reusable everywhere
│   ├── components/                     # Generic UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── LoadingSpinner.tsx
│   │
│   ├── hooks/                          # Generic hooks
│   │   ├── useApi.ts                   # Generic API caller
│   │   ├── useLocalStorage.ts
│   │   └── usePagination.ts
│   │
│   ├── types/                          # Shared types
│   │   ├── index.ts                    # All common types
│   │   └── User.ts
│   │
│   ├── utils/                          # Utility functions
│   │   ├── api.ts                      # HTTP client setup
│   │   ├── date.ts                     # Date formatting
│   │   ├── validation.ts               # Form validation
│   │   └── constants.ts                # Constants (URLs, etc.)
│   │
│   └── styles/
│       ├── globals.css
│       └── themes.css
│
├── stores/                             # Global state (Zustand)
│   ├── authStore.ts                    # User, tokens, permissions
│   ├── lessonStore.ts                  # Cached lesson data
│   └── uiStore.ts                      # UI state (sidebar open, etc.)
│
└── App.tsx                             # Main app component
```

---

## 🎯 Component Design Pattern

Each component follows this structure:

```tsx
// LessonViewer.tsx

import React from 'react';
import { useLessonData } from '../hooks/useLessonData';
import { VideoPlayer } from './VideoPlayer';
import { ResourceList } from './ResourceList';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

interface LessonViewerProps {
  lessonId: string;
  onComplete?: () => void;
}

/**
 * Displays a single lesson with video, content, and resources.
 * Automatically tracks time spent and completion status.
 */
export const LessonViewer: React.FC<LessonViewerProps> = ({ 
  lessonId, 
  onComplete 
}) => {
  const { lesson, isLoading, error } = useLessonData(lessonId);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error loading lesson</div>;
  if (!lesson) return <div>Lesson not found</div>;

  const handleVideoEnd = async () => {
    await markLessonComplete(lessonId);
    onComplete?.();
  };

  return (
    <div className="lesson-viewer">
      <h1>{lesson.title}</h1>
      <VideoPlayer 
        url={lesson.videoUrl} 
        onEnd={handleVideoEnd}
      />
      <div>{lesson.content}</div>
      <ResourceList resources={lesson.resources} />
    </div>
  );
};
```

**Pattern Explanation**:
1. **Imports**: What this component needs
2. **Props Interface**: What data it receives
3. **JSDoc Comment**: What it does
4. **Logic**: Custom hooks for data/state
5. **Loading/Error**: Handle all states
6. **Render**: Simple, clear JSX

---

## 🔑 Custom Hooks Pattern

Hooks extract logic so components stay clean:

```tsx
// hooks/useLessonData.ts

import { useState, useEffect } from 'react';
import * as LessonAPI from '../api';
import { Lesson } from '../types';

interface UseLessonDataReturn {
  lesson: Lesson | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches lesson data by ID.
 * Handles loading and error states.
 */
export const useLessonData = (lessonId: string): UseLessonDataReturn => {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const data = await LessonAPI.getLesson(lessonId);
        setLesson(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLesson();
  }, [lessonId]);

  return { lesson, isLoading, error };
};
```

**Hook Pattern**:
1. State: Data, loading, error
2. Effect: Fetch when component mounts
3. Return: All states together
4. Component uses it: `const { lesson, isLoading } = useLessonData(id)`

---

## 📡 API Module Pattern

Each feature has its own `api.ts` file:

```tsx
// api.ts

import { api } from '@/shared/utils/api';
import { Lesson, LessonProgress } from './types';

/**
 * Fetch all lessons the user has access to
 */
export const getLessonList = async (): Promise<Lesson[]> => {
  const response = await api.get('/lessons');
  return response.data;
};

/**
 * Fetch a specific lesson with all content
 */
export const getLesson = async (lessonId: string): Promise<Lesson> => {
  const response = await api.get(`/lessons/${lessonId}`);
  return response.data;
};

/**
 * Mark a lesson as completed
 */
export const completeLesson = async (
  lessonId: string,
  timeSpent: number
): Promise<LessonProgress> => {
  const response = await api.post(`/lessons/${lessonId}/complete`, {
    timeSpent,
  });
  return response.data;
};
```

**API Pattern**:
1. Use shared `api` client for all requests
2. One function per endpoint
3. Typed return values
4. JSDoc for clarity

---

## 🎨 Component Rules

### ✅ DO:
- Keep components small (one thing each)
- Extract logic to hooks
- Handle loading and error states
- Use TypeScript for all props
- Add JSDoc comments

### ❌ DON'T:
- Put API calls directly in components
- Have components with 100+ lines
- Mix business logic with UI logic
- Use `any` type
- Have components that manage multiple unrelated features

---

## 📊 State Management

### Local State (useState)
Use for UI-only state:
```tsx
const [isModalOpen, setIsModalOpen] = useState(false);
```

### Component State (useContext)
Use for data shared by sibling components:
```tsx
const { user } = useContext(AuthContext);
```

### Global State (Zustand)
Use for app-wide data:
```tsx
const user = useAuthStore((state) => state.user);
```

### Server State (React Query / Hooks)
Use for fetched data:
```tsx
const { data: lesson } = useLessonData(id);
```

---

## 🧪 Testing Pattern

Each feature can be tested in isolation:

```tsx
// __tests__/LessonViewer.test.tsx

import { render, screen } from '@testing-library/react';
import { LessonViewer } from '../components/LessonViewer';
import * as LessonAPI from '../api';

jest.mock('../api');

describe('LessonViewer', () => {
  it('displays lesson content', async () => {
    const mockLesson = {
      id: '1',
      title: 'Intro to Video',
      content: 'Learn video basics',
      videoUrl: 'https://example.com/video.mp4',
      resources: [],
    };

    jest.mocked(LessonAPI.getLesson).mockResolvedValue(mockLesson);

    render(<LessonViewer lessonId="1" />);

    expect(await screen.findByText('Intro to Video')).toBeInTheDocument();
  });
});
```

---

## 🚀 Adding a New Feature

1. Create `/features/newfeature/` folder
2. Create `components/`, `hooks/`, `api.ts`, `types.ts`
3. Create page in `/pages/`
4. Add route to `App.tsx`
5. Done!

**Example**: Adding "Notes" feature
```
features/notes/
├── components/
│   ├── NotesList.tsx
│   └── NoteEditor.tsx
├── hooks/
│   ├── useNotes.ts
│   └── useNoteEditor.ts
├── api.ts
└── types.ts
```

