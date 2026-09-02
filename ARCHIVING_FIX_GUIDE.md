# 🔧 SEMESTER ARCHIVING - COMPLETE FIX GUIDE

## 🚨 THE ISSUE
When you change semester, old content is NOT being archived. It's still visible in the dashboard.

## 🔍 ROOT CAUSES
1. **Database columns missing**: `year_level` column doesn't exist in lessons, assessments, or laboratories tables
2. **Existing content not tagged**: Content created before now has NULL or wrong year_level values
3. **Frontend not refreshing**: Dashboard needs to reload to show the changes

## ✅ THE COMPLETE FIX

### STEP 1: Execute SQL Migration (CRITICAL!)

1. Go to **Supabase Dashboard** → https://app.supabase.com/
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **"New Query"**
5. Copy & paste the ENTIRE content from: `backend/setup-archiving.sql`
6. Click **"Run"** button
7. Wait for ✅ **all queries to complete successfully**

If you see any errors about "relation does not exist", this is expected for the verification queries - just proceed.

### STEP 2: Verify Database Setup

After running the SQL, check the output:
- You should see table summaries showing lesson/assessment/laboratory counts
- All content should show `year_level` values of 1

### STEP 3: Restart Backend

```bash
cd backend
npm run dev
```

Wait for it to say "Server running" 

### STEP 4: Restart Frontend

In another terminal:
```bash
cd app
npm run dev
```

### STEP 5: Hard Refresh Browser

```
Ctrl+Shift+R  (Windows/Linux)
or
Cmd+Shift+R   (Mac)
```

### STEP 6: TEST THE ARCHIVING

1. **Go to Student/Instructor Settings**
2. **Look at "Update Semester" section**
3. **Select a DIFFERENT semester** than your current one
4. **Click "Update Teaching Semester" button**
5. **Confirm the dialog**
6. **Wait for success message** (may take a few seconds)
7. **Automatically redirected to Dashboard**

### STEP 7: VERIFY RESULTS

**Check Browser Console** (F12 → Console):
- Should see logs like:
  ```
  📝 Sending semester update request: 2
  📝 Update response: {...}
  ✅ Semester updated successfully
  ```

**Check Backend Terminal** (where you ran `npm run dev`):
- Should see logs like:
  ```
  🔄 UPDATE PROFILE: userId=xxx, year_level=2
  Current user - year_level=1, role=student
  🔍 Validating year_level: received=2, parsed=2
  🔄 SEMESTER CHANGE DETECTED: 1 → 2
  📦 ARCHIVING: Student xxx changing from semester 1 to 2
    ✅ Column check passed. Found XXX lessons with year_level=1
    ✅ Archived lessons - Error: None
    ✅ Archived assessments & quizzes - Error: None
    ✅ Archived laboratories - Error: None
  📦 ARCHIVING COMPLETE for student xxx
  ✅ PROFILE UPDATED: year_level=2
  ```

**Check Dashboard**:
- ✅ **Old content is GONE** from main view
- ✅ **Archives section appears** with expandable arrow
- ✅ **Click Archives** to see old semester content

## 🐛 TROUBLESHOOTING

### If content STILL doesn't disappear:

1. **Check backend logs** - Do you see the archiving log messages?
   - If NO: The endpoint wasn't called
   - If YES: Check the "Error" messages

2. **If you see "column "year_level" does not exist"**:
   - The SQL didn't run successfully
   - Go back to Supabase and run the SQL again, make sure you see the ✅ checkmark

3. **If logs show archiving completed but content still there**:
   - Hard refresh browser (Ctrl+Shift+R)
   - Clear browser cache
   - Close browser completely and reopen

4. **Check the debug endpoint** (for dev only):
   ```
   GET http://localhost:5000/api/users/debug/archive-state
   (Must be logged in)
   ```
   This will show the current database state

## 📋 WHAT TO DO NEXT

After the fix works:

1. **Test with different semesters**: Change from 1→2, then 2→3, etc.
2. **Verify archives**: Make sure old content appears in Archives section
3. **Create new content**: Add a new lesson while in semester 2
   - This new lesson should be tagged with year_level=2
   - When you switch to semester 3, only this lesson won't be archived

4. **Test re-switching**: Go back to semester 1
   - The old archived content should reappear
   - New semester 2 content should be archived

## 🆘 IF NOTHING WORKS

Run this SQL to check the actual database state:

```sql
-- Check column existence
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('lessons', 'assessments', 'laboratories')
AND column_name = 'year_level'
ORDER BY table_name;

-- Check data
SELECT COUNT(*), year_level, status FROM lessons GROUP BY year_level, status;
SELECT COUNT(*), year_level, status FROM assessments GROUP BY year_level, status;
SELECT COUNT(*), year_level, status FROM laboratories GROUP BY year_level, status;
```

Share the output and I can help further! 🚀
