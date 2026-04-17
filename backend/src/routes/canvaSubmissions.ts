import { Router, Response } from "express";
import { supabase } from "../config/supabase.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/canva-submissions/:laboratoryId
 * Get all submissions for a laboratory (student sees own, instructor sees all)
 */
router.get(
  "/:laboratoryId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { laboratoryId } = req.params;
      const userId = req.user?.id;

      // Get laboratory to check if current user is instructor
      const { data: lab } = await supabase
        .from("laboratories")
        .select("instructor_id")
        .eq("id", laboratoryId)
        .single();

      if (!lab) {
        return res.status(404).json({ error: "Laboratory not found" });
      }

      const isInstructor = lab.instructor_id === userId;

      // If student, only get their own submissions
      // If instructor, get all submissions for the laboratory
      let query = supabase
        .from("canva_submissions")
        .select(
          `*,
          student:users(id,email,display_name),
          instructor:users(id,email,display_name)`
        )
        .eq("laboratory_id", laboratoryId)
        .order("submitted_at", { ascending: false });

      if (!isInstructor) {
        query = query.eq("student_id", userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/canva-submissions
 * Create a new Canva submission
 */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { laboratoryId, phaseId, projectTitle, canvaUrl, startTime } =
      req.body;
    const studentId = req.user?.id;

    if (!laboratoryId || !phaseId || !studentId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const submissionData: any = {
      laboratory_id: laboratoryId,
      student_id: studentId,
      phase_id: phaseId,
      project_title: projectTitle,
      submitted_at: new Date().toISOString(),
      start_time: startTime,
    };

    // If they provided a Canva URL, add it
    if (canvaUrl) {
      submissionData.canva_url = canvaUrl;
      submissionData.submission_method = "link";
    }

    // Calculate time spent if start_time provided
    if (startTime) {
      const startMs = new Date(startTime).getTime();
      const endMs = new Date().getTime();
      submissionData.end_time = new Date().toISOString();
      submissionData.time_spent_minutes = Math.round((endMs - startMs) / 1000 / 60);
    }

    const { data, error } = await supabase
      .from("canva_submissions")
      .insert([submissionData])
      .select()
      .single();

    if (error) throw error;

    // Mark this phase as complete in laboratory_progress
    await supabase
      .from("laboratory_progress")
      .update({
        phase_completed: true,
        completed_at: new Date().toISOString(),
      })
      .match({
        laboratory_id: laboratoryId,
        student_id: studentId,
        phase_id: phaseId,
      });

    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error creating submission:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/canva-submissions/:submissionId
 * Update submission with file or feedback
 */
router.patch(
  "/:submissionId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { submissionId } = req.params;
      const {
        filePath,
        fileName,
        fileSize,
        instructorFeedback,
        grade,
        status,
      } = req.body;
      const userId = req.user?.id;

      // Get submission to check authorization
      const { data: submission } = await supabase
        .from("canva_submissions")
        .select("student_id, laboratory_id")
        .eq("id", submissionId)
        .single();

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Check if user is either the student or the instructor
      const isStudent = submission.student_id === userId;
      const { data: lab } = await supabase
        .from("laboratories")
        .select("instructor_id")
        .eq("id", submission.laboratory_id)
        .single();

      const isInstructor = lab?.instructor_id === userId;

      if (!isStudent && !isInstructor) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updateData: any = {};

      // Students can update file info and submission method
      if (isStudent && (filePath || fileName || fileSize)) {
        updateData.file_path = filePath;
        updateData.file_name = fileName;
        updateData.file_size = fileSize;
        updateData.submission_method = updateData.submission_method || "file";
      }

      // Instructors can add feedback and grade
      if (isInstructor && (instructorFeedback !== undefined || grade !== undefined || status)) {
        updateData.instructor_id = userId;
        updateData.instructor_feedback = instructorFeedback;
        updateData.grade = grade;
        updateData.status = status || "reviewed";
        updateData.reviewed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("canva_submissions")
        .update(updateData)
        .eq("id", submissionId)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error("Error updating submission:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/canva-submissions/:submissionId
 * Delete a submission (student can only delete own, before it's reviewed)
 */
router.delete(
  "/:submissionId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user?.id;

      const { data: submission } = await supabase
        .from("canva_submissions")
        .select("student_id, status")
        .eq("id", submissionId)
        .single();

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Only allow student to delete their own unreviewed submissions
      if (submission.student_id !== userId || submission.status !== "submitted") {
        return res.status(403).json({ error: "Cannot delete this submission" });
      }

      const { error } = await supabase
        .from("canva_submissions")
        .delete()
        .eq("id", submissionId);

      if (error) throw error;
      res.json({ message: "Submission deleted" });
    } catch (error: any) {
      console.error("Error deleting submission:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/canva-submissions/stats/:laboratoryId
 * Get submission statistics for a laboratory
 */
router.get(
  "/stats/:laboratoryId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { laboratoryId } = req.params;
      const userId = req.user?.id;

      // Check if user is instructor
      const { data: lab } = await supabase
        .from("laboratories")
        .select("instructor_id")
        .eq("id", laboratoryId)
        .single();

      if (lab?.instructor_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { data, error } = await supabase
        .from("canva_submissions")
        .select("status, grade")
        .eq("laboratory_id", laboratoryId);

      if (error) throw error;

      const stats = {
        total: data.length,
        submitted: data.filter((d) => d.status === "submitted").length,
        reviewed: data.filter((d) => d.status === "reviewed").length,
        approved: data.filter((d) => d.status === "approved").length,
        rejected: data.filter((d) => d.status === "rejected").length,
        averageGrade:
          data
            .filter((d) => d.grade !== null)
            .reduce((sum, d) => sum + (d.grade || 0), 0) / data.length || 0,
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
