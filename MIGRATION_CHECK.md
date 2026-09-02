# SQL Migration Status Check

## 🔴 CURRENT STATUS: SQL MIGRATION NOT EXECUTED

The archiving feature cannot work without these database columns:
- `lessons.year_level`
- `assessments.year_level`
- `laboratories.year_level`

## 📋 EXACT STEPS TO FIX

### Step 1: Go to Supabase Dashboard
Visit: https://app.supabase.com/

### Step 2: Find Your Project
Look for your project and click it

### Step 3: Open SQL Editor
- In the left sidebar, click **SQL Editor**
- Click the **+ New Query** button

### Step 4: Copy This SQL (Exactly)
```sql
-- Add year_level columns to lessons
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

-- Add year_level columns to assessments
ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

-- Add year_level columns to laboratories
ALTER TABLE laboratories 
ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

-- Tag all existing lessons with semester 1
UPDATE lessons SET year_level = 1 WHERE year_level IS NULL;

-- Tag all existing assessments with semester 1
UPDATE assessments SET year_level = 1 WHERE year_level IS NULL;

-- Tag all existing laboratories with semester 1
UPDATE laboratories SET year_level = 1 WHERE year_level IS NULL;
```

### Step 5: Click "Run"
- Click the blue **Run** button at bottom right
- Wait for it to complete (should take 2-5 seconds)

### Step 6: Verify Success
You should see output like:
```
ALTER TABLE — SQL — 28ms
ALTER TABLE — SQL — 25ms
ALTER TABLE — SQL — 26ms
UPDATE 0 rows — SQL — 15ms
UPDATE 0 rows — SQL — 12ms
UPDATE 0 rows — SQL — 18ms
```

### Step 7: Test Verification
Run this query to confirm:
```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('lessons', 'assessments', 'laboratories') 
AND column_name = 'year_level'
ORDER BY table_name;
```

You should see 3 rows showing `year_level` exists in each table.

---

## ⚠️ IF YOU SEE ERRORS

### Error: "column already exists"
```
ERROR: column "year_level" of relation "lessons" already exists
```
This is OK! It means the columns exist. Just run the UPDATE statements.

### Error: "relation does not exist"
```
ERROR: relation "lessons" does not exist
```
This means the tables don't exist. Contact support.

---

## ✅ AFTER MIGRATION: RESTART EVERYTHING

1. **Go back to VS Code**
2. **Stop the backend** (Ctrl+C in backend terminal)
3. **Stop the frontend** (Ctrl+C in app terminal)
4. **Start backend again**: `cd backend && npm run dev`
5. **Start frontend again**: `cd app && npm run dev`
6. **Hard refresh browser**: `Ctrl+Shift+R`

---

## 🚀 TEST THE FIX

1. Login to dashboard
2. Go to **Settings**
3. **Change semester** (e.g., 1st Sem → 2nd Sem)
4. **Click "Update Teaching Semester"**
5. **Confirm dialog**
6. **Wait 3 seconds** (do NOT refresh yet)
7. **Check backend console** - should show:
   ```
   🔄 SEMESTER CHANGE DETECTED: 1 → 2
   📦 ARCHIVING: Student xxx changing from semester 1 to 2
   ✅ Column check passed. Found X lessons with year_level=1
   ✅ Archived modules - Error: None
   ✅ Archived lessons - Error: None
   ✅ Archived assessments & quizzes - Error: None
   ✅ Archived laboratories - Error: None
   📦 ARCHIVING COMPLETE for student xxx
   ✅ PROFILE UPDATED: year_level=2
   ```

8. **Check dashboard** - should show:
   - ✅ All old units/lessons are GONE
   - ✅ "Archives" section appears with old content
   - ✅ NO logout happens
   - ✅ Dashboard loads with new semester's content

---

## 🆘 STILL NOT WORKING?

If after the migration and restart, you STILL see old content:

1. **Share backend console logs** (the [SEMESTER UPDATE] messages)
2. **Share browser console logs** (the api calls)
3. **Check if year_level column really exists** - run verification query in Supabase

---

**Do this NOW and message me when it's done!**
