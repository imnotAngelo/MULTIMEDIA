import React, { useState } from "react";
import { createSubmission, updateSubmission, type LaboratorySubmission } from "@/lib/laboratorySubmissionService";
import "./CanvaSubmissionForm.css";

interface CanvaSubmissionFormProps {
  laboratoryId: string;
  phaseId: number;
  onSuccess?: (submission: LaboratorySubmission) => void;
  onCancel?: () => void;
}

export const CanvaSubmissionForm: React.FC<CanvaSubmissionFormProps> = ({
  laboratoryId,
  phaseId,
  onSuccess,
  onCancel,
}) => {
  const [projectTitle, setProjectTitle] = useState("");
  const [canvaUrl, setCanvaUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"link" | "file">("link");
  const [startTime] = useState(new Date().toISOString());

  const handleOpenCanva = () => {
    window.open("https://www.canva.com", "_blank");
  };

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
    if (!canvaUrl.trim()) {
      setError("Please enter a submission URL");
      return;
    }

    setIsLoading(true);
    try {
      const submission = await createSubmission({
        laboratoryId,
        phaseId,
        projectTitle: projectTitle || "Untitled Project",
        submissionUrl: canvaUrl,
        startTime,
      });

      setCanvaUrl("");
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
      // Create initial submission
      const submission = await createSubmission({
        laboratoryId,
        phaseId,
        projectTitle: projectTitle || selectedFile.name,
        startTime,
      });

      // Upload file to server (you'll need to implement actual file upload)
      // For now, we just update with file info
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
        <button
          className="btn-open-canva"
          onClick={handleOpenCanva}
          disabled={isLoading}
        >
          🌐 Open Website
        </button>
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
            placeholder="e.g., Brand Logo Design"
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
                placeholder="https://www.canva.com/design/DAF..."
                value={canvaUrl}
                onChange={(e) => setCanvaUrl(e.target.value)}
                disabled={isLoading}
              />
              <small>
                Paste a shareable link to your work (Drive, GitHub, Canva, etc.).
              </small>
            </div>

            <div className="instructions">
              <h4>How to share your work:</h4>
              <ol>
                <li>Open your work</li>
                <li>Choose “Share”</li>
                <li>Enable “Anyone with the link” (or equivalent)</li>
                <li>Copy/paste the link above</li>
              </ol>
            </div>

            <button
              className="btn-submit"
              onClick={handleSubmitLink}
              disabled={isLoading || !canvaUrl.trim()}
            >
              {isLoading ? "Submitting..." : "Submit Link"}
            </button>
          </>
        )}

        {activeTab === "file" && (
          <>
            <div className="form-group">
              <label>Upload Exported File *</label>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={handleFileChange}
                disabled={isLoading}
              />
              <small>
                Supported formats: PNG, JPG, PDF (Max 50MB)
              </small>
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

            <div className="instructions">
              <h4>How to export from Canva:</h4>
              <ol>
                <li>Open your Canva project</li>
                <li>Click "Download" button in top right</li>
                <li>Select format (PNG, JPG, or PDF)</li>
                <li>Click "Download" to save the file</li>
                <li>Upload the file here</li>
              </ol>
            </div>

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
        <button
          className="btn-cancel"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
      )}
    </div>
  );
};
