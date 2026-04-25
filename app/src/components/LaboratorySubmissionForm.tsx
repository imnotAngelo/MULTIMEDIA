import React, { useState } from "react";
import {
  createSubmission,
  updateSubmission,
  type LaboratorySubmission,
} from "@/lib/laboratorySubmissionService";
import "./CanvaSubmissionForm.css";

interface LaboratorySubmissionFormProps {
  laboratoryId: string;
  phaseId: number;
  onSuccess?: (submission: LaboratorySubmission) => void;
  onCancel?: () => void;
}

export const LaboratorySubmissionForm: React.FC<LaboratorySubmissionFormProps> = ({
  laboratoryId,
  phaseId,
  onSuccess,
  onCancel,
}) => {
  const [projectTitle, setProjectTitle] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"link" | "file">("link");
  const [startTime] = useState(new Date().toISOString());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError("File size must be less than 50MB");
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmitLink = async () => {
    if (!submissionUrl.trim()) {
      setError("Please enter a submission URL");
      return;
    }

    setIsLoading(true);
    try {
      const submission = await createSubmission({
        laboratoryId,
        phaseId,
        projectTitle: projectTitle || "Untitled Project",
        submissionUrl,
        startTime,
      });

      setSubmissionUrl("");
      setProjectTitle("");
      onSuccess?.(submission);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit project");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    setIsLoading(true);
    try {
      const submission = await createSubmission({
        laboratoryId,
        phaseId,
        projectTitle: projectTitle || selectedFile.name,
        startTime,
      });

      // TODO: actual binary upload (this project currently stores only metadata)
      await updateSubmission(submission.id, {
        filePath: `/uploads/${submission.id}/${selectedFile.name}`,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });

      setSelectedFile(null);
      setProjectTitle("");
      onSuccess?.(submission);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="canva-submission-form">
      <div className="form-header">
        <h3>Submit Laboratory Work</h3>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tabs">
        <button
          className={`tab ${activeTab === "link" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("link");
            setError(null);
          }}
        >
          📎 Submit Link
        </button>
        <button
          className={`tab ${activeTab === "file" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("file");
            setError(null);
          }}
        >
          📤 Upload File
        </button>
      </div>

      <div className="form-content">
        <div className="form-group">
          <label>Project Title (optional)</label>
          <input
            type="text"
            placeholder="e.g., Lab Creative Output"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {activeTab === "link" && (
          <>
            <div className="form-group">
              <label>Submission URL *</label>
              <input
                type="url"
                placeholder="https://..."
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
                disabled={isLoading}
              />
              <small>Paste a shareable link to your work (Drive, GitHub, Canva, etc.).</small>
            </div>

            <button
              className="btn-submit"
              onClick={handleSubmitLink}
              disabled={isLoading || !submissionUrl.trim()}
            >
              {isLoading ? "Submitting..." : "Submit Link"}
            </button>
          </>
        )}

        {activeTab === "file" && (
          <>
            <div className="form-group">
              <label>Upload File *</label>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={handleFileChange}
                disabled={isLoading}
              />
              <small>Supported formats: PNG, JPG, PDF (Max 50MB)</small>
            </div>

            {selectedFile && (
              <div className="file-info">
                <p>
                  <strong>Selected file:</strong> {selectedFile.name}
                </p>
                <p>
                  <strong>Size:</strong>{" "}
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <button
              className="btn-submit"
              onClick={handleSubmitFile}
              disabled={isLoading || !selectedFile}
            >
              {isLoading ? "Uploading..." : "Upload File"}
            </button>
          </>
        )}
      </div>

      {onCancel && (
        <button className="btn-cancel" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
      )}
    </div>
  );
};

