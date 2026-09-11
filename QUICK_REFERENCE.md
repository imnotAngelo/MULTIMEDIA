# Crystal Clear Quick Reference
## Fast Lookup for Common Tasks

---

## 🎯 I Want to...

### Find Code
| Task | Where to Look | File |
|------|---------------|------|
| Add lesson feature | `app/src/features/lessons/` | `components/`, `hooks/`, `api.ts` |
| Add quiz feature | `app/src/features/quizzes/` | `components/`, `hooks/`, `api.ts` |
| Add backend endpoint | `backend/src/features/[name]/` | `routes.ts` |
| Fix styling | `app/src/App.css` or `app/tailwind.config.js` | CSS files |
| Fix authentication | `backend/src/features/auth/` | `controller.ts`, `service.ts` |
| Add database table | `backend/src/database/migrations/` | `.sql` files |
| Change database query | `backend/src/features/[name]/queries.ts` | SQL queries |

### Run Code
| Task | Command | Location |
|------|---------|----------|
| Start frontend | `npm run dev` | `app/` |
| Start backend | `npm start` | `backend/` |
| Build for production | `npm run build` | `app/` or `backend/` |
| Run tests | `npm test` | `app/` or `backend/` |
| Database migrations | `npm run migrate:up` | `backend/` |
| Load sample data | `npm run seed` | `backend/` |

### Debug Something
| Problem | First Check | How |
|---------|------------|-----|
| API not working | Backend is running | Check terminal, does it say "listening on port 3000"? |
| Frontend won't load | Frontend is running | Check terminal, does it say "localhost:5173"? |
| Quiz answers not saving | Network request | Open DevTools → Network tab → look for POST request |
| Data doesn't show | Database query | Run SQL: `SELECT * FROM table_name;` |
| Login not working | JWT token | Check browser → Application tab → LocalStorage |
| Page styling broken | CSS file | Check `App.css` or Tailwind config |

---

## 🏗️ File Structure Cheatsheet

```
Frontend                          Backend
────────────────────────────────  ────────────────────────────────
app/src/                          backend/src/
├── features/                     ├── features/
│   ├── lessons/                  │   ├── auth/
│   ├── quizzes/                  │   ├── lessons/
│   ├── progress/                 │   ├── quizzes/
│   └── auth/                     │   └── progress/
├── pages/                        ├── middleware/
├── shared/                       ├── database/
├── stores/                       ├── lib/
└── App.tsx                       ├── types/
                                  └── app.ts
```

---

## 💻 Code Snippets

### React Component (Frontend)
```tsx
import { useHook } from '../hooks/useHook';
import { Component } from './Component';

export const MyComponent = () => {
  const { data, loading } = useHook();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {data && <Component data={data} />}
    </div>
  );
};
```

### Custom Hook (Frontend)
```tsx
import { useState, useEffect } from 'react';
import * as api from '../api';

export const useMyHook = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.getData().then(setData).finally(() => setLoading(false));
  }, []);
  
  return { data, loading };
};
```

### API Client (Frontend)
```tsx
// api.ts
export const getData = async () => {
  const response = await fetch('/api/endpoint');
  return response.json();
};
```

### Express Route (Backend)
```tsx
// routes.ts
router.get('/:id', verifyAuth, controller.getById);
```

### Controller (Backend)
```tsx
// controller.ts
export const getById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = await service.getById(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
```

### Service (Backend)
```tsx
// service.ts
export const getById = async (id) => {
  const data = await queries.getById(id);
  if (!data) throw new NotFoundError('Not found');
  return data;
};
```

### Query (Backend)
```tsx
// queries.ts
export const getById = async (id) => {
  const result = await db.query(
    'SELECT * FROM table WHERE id = $1',
    [id]
  );
  return result.rows[0];
};
```

### SQL Query (Database)
```sql
SELECT 
  u.id, 
  u.full_name,
  COUNT(lp.id) as lessons_completed
FROM users u
LEFT JOIN lesson_progress lp ON u.id = lp.user_id AND lp.completed = true
GROUP BY u.id
ORDER BY lessons_completed DESC;
```

---

## 🔑 Key Patterns

### State Management
```tsx
// Local state (within component)
const [count, setCount] = useState(0);

// Global state (Zustand)
const user = useAuthStore(state => state.user);
const logout = useAuthStore(state => state.logout);

// Server state (from API)
const { data, loading } = useDataFetch(id);
```

### Error Handling (Backend)
```tsx
// Throw error
if (!found) throw new NotFoundError('Item not found');
if (!authorized) throw new UnauthorizedError('Access denied');
if (invalid) throw new ValidationError('Bad input');

// Catch in middleware
catch (error) {
  next(error);  // Passes to error handler
}
```

### API Response Format
```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Error message"
}
```

---

## 🔐 Authentication

### Login Flow
```
1. Frontend: POST /auth/login
   Body: { email, password }
   
2. Backend: Verify credentials
   
3. Backend: Return JWT token
   
4. Frontend: Store token in localStorage
   
5. Future requests: Include token in Authorization header
   Headers: { Authorization: "Bearer JWT_TOKEN" }
   
6. Backend: Verify token in middleware
```

### Check Current User
```tsx
// Frontend
const user = useAuthStore(state => state.user);

// Backend
const userId = req.user.id;  // Set by auth middleware
```

---

## 📊 Common Queries

### Get user's lessons
```sql
SELECT l.* FROM lessons l
JOIN modules m ON l.module_id = m.id
JOIN courses c ON m.course_id = c.id
JOIN course_enrollments ce ON c.id = ce.course_id
WHERE ce.user_id = $1;
```

### Get user's progress
```sql
SELECT lp.* FROM lesson_progress lp
WHERE lp.user_id = $1;
```

### Get quiz submissions for instructor
```sql
SELECT * FROM assessment_submissions
WHERE assessment_id IN (
  SELECT id FROM assessments WHERE created_by = $1
);
```

### Get user's XP total
```sql
SELECT SUM(amount) as total_xp FROM xp_history WHERE user_id = $1;
```

---

## 🚀 Adding a New Feature (Checklist)

### Backend Setup
- [ ] Create migration: `backend/src/database/migrations/xxx.sql`
- [ ] Run: `npm run migrate:up`
- [ ] Create folder: `backend/src/features/[name]/`
- [ ] Create: `routes.ts`, `controller.ts`, `service.ts`, `queries.ts`
- [ ] Add to `app.ts`: `app.use('/api/[name]', routes);`
- [ ] Test with Postman/curl

### Frontend Setup
- [ ] Create folder: `app/src/features/[name]/`
- [ ] Create: `components/`, `hooks/`, `api.ts`
- [ ] Create `api.ts` with fetch functions
- [ ] Create hooks for state management
- [ ] Create components for UI
- [ ] Add to a page component
- [ ] Test in browser

### Database
- [ ] Add table/columns in migration
- [ ] Add RLS policies for security
- [ ] Add indexes for performance
- [ ] Write SQL in `queries.ts`

---

## 🐛 Debugging Checklist

- [ ] Is the feature running? (Check port/logs)
- [ ] Is the API responding? (Check DevTools Network tab)
- [ ] Is the data correct? (Check Database/SQL)
- [ ] Are permissions correct? (Check RLS/Authorization)
- [ ] Are error messages clear? (Check logs/console)
- [ ] Is data format right? (Check API response shape)

---

## 📱 Testing

### Frontend Testing
```bash
# Run tests
npm test

# Watch mode (re-runs on file change)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Backend Testing
```bash
# Run tests
npm test

# With coverage
npm test -- --coverage
```

### Manual Testing
1. Open browser DevTools (F12)
2. Network tab → watch API calls
3. Console tab → watch for errors
4. Application tab → check storage

---

## 🔗 Helpful Links

| Resource | Link |
|----------|------|
| React Docs | https://react.dev |
| TypeScript Handbook | https://www.typescriptlang.org/docs |
| Express.js Guide | https://expressjs.com/api |
| PostgreSQL Docs | https://www.postgresql.org/docs |
| Supabase Docs | https://supabase.com/docs |
| Tailwind CSS | https://tailwindcss.com/docs |
| Zustand State | https://github.com/pmndrs/zustand |

---

## 🆘 Quick Troubleshooting

**Q: Port 3000 already in use**
```bash
# Find what's using it
lsof -i :3000

# Or use different port
npm start -- --port 3001
```

**Q: Module not found error**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

**Q: TypeScript errors**
```bash
# Check types
npm run type-check

# Usually error tells you exactly what's wrong
```

**Q: Database migration failed**
```bash
# Undo last migration
npm run migrate:down

# Fix the SQL file
# Then try again
npm run migrate:up
```

**Q: Can't connect to Supabase**
```bash
# Check .env file has correct credentials
cat .env

# Try connecting via dashboard directly
# Look for connection errors
```

---

## ✅ Checklist Before Pushing Code

- [ ] No console errors (F12 console tab)
- [ ] All new code has TypeScript types
- [ ] Tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Feature works end-to-end in browser
- [ ] Database changes are in migration file
- [ ] RLS policies added for security
- [ ] Error messages are user-friendly
- [ ] Code is readable and commented
- [ ] Commit message is descriptive

---

**Print this out! Keep it next to you while coding.**

