import { toast } from 'sonner';
import { useNotificationStore } from '@/stores/notificationStore';
import { authFetch } from '@/lib/authFetch';

/** Silently broadcasts a notification to all students via the backend API. */
async function broadcast(type: string, title: string, message: string) {
  try {
    const res = await authFetch('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, message, recipientRole: 'student' }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[notify] Broadcast failed:', res.status, text);
    } else {
      const json = await res.json().catch(() => ({}));
      console.log('[notify] Broadcast sent:', json);
    }
  } catch (err) {
    console.error('[notify] Broadcast error:', err);
  }
}

export const notificationService = {
  /**
   * Notify when instructor adds a new unit
   */
  notifyUnitAdded: (unitName: string) => {
    const title = '📚 New Unit Added';
    const message = `"${unitName}" is now available in your course`;
    useNotificationStore.getState().addNotification({ type: 'unit', title, message });
    broadcast('unit', title, message);
    toast.success('New Unit Added', { description: `"${unitName}" is now available`, icon: '📚' });
  },

  /**
   * Notify when instructor adds a new lesson
   */
  notifyLessonAdded: (lessonTitle: string, unitName?: string) => {
    const title = '📖 New Lesson Available';
    const message = `"${lessonTitle}"${unitName ? ` in ${unitName}` : ''} has been added`;
    useNotificationStore.getState().addNotification({ type: 'lesson', title, message });
    broadcast('lesson', title, message);
    toast.success('New Lesson Available', { description: `"${lessonTitle}" is ready to learn`, icon: '📖' });
  },

  /**
   * Notify when instructor publishes a new quiz
   */
  notifyQuizAdded: (quizTitle: string, unitName?: string) => {
    const title = '📝 New Quiz Posted';
    const message = `"${quizTitle}"${unitName ? ` in ${unitName}` : ''} is ready to take`;
    useNotificationStore.getState().addNotification({ type: 'quiz', title, message });
    broadcast('quiz', title, message);
    toast.info('New Quiz Available', { description: `"${quizTitle}" has been posted`, icon: '📝' });
  },

  /**
   * Notify when instructor creates a new laboratory
   */
  notifyLabAdded: (labTitle: string, platform?: string) => {
    const title = '🧪 New Laboratory Assigned';
    const message = `"${labTitle}"${platform ? ` on ${platform}` : ''} has been assigned`;
    useNotificationStore.getState().addNotification({ type: 'lab', title, message });
    broadcast('lab', title, message);
    toast.info('New Laboratory', { description: `"${labTitle}" has been assigned`, icon: '🧪' });
  },

  /**
   * Notify when instructor creates a new assignment/assessment
   */
  notifyAssignmentAdded: (assignmentTitle: string, dueDate?: string) => {
    const title = '✏️ New Assignment';
    const message = `"${assignmentTitle}"${dueDate ? ` — Due: ${dueDate}` : ''} has been assigned`;
    useNotificationStore.getState().addNotification({ type: 'assignment', title, message });
    broadcast('assignment', title, message);
    toast.info('New Assignment', { description: `"${assignmentTitle}" has been assigned`, icon: '✏️' });
  },

  /**
   * Notify a special announcement to all students
   */
  notifyAnnouncement: (text: string) => {
    const title = '📢 Announcement';
    const message = text;
    useNotificationStore.getState().addNotification({ type: 'announcement', title, message });
    broadcast('announcement', title, message);
    toast.info('Announcement', { description: text, icon: '📢' });
  },

  /**
   * Notify achievement (local only — per-student)
   */
  notifyAchievement: (achievementName: string) => {
    const title = '🎉 Achievement Unlocked!';
    const message = `You earned "${achievementName}"`;
    useNotificationStore.getState().addNotification({ type: 'achievement', title, message });
    toast.success('Achievement Unlocked!', { description: message, icon: '🎉' });
  },
};

