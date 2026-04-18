const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'}/assessments`;

export interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'assignment' | 'quiz' | 'laboratory';
  dueDate: string;
  totalPoints: number;
  submissions?: number;
  graded?: number;
  status?: string;
  unitId?: string;
  unitName?: string;
  createdAt: string;
}

export interface AssessmentSubmission {
  id: string;
  assessmentId: string;
  userId: string;
  answers: Record<string, any>;
  score?: number;
  feedback?: string;
  status: 'draft' | 'submitted' | 'graded';
  submittedAt?: string;
}

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('access_token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`,
});

// Student API calls
export const assessmentService = {
  // Get all assessments (student view)
  async getStudentAssessments(filter?: string, unitId?: string) {
    try {
      const params = new URLSearchParams();
      if (filter) params.append('filter', filter);
      if (unitId) params.append('unitId', unitId);

      const response = await fetch(`${API_BASE_URL}?${params}`, {
        headers: headers(),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching assessments:', error);
      throw error;
    }
  },

  // Get assessment by ID
  async getAssessmentById(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        headers: headers(),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching assessment:', error);
      throw error;
    }
  },

  // Submit assessment response
  async submitAssessmentResponse(assessmentId: string, answers: Record<string, any>) {
    try {
      const response = await fetch(`${API_BASE_URL}/${assessmentId}/submit`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ answers }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error submitting assessment:', error);
      throw error;
    }
  },
};

// Instructor API calls
export const instructorAssessmentService = {
  // Get all assessments created by instructor
  async getInstructorAssessments(filter?: string) {
    try {
      const params = new URLSearchParams();
      if (filter) params.append('filter', filter);

      const response = await fetch(`${API_BASE_URL}/instructor/all?${params}`, {
        headers: headers(),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching instructor assessments:', error);
      throw error;
    }
  },

  // Create new assessment
  async createAssessment(assessment: {
    title: string;
    description?: string;
    type: 'assignment' | 'quiz' | 'laboratory';
    dueDate?: string;
    totalPoints?: number;
    unitId?: string;
  }) {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(assessment),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating assessment:', error);
      throw error;
    }
  },

  // Update assessment
  async updateAssessment(id: string, updates: Partial<Assessment>) {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating assessment:', error);
      throw error;
    }
  },

  // Delete assessment
  async deleteAssessment(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting assessment:', error);
      throw error;
    }
  },

  // Get assessment submissions
  async getAssessmentSubmissions(assessmentId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/${assessmentId}/submissions`, {
        headers: headers(),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  },

  // Grade submission
  async gradeSubmission(submissionId: string, score: number, feedback?: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/${submissionId}/grade`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ score, feedback }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error grading submission:', error);
      throw error;
    }
  },
};
