// [REMOVED: Canva submission service no longer used]
import { authFetch } from "@/lib/authFetch";

export interface CanvaSubmission {
  id: string;
  laboratory_id: string;
  student_id: string;
  phase_id: number;
  project_title: string;
  canva_url: string;
  submission_method: "link" | "file" | "both";
  file_path: string;
  file_name: string;
  file_size: number;
  submitted_at: string;
  start_time: string;
  end_time: string;
  time_spent_minutes: number;
  status: "submitted" | "reviewed" | "approved" | "rejected";
  instructor_id: string;
  instructor_feedback: string;
  grade: number;
  reviewed_at: string;
  student?: {
    id: string;
    email: string;
    display_name: string;
  };
  instructor?: {
    id: string;
    email: string;
    display_name: string;
  };
}

export interface SubmissionStats {
  total: number;
  submitted: number;
  reviewed: number;
  approved: number;
  rejected: number;
  averageGrade: number;
}

/**
 * Get all submissions for a laboratory
 */
export async function getSubmissions(
  laboratoryId: string
): Promise<CanvaSubmission[]> {
  const response = await authFetch(`/canva-submissions/${laboratoryId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch submissions");
  }

  return response.json();
}

/**
 * Create a new Canva submission
 */
export async function createSubmission(data: {
  laboratoryId: string;
  phaseId: number;
  projectTitle?: string;
  canvaUrl?: string;
  startTime: string;
}): Promise<CanvaSubmission> {
  const response = await authFetch(`/canva-submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create submission");
  }

  return response.json();
}

/**
 * Update a submission with file or feedback
 */
export async function updateSubmission(
  submissionId: string,
  data: {
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    instructorFeedback?: string;
    grade?: number;
    status?: string;
  }
): Promise<CanvaSubmission> {
  const response = await authFetch(`/canva-submissions/${submissionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update submission");
  }

  return response.json();
}

/**
 * Delete a submission
 */
export async function deleteSubmission(submissionId: string): Promise<void> {
  const response = await authFetch(`/canva-submissions/${submissionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete submission");
  }
}

/**
 * Get submission statistics for a laboratory
 */
export async function getSubmissionStats(
  laboratoryId: string
): Promise<SubmissionStats> {
  const response = await authFetch(`/canva-submissions/stats/${laboratoryId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch statistics");
  }

  return response.json();
}
