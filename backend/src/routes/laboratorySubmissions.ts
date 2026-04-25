import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { supabase } from "../config/supabase.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

// --- Multer setup for lab file submissions ---
const labUploadsDir = path.join(process.cwd(), "uploads", "lab-submissions");
if (!fs.existsSync(labUploadsDir)) {
  fs.mkdirSync(labUploadsDir, { recursive: true });
}

const labFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, labUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const labUpload = multer({
  storage: labFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});

/**
 * Canonical "laboratory submissions" router.
 *
 * Note: For compatibility with existing data, this still stores in the existing
 * `canva_submissions` table / `canva_url` column. The API/UX is renamed to
 * "laboratory submissions" and accepts either `submissionUrl` or legacy `canvaUrl`.
 */
const router = Router();

/**
 * GET /api/laboratory-submissions/my-files
 * Returns the authenticated student's file submissions keyed by lab_id.
 */
router.get(
  "/my-files",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const studentId = req.user?.id;
      if (!studentId) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from("lab_file_submissions")
        .select("*")
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const map: Record<string, object> = {};
      for (const row of data ?? []) {
        map[row.lab_id] = {
          id: row.id,
          labId: row.lab_id,
          fileName: row.file_name,
          fileType: row.file_type,
          fileUrl: `/uploads/${row.file_path}`,
          note: row.note ?? "",
          submittedAt: row.submitted_at,
        };
      }
      res.json(map);
    } catch (err: any) {
      console.error("Error fetching file submissions:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * POST /api/laboratory-submissions/upload-file
 * Student submits a photo/video file for an instructor-assigned lab.
 * Accepts multipart/form-data with fields: file, labId, labTitle, note.
 */
router.post("/upload-file", authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log("🚀 upload-file handler called, user:", req.user?.id);
  // Parse multipart body with multer
  const multerErr = await new Promise<Error | null>((resolve) => {
    labUpload.single("file")(req as any, res as any, (err: any) => resolve(err ?? null));
  });
  if (multerErr) {
    return res.status(400).json({ error: multerErr.message });
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  try {
    const { labId, labTitle, note } = req.body ?? {};
    const studentId = req.user?.id;

    if (!labId || !studentId || !file) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Missing labId or file" });
    }

    const filePath = `lab-submissions/${file.filename}`;

    // Remove previous submission file if one exists
    const { data: existing } = await supabase
      .from("lab_file_submissions")
      .select("id, file_path")
      .match({ lab_id: labId, student_id: studentId })
      .maybeSingle();

    if (existing) {
      const oldPath = path.join(process.cwd(), "uploads", existing.file_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      await supabase.from("lab_file_submissions").delete().eq("id", existing.id);
    }

    const { data, error } = await supabase
      .from("lab_file_submissions")
      .insert([{
        lab_id: labId,
        lab_title: labTitle ?? "",
        student_id: studentId,
        file_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        file_type: file.mimetype,
        note: note ?? "",
        submitted_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: data.id,
      labId: data.lab_id,
      fileName: data.file_name,
      fileType: data.file_type,
      fileUrl: `/uploads/${data.file_path}`,
      note: data.note ?? "",
      submittedAt: data.submitted_at,
    });
  } catch (err: any) {
    if (file) {
      const p = path.join(process.cwd(), "uploads", "lab-submissions", file.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    console.error("Error uploading lab file submission:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/laboratory-submissions/stats/:laboratoryId
 * Get submission statistics for a laboratory
 */
router.get(
  "/stats/:laboratoryId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { laboratoryId } = req.params;
      const userId = req.user?.id;

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

/**
 * GET /api/laboratory-submissions/all-files
 * Instructor-only: returns every file submission across all labs,
 * joined with basic student info from the users table.
 */
router.get(
  "/all-files",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from("lab_file_submissions")
        .select(`
          id,
          lab_id,
          lab_title,
          student_id,
          file_name,
          file_path,
          file_size,
          file_type,
          note,
          submitted_at,
          grade,
          feedback,
          status
        `)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      // Fetch student info separately to avoid FK constraint dependency
      const studentIds = [...new Set((data ?? []).map((r: any) => r.student_id))];
      const { data: users } = studentIds.length
        ? await supabase.from("users").select("id, email, full_name").in("id", studentIds)
        : { data: [] };
      const userMap: Record<string, any> = {};
      for (const u of users ?? []) userMap[u.id] = u;

      const rows = (data ?? []).map((row: any) => ({
        id: row.id,
        labId: row.lab_id,
        labTitle: row.lab_title ?? row.lab_id,
        studentId: row.student_id,
        studentEmail: userMap[row.student_id]?.email ?? row.student_id,
        studentName: userMap[row.student_id]?.full_name ?? userMap[row.student_id]?.email ?? row.student_id,
        fileName: row.file_name,
        fileType: row.file_type,
        fileUrl: `/uploads/${row.file_path}`,
        fileSize: row.file_size,
        note: row.note ?? "",
        submittedAt: row.submitted_at,
        grade: row.grade ?? null,
        feedback: row.feedback ?? "",
        status: row.status ?? "submitted",
      }));

      res.json(rows);
    } catch (err: any) {
      console.error("Error fetching all file submissions:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * PATCH /api/laboratory-submissions/grade-file/:id
 * Instructor grades a file submission in lab_file_submissions.
 */
router.patch(
  "/grade-file/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { grade, feedback, status } = req.body ?? {};
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const updateData: any = { updated_at: new Date().toISOString() };
      if (grade !== undefined) updateData.grade = grade;
      if (feedback !== undefined) updateData.feedback = feedback;
      if (status !== undefined) updateData.status = status;

      const { data, error } = await supabase
        .from("lab_file_submissions")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Submission not found" });

      res.json(data);
    } catch (err: any) {
      console.error("Error grading file submission:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
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
 * POST /api/laboratory-submissions
 * Create a new laboratory submission (link and/or file metadata)
 */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      laboratoryId,
      phaseId,
      projectTitle,
      submissionUrl,
      canvaUrl, // legacy
      startTime,
    } = req.body ?? {};
    const studentId = req.user?.id;

    if (!laboratoryId || !phaseId || !studentId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const url: string | undefined =
      typeof submissionUrl === "string" && submissionUrl.trim()
        ? submissionUrl.trim()
        : typeof canvaUrl === "string" && canvaUrl.trim()
          ? canvaUrl.trim()
          : undefined;

    const submissionData: any = {
      laboratory_id: laboratoryId,
      student_id: studentId,
      phase_id: phaseId,
      project_title: projectTitle,
      submitted_at: new Date().toISOString(),
      start_time: startTime,
    };

    // Store as canva_url for DB compatibility, regardless of UI naming
    if (url) {
      submissionData.canva_url = url;
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
 * PATCH /api/laboratory-submissions/:submissionId
 * Update submission with file metadata or instructor feedback
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
      } = req.body ?? {};
      const userId = req.user?.id;

      const { data: submission } = await supabase
        .from("canva_submissions")
        .select("student_id, laboratory_id")
        .eq("id", submissionId)
        .single();

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

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

      if (isStudent && (filePath || fileName || fileSize)) {
        updateData.file_path = filePath;
        updateData.file_name = fileName;
        updateData.file_size = fileSize;
        updateData.submission_method = updateData.submission_method || "file";
      }

      if (
        isInstructor &&
        (instructorFeedback !== undefined || grade !== undefined || status)
      ) {
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
 * DELETE /api/laboratory-submissions/:submissionId
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

export default router;

