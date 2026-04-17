import React, { useState, useEffect } from "react";
import { getSubmissions, deleteSubmission } from "@/lib/canvaSubmissionService";
import "./SubmissionsList.css";

interface SubmissionsListProps {
  laboratoryId: string;
  isInstructor?: boolean;
  onReviewClick?: (submissionId: string) => void;
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
  student?: {
    display_name: string;
    email: string;
  };
  instructor_feedback?: string;
}

export const SubmissionsList: React.FC<SubmissionsListProps> = ({
  laboratoryId,
  isInstructor = false,
  onReviewClick,
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "reviewed" | "approved" | "rejected">("all");

  useEffect(() => {
    loadSubmissions();
  }, [laboratoryId]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await getSubmissions(laboratoryId);
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message || "Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (submissionId: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) {
      return;
    }

    try {
      await deleteSubmission(submissionId);
      setSubmissions(submissions.filter((s) => s.id !== submissionId));
    } catch (err: any) {
      alert(err.message || "Failed to delete submission");
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const getStatusBadge = (status: string) => {
    const statusClass = `status-badge status-${status}`;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    return <span className={statusClass}>{statusLabel}</span>;
  };

  const getGradeDisplay = (grade: number | null) => {
    if (grade === null || grade === undefined) return "—";
    return `${grade}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return <div className="submissions-list loading">Loading submissions...</div>;
  }

  if (error) {
    return <div className="submissions-list error">{error}</div>;
  }

  if (submissions.length === 0) {
    return (
      <div className="submissions-list empty">
        <p>No submissions yet</p>
      </div>
    );
  }

  return (
    <div className="submissions-list">
      <div className="list-header">
        <h3>Submissions</h3>
        <div className="filters">
          {["all", "submitted", "reviewed", "approved", "rejected"].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f as any)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="submissions-table">
        <div className="table-header">
          {isInstructor && <div className="col-student">Student</div>}
          <div className="col-project">Project</div>
          <div className="col-submitted">Submitted</div>
          <div className="col-time">Time Spent</div>
          <div className="col-status">Status</div>
          {isInstructor && <div className="col-grade">Grade</div>}
          <div className="col-actions">Actions</div>
        </div>

        {filteredSubmissions.map((submission) => (
          <div key={submission.id} className="table-row">
            {isInstructor && (
              <div className="col-student">
                <div className="student-info">
                  <strong>{submission.student?.display_name}</strong>
                  <small>{submission.student?.email}</small>
                </div>
              </div>
            )}

            <div className="col-project">
              <div className="project-info">
                <strong>{submission.project_title}</strong>
                {submission.canva_url && (
                  <small>
                    <a href={submission.canva_url} target="_blank" rel="noopener noreferrer">
                      View on Canva →
                    </a>
                  </small>
                )}
                {submission.file_name && (
                  <small>{submission.file_name}</small>
                )}
              </div>
            </div>

            <div className="col-submitted">
              {formatDate(submission.submitted_at)}
            </div>

            <div className="col-time">
              {submission.time_spent_minutes
                ? `${submission.time_spent_minutes}m`
                : "—"}
            </div>

            <div className="col-status">
              {getStatusBadge(submission.status)}
            </div>

            {isInstructor && (
              <div className="col-grade">
                {getGradeDisplay(submission.grade)}
              </div>
            )}

            <div className="col-actions">
              {isInstructor ? (
                <>
                  <button
                    className="btn-action btn-review"
                    onClick={() => onReviewClick?.(submission.id)}
                  >
                    Review
                  </button>
                  {submission.status === "submitted" && (
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(submission.id)}
                    >
                      Delete
                    </button>
                  )}
                </>
              ) : (
                <>
                  {submission.canva_url && (
                    <a
                      href={submission.canva_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-action btn-view"
                    >
                      View
                    </a>
                  )}
                  {submission.status === "submitted" && (
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(submission.id)}
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>

            {submission.instructor_feedback && (
              <div className="feedback-section">
                <strong>Feedback:</strong>
                <p>{submission.instructor_feedback}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
