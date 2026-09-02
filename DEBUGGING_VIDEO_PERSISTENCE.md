# 🎬 VIDEO PERSISTENCE - COMPREHENSIVE DEBUGGING GUIDE

## Issue Summary
Videos upload successfully but disappear on page refresh.

**Root cause investigation:**
- ✅ Database IS storing video_url correctly
- ✅ Storage bucket IS saving files correctly
- ✅ Backend controller IS returning video_url in API response
- ✅ Frontend component HAS video_url field defined
- ✅ Rendering logic HAS check for `activeLesson.video_url`
- ❓ **UNKNOWN**: Is frontend actually RECEIVING video_url from API?

---

## STEP 1: Get Your Auth Token

1. Open browser DevTools: Press `F12`
2. Go to **Console** tab
3. Paste this command:
   ```javascript
   console.log('Access Token:', localStorage.getItem('access_token'));
   ```
4. Copy the long token that appears (starts with `eyJ...`)

---

## STEP 2: Test the API Directly

Replace `YOUR_TOKEN_HERE` with your actual token from Step 1:

```bash
# Test 1: Get units
curl -X GET http://localhost:3001/api/units \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq .

# Test 2: Get lessons for a unit (replace UNIT_ID)
# Copy a unit ID from Test 1 output (looks like: "12345678-abcd-...")
curl -X GET http://localhost:3001/api/units/UNIT_ID/lessons \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq '.data[0] | {title, video_url, app_link, app_name}'
```

### What to Look For

**✅ SUCCESS**: The API response includes:
```json
{
  "title": "Lesson Name",
  "video_url": "https://ciopmrwvmgqsbapyljih.supabase.co/storage/...",
  "app_link": null,
  "app_name": null
}
```

**❌ FAILURE**: The response is missing video fields:
```json
{
  "title": "Lesson Name",
  "content": "...",
  "slides": []
  // ❌ NO video_url, app_link, app_name
}
```

---

## STEP 3: Check Browser Console

1. Open the browser on your app (http://localhost:5175)
2. Go to **DevTools Console** (F12 → Console)
3. Look for logs like:
   ```
   ✅ Total lessons loaded: 5 [Array(5)]
   ```
4. Click on the array to expand it
5. Look for one of the lessons and check if it has:
   - `video_url` field
   - `app_link` field
   - `app_name` field

**If fields are missing:** The API is not returning them correctly.
**If fields are present:** Frontend has the data but may not be displaying it.

---

## STEP 4: Network Tab Analysis

1. Open **DevTools Network** tab (F12 → Network)
2. Reload the page (F5)
3. Look for requests to:
   - `http://localhost:3001/api/units`
   - `http://localhost:3001/api/units/[id]/lessons`
4. Click on each request and check the **Response** tab
5. Search for `"video_url"` in the response

---

## STEP 5: Upload a New Video and Test

1. Go to instructor courses page
2. Edit a lesson
3. Upload a NEW video (don't use old ones - they have wrong paths)
4. Wait for "✅ Video uploaded successfully"
5. **DO NOT REFRESH YET**
6. Check browser Console - log says video was uploaded
7. Now refresh the page
8. Check if video still appears

---

## Expected Files and Their Status

### Database Level ✅
- **Table**: `lessons`
- **Columns**: `video_url`, `app_link`, `app_name`
- **Status**: All columns exist and have data

### Storage Level ✅
- **Bucket**: `lesson-videos`
- **Files**: Stored in `lesson-videos/` subfolder
- **Access**: Public URLs work (HTTP 200)

### Backend Level ✅
- **File**: `backend/src/controllers/unitsController.ts`
- **Function**: `getUnitLessons()`
- **Status**: Returns video fields in both active and archived lessons

### Frontend Level ❓
- **File**: `app/src/pages/student/Lessons.tsx`
- **Status**: Has interface, rendering logic, but...
- **Question**: Is it receiving video_url from API?

---

## Common Issues and Fixes

### Issue 1: API Not Returning video_url

**Symptom**: Test 2 shows no `video_url` field

**Fix**: Restart backend
```bash
cd backend
npm run dev
```

### Issue 2: Videos Exist But Not Showing

**Symptom**: Console shows videos loaded but UI doesn't show them

**Fix**: Clear browser cache and localStorage
```javascript
// In DevTools Console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Issue 3: Old Videos Have Wrong Paths

**Symptom**: Lesson in database has URL with `lesson-videos/lesson-videos`

**Fix**: Upload NEW videos - they'll use correct path

### Issue 4: Frontend Not Getting Updated Data

**Symptom**: Video appears right after upload, gone after refresh

**Possible causes:**
- Frontend is caching lesson data
- State is not being properly cleared on refresh
- Component is using stale data

**Fix**: Add debugging to frontend:
```typescript
// In Lessons.tsx, after loadData():
console.log('All lessons with videos:');
lessons.forEach(l => {
  if (l.video_url) console.log(`${l.title}: ${l.video_url}`);
});
```

---

## Verification Checklist

Run through these in order:

- [ ] Step 1: Get auth token from browser
- [ ] Step 2: Test API calls - do they return video_url?
- [ ] Step 3: Check browser console - are lessons logged with video fields?
- [ ] Step 4: Check Network tab - is video_url in responses?
- [ ] Step 5: Upload new video and test persistence
- [ ] Bonus: Check database directly:
  ```bash
  cd backend
  node check-lessons.mjs
  ```

---

## If You Find the Problem

**Found missing video_url in API responses?**
→ The backend controller is not returning it
→ Fix: Check `backend/src/controllers/unitsController.ts`
→ Make sure the lesson mapping includes `video_url: l.video_url || ''`

**Found video_url in API but not in UI?**
→ Frontend rendering issue
→ Fix: Add console.log in Lessons.tsx to verify component receives it
→ Check conditional: `{activeLesson.video_url &&`

**Everything present but still disappears on refresh?**
→ Frontend state management issue
→ Likely cause: Component doesn't properly re-fetch on mount
→ Fix: Ensure useEffect has correct dependency array

---

## Quick Diagnostic Command

```bash
# Run this to check database
cd c:\Users\libro\OneDrive\Documents\Interacticelearning\backend
$env:SUPABASE_SERVICE_KEY=(Get-Content .env | Select-String SUPABASE_SERVICE_KEY).ToString().Split('=')[1]
node check-lessons.mjs
```

Expected output shows lessons with their video URLs stored in database.
