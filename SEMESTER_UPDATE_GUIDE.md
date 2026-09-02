# Semester Update & Student Progress Clear Guide

## Overview

This feature allows instructors to seamlessly transition to a new semester while automatically clearing all student progress, submissions, and quiz data from the previous semester. This ensures a clean slate for each new academic term.

## Features

### What Gets Cleared

When an instructor updates to a new semester, the system automatically clears:

1. **Lesson Progress** - All student completion records for lessons
2. **Laboratory Submissions** - All student lab work submissions and scores
3. **Assessment/Quiz Submissions** - All student quiz attempts and answers
4. **Dashboard Data** - Student progress statistics are reset

### What is NOT Cleared

- Student accounts and enrollments
- Course content (units, lessons, labs, quizzes)
- Student user profiles and personal information
- Historical records (can be accessed via database if needed)

## How to Use

### Step 1: Access Semester Management

1. Navigate to **Instructor Dashboard**
2. You'll see a blue "Semester Management" card at the top
3. Click **"Update Semester"** button

### Step 2: Select Teaching Semesters

In the dialog that opens:

1. Choose one or more semesters:
   - **1st Semester** (Violet)
   - **2nd Semester** (Blue)
   - **Summer** (Amber)

2. Optionally, specify teaching sections:
   - Enter section codes (e.g., A, B, C)
   - Click "Add" or press Enter
   - Remove sections by clicking the ✕ button

### Step 3: Review & Confirm

1. Review the summary showing:
   - Selected semesters
   - Teaching sections
   - Data that will be cleared

2. Click **"Update Semester"** to proceed

3. **WARNING**: This action cannot be undone. All student progress will be permanently cleared.

## Data Clearing Process

The system performs the following steps:

```
1. ✅ Update instructor profile with new teaching semesters/sections
2. ✅ Fetch all courses created by instructor
3. ✅ Clear lesson progress for all students
4. ✅ Clear laboratory submissions
5. ✅ Clear assessment/quiz submissions
6. ✅ Complete
```

## API Endpoint

### POST `/api/users/update-semester`

**Authentication**: Required (instructor role)

**Request Body**:
```json
{
  "teaching_year_levels": [1, 2],
  "teaching_sections": ["A", "B", "C"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Semester updated and student progress cleared successfully",
  "data": {
    "timestamp": "2026-09-02T14:30:00.000Z",
    "instructor_id": "uuid",
    "cleared": {
      "lesson_progress": 150,
      "lab_submissions": 45,
      "assessment_submissions": 120
    },
    "steps": [
      { "name": "Update instructor profile", "status": "success" },
      { "name": "Fetch instructor courses", "count": 5, "status": "success" },
      // ... more steps
    ]
  }
}
```

## Database Changes

The following tables are affected:

### users table
- `teaching_year_levels` - Array of semester numbers [1, 2, 3]
- `teaching_sections` - Array of section codes ['A', 'B', 'C']

### Data Cleared
- `lesson_progress` - Student lesson completion records
- `laboratory_submissions` - Student lab submissions
- `assessment_submissions` - Student quiz/assessment submissions

## Success Indicators

After updating the semester, you should see:

1. **Toast Notification**: 
   ```
   ✅ Semester updated! Cleared 150 lesson progress, 45 lab submissions, 
      and 120 quiz submissions
   ```

2. **Updated Dashboard**: 
   - Progress stats reset to 0
   - Units remain unchanged
   - Lessons remain unchanged

3. **Database State**:
   - Instructor profile updated with new semesters
   - All student submission tables cleared for this instructor's courses
   - Logs show completion in server console

## Troubleshooting

### Issue: "Only instructors can update semester"
**Solution**: Verify your account has instructor role. Contact admin if needed.

### Issue: Update fails with timeout
**Solution**: If clearing large amounts of data, the operation may take longer. Check server logs and wait a moment before retrying.

### Issue: Some data wasn't cleared
**Solution**: 
1. Check that the course is linked to your instructor account
2. Verify lessons/labs/quizzes are properly associated with the course
3. Check server logs for any errors during the clearing process

### Issue: Need to recover cleared data
**Solution**: Unfortunately, cleared data is permanently deleted. Always backup important information before updating semesters.

## Best Practices

1. **Back Up Data** - Export student submissions before updating semesters if you need to retain them
2. **Time It Right** - Update semesters when no students are actively working
3. **Announce Changes** - Notify students before clearing their progress
4. **Test First** - Consider testing with a small course before applying to all courses
5. **Review Logs** - Check the detailed clearing summary in the notification

## System Architecture

### Backend Flow

```
POST /api/users/update-semester
  ├─ Verify user is instructor
  ├─ Update user.teaching_year_levels and user.teaching_sections
  ├─ Fetch all courses created by instructor
  ├─ For each course:
  │   ├─ Get all lessons
  │   ├─ Delete lesson_progress records
  │   ├─ Get all laboratories
  │   ├─ Delete laboratory_submissions records
  │   ├─ Get all assessments
  │   └─ Delete assessment_submissions records
  └─ Return summary of cleared data
```

### Frontend Flow

```
User clicks "Update Semester"
  ├─ Show confirmation dialog
  ├─ User selects semesters/sections
  ├─ User clicks "Update Semester"
  ├─ Send POST request to API
  ├─ Show loading state
  ├─ On success:
  │   ├─ Show success toast with counts
  │   ├─ Close dialog
  │   └─ Reload dashboard data
  └─ On error: Show error toast
```

## Security & Permissions

- **Authentication Required**: All users must be authenticated
- **Role Check**: Only instructors can update their semesters
- **Authorization**: Instructors can only update their own profile
- **Data Scope**: Only clears data for courses created by the instructor
- **Audit Trail**: All operations are logged with timestamps and details

## Performance Considerations

- Large data clearing operations may take 30+ seconds
- Database uses efficient batch deletion queries
- No real-time processing, all operations complete before response
- Transactions ensure data consistency

## Monitoring

Check server logs for entries like:
```
🔄 SEMESTER UPDATE: Instructor {id}
   New teaching_year_levels: [1,2]
   New teaching_sections: ["A","B"]

📝 Step 1: Updating instructor profile...
   ✅ Instructor profile updated

📝 Step 2: Fetching instructor's modules...
   ✅ Found 5 courses

📝 Step 3: Clearing lesson progress...
   ✅ Cleared 150 lesson progress records

✅ SEMESTER UPDATE COMPLETE
```

## FAQ

**Q: Can I undo a semester update?**
A: No, the action is permanent. Plan carefully before updating.

**Q: Will students be notified?**
A: The system doesn't send notifications automatically. You should notify students separately.

**Q: What if I teach multiple semesters?**
A: You can select multiple semesters at once. Their students' data will all be cleared.

**Q: Can I selective delete data?**
A: Not through this interface. You would need to delete data manually via database if needed.

**Q: How long does the update take?**
A: Usually 5-30 seconds depending on the amount of data. Larger classes take longer.

**Q: Will this affect other instructors' data?**
A: No, only clears data for courses created by the updating instructor.

**Q: Can students see when their data was cleared?**
A: No. Their progress simply resets to zero.
