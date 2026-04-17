import React, { useState, useEffect } from "react";
import { getSubmissions, updateSubmission } from "@/lib/canvaSubmissionService";
import "./InstructorReview.css";

interface InstructorReviewProps {
  submissionId: string;
  laboratoryId: string;
  onClose?: () => void;
  onSave?: () => void;
}

interface Submission {
  id: string;
  project_title: string;
  canva_url: string;
  file_name: string;
  submitted_at: string;
  status: string;
  grade: number;
  time_spent_minutes: number;
  instructor_feedback: string;
  student?: {
    display_name: string;
    email: string;
  };
}

export const InstructorReview: React.FC<InstructorReviewProps> = ({
  submissionId,
  laboratoryId,
  onClose,
  onSave,
}) => {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [grade, setGrade] = useState<number | "">(0);
  const [status, setStatus] = useState<"submitted" | "reviewed" | "approved" | "rejected">("submitted");

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    setIsLoading(true);
    try {
      const submissions = await getSubmissions(laboratoryId);
      const found = submissions.find((s) => s.id === submissionId);
      if (found) {
        setSubmission(found);
        setFeedback(found.instructor_feedback || "");
        setGrade(found.grade || 0);
        setStatus(found.status as any);
      } else {
        setError("Submission not found");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load submission");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!submission) return;

    setIsSaving(true);
    try {
      await updateSubmission(submission.id, {
        instructorFeedback: feedback,
        grade: grade === "" ? undefined : grade,
        status,
      });

      setError(null);
      onSave?.();
    } catch (err: any) {
      setError(err.message || "Failed to save review");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="instructor-review loading">
        <p>Loading submission...</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="instructor-review error">
        <p>{error || "Submission not found"}</p>
      </div>
    );
  }

  return (
    <div className="instructor-review">
      <div className="review-header">
        <h3>Review Submission</h3>
        <button className="btn-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="review-content">
        {/* Student Info */}
        <section className="review-section">
          <h4>Student Information</h4>
          <div className="info-grid">
            <div className="info-item">
              <strong>Name:</strong>
              <p>{submission.student?.display_name}</p>
            </div>
            <div className="info-item">
              <strong>Email:</strong>
              <p>{submission.student?.email}</p>
            </div>
            <div className="info-item">
              <strong>Submitted:</strong>
              <p>{new Date(submission.submitted_at).toLocaleString()}</p>
            </div>
            {submission.time_spent_minutes && (
              <div className="info-item">
                <strong>Time Spent:</strong>
                <p>{submission.time_spent_minutes} minutes</p>
              </div>
            )}
          </div>
        </section>

        {/* Project Details */}
        <section className="review-section">
          <h4>Project Details</h4>
          <div className="project-details">
            <div className="detail-item">
              <strong>Title:</strong>
              <p>{submission.project_title}</p>
            </div>
            {submission.canva_url && (
              <div className="detail-item">
                <strong>Canva Project:</strong>
                <p>
                  <a href={submission.canva_url} target="_blank" rel="noopener noreferrer">
                    Open Project →
                  </a>
                </p>
              </div>
            )}
            {submission.file_name && (
              <div className="detail-item">
                <strong>Uploaded File:</strong>
                <p>{submission.file_name}</p>
              </div>
            )}
          </div>
        </section>

        {/* Review Form */}
        <section className="review-section">
          <h4>Grading & Feedback</h4>

          <div className="form-group">
            <label>Grade (0-100)</label>
            <div className="grade-input-container">
              <input
                type="number"
                min="0"
                max="100"
                value={grade}
                onChange={(e) => setGrade(e.target.value === "" ? "" : parseInt(e.target.value))}
                disabled={isSaving}
              />
              <span className="grade-label">%</span>
            </div>
          </div>

          <div className="form-group">
            <label>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              disabled={isSaving}
            >
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="form-group">
            <label>Feedback & Comments</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide constructive feedback for the student..."
              rows={6}
              disabled={isSaving}
            />
            <small>{feedback.length} characters</small>
          </div>

          {error && <div className="error-message">{error}</div>}
        </section>
      </div>

      <div className="review-footer">
        <button className="btn-cancel" onClick={onClose} disabled={isSaving}>
          Cancel
        </button>
        <button className="btn-save" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Review"}
        </button>
      </div>
    </div>
  );
};
