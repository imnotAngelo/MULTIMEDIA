# 🎬 Video & App Link Feature - Setup Guide

## ✅ Completed
- ✅ Storage buckets created (`lesson-videos`, `avatars`)
- ✅ Backend API endpoints ready
- ✅ Frontend UI implemented

## ⏳ Required: Run SQL in Supabase Dashboard

### Step 1: Add Database Columns
1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste this SQL:

```sql
-- Add video and app management fields to lessons table
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS app_link TEXT,
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_lessons_video_url ON lessons(video_url) WHERE video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_app_link ON lessons(app_link) WHERE app_link IS NOT NULL;
```

5. Click **Run** (or Cmd+Enter)
6. You should see: "Success" ✅

### Step 2: Verify Columns Were Created
Run this query to verify:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lessons' 
AND column_name IN ('video_url', 'app_link', 'app_name');
```

Expected result: 3 rows (video_url, app_link, app_name)

---

## 📋 Complete SQL Migration File

The migration file is stored at:
- `backend/add-lesson-video-app.sql`

You can also run it manually in the SQL Editor if needed.

---

## 🔧 Backend Routes Ready

After completing the SQL setup above, these endpoints will work:

### Upload Video File
```
POST /api/units/lessons/{lessonId}/upload-video
Headers: Authorization: Bearer {token}
Body: FormData with "video" file (max 500MB)
```

### Update Lesson Metadata
```
PUT /api/units/lessons/{lessonId}/metadata
Headers: Authorization: Bearer {token}
Body: {
  "video_url": "https://...",  // Optional
  "app_link": "https://...",   // Optional
  "app_name": "Adobe Photoshop" // Optional
}
```

---

## 🚀 Next Steps

After running the SQL in Supabase:

1. Reload your app (http://localhost:5175)
2. Go to Unit Management
3. Select a lesson
4. Click "Edit Media & Tools"
5. Upload a video or add app links
6. Click Save

Everything should work! 🎉

---

## 📝 Storage Bucket Configuration

The `lesson-videos` bucket was created with:
- **Public access**: Enabled (so videos can be viewed by students)
- **File size limit**: 500MB max
- **Allowed formats**: MP4, WebM, OGG, MOV, AVI, MKV

---

## ❓ Troubleshooting

### Still getting "Bucket not found"?
- Make sure the SQL migration was run
- Refresh your browser (Ctrl+F5)
- Check browser console for errors

### Video upload says "Supabase unavailable"?
- Check backend logs (terminal running `npm run dev`)
- Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are in `.env`

### Need to delete and recreate a bucket?
```bash
# In Supabase dashboard, go to Storage
# Click the 3-dot menu on "lesson-videos"
# Click "Delete bucket"
# Then run: node setup-storage-buckets.mjs
```

---

Generated: 2026-09-02
