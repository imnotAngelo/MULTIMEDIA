import { authFetch } from "@/lib/authFetch";

export interface LaboratorySubmission {
  id: string;
  laboratory_id: string;
  student_id: string;
  phase_id: number;
  project_title: string;
  // Stored as `canva_url` in DB for backward compatibility
  canva_url?: string;
  submission_method: "link" | "file" | "both";
  file_path?: string;
  file_name?: string;
  file_size?: number;
  submitted_at: string;
  start_time?: string;
  end_time?: string;
  time_spent_minutes?: number;
  status: "submitted" | "reviewed" | "approved" | "rejected";
  instructor_id?: string;
  instructor_feedback?: string;
  grade?: number;
  reviewed_at?: string;
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

const BASE = "/laboratory-submissions";

export async function getSubmissions(
  laboratoryId: string
): Promise<LaboratorySubmission[]> {
  const response = await authFetch(`${BASE}/${laboratoryId}`);
  if (!response.ok) throw new Error("Failed to fetch submissions");
  return response.json();
}

export async function createSubmission(data: {
  laboratoryId: string;
  phaseId: number;
  projectTitle?: string;
  submissionUrl?: string;
  // legacy name still accepted by backend; keep optional to avoid breaking older call sites
  canvaUrl?: string;
  startTime: string;
}): Promise<LaboratorySubmission> {
  const response = await authFetch(`${BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create submission");
  return response.json();
}

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
): Promise<LaboratorySubmission> {
  const response = await authFetch(`${BASE}/${submissionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update submission");
  return response.json();
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const response = await authFetch(`${BASE}/${submissionId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete submission");
}

export async function getSubmissionStats(
  laboratoryId: string
): Promise<SubmissionStats> {
  const response = await authFetch(`${BASE}/stats/${laboratoryId}`);
  if (!response.ok) throw new Error("Failed to fetch statistics");
  return response.json();
}

