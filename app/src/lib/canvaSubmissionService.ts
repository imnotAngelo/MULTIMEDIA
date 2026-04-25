// Backward-compatible wrapper around the renamed "laboratory submissions" API.
// Prefer importing from `@/lib/laboratorySubmissionService`.
export {
  getSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  getSubmissionStats,
  type SubmissionStats,
  type LaboratorySubmission as CanvaSubmission,
} from "@/lib/laboratorySubmissionService";
