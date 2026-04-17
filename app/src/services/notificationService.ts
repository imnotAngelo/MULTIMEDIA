import { toast } from 'sonner';
import { useNotificationStore } from '@/stores/notificationStore';

export const notificationService = {
  /**
   * Notify when instructor adds a new unit
   */
  notifyUnitAdded: (unitName: string) => {
    const store = useNotificationStore.getState();
    store.addNotification({
      type: 'unit',
      title: '📚 New Unit',
      message: `"${unitName}" has been added`,
    });

    toast.success(`New Unit Added`, {
      description: `"${unitName}" is now available`,
      icon: '📚',
    });
  },

  /**
   * Notify when instructor adds a new lesson
   */
  notifyLessonAdded: (lessonTitle: string, unitName?: string) => {
    const store = useNotificationStore.getState();
    store.addNotification({
      type: 'lesson',
      title: '📖 New Lesson',
      message: `"${lessonTitle}"${unitName ? ` in ${unitName}` : ''} has been added`,
    });

    toast.success(`New Lesson Available`, {
      description: `"${lessonTitle}" is ready to learn`,
      icon: '📖',
    });
  },

  /**
   * Notify when instructor adds a new assignment
   */
  notifyAssignmentAdded: (assignmentTitle: string, dueDate?: string) => {
    const store = useNotificationStore.getState();
    store.addNotification({
      type: 'assignment',
      title: '✏️ New Assignment',
      message: `"${assignmentTitle}"${dueDate ? ` - Due: ${dueDate}` : ''} has been assigned`,
    });

    toast.info(`New Assignment`, {
      description: `"${assignmentTitle}" has been assigned to you`,
      icon: '✏️',
    });
  },

  /**
   * Notify achievement
   */
  notifyAchievement: (achievementName: string) => {
    const store = useNotificationStore.getState();
    store.addNotification({
      type: 'achievement',
      title: '🎉 Achievement Unlocked!',
      message: `You earned "${achievementName}"`,
    });

    toast.success(`Achievement Unlocked!`, {
      description: `You earned "${achievementName}"`,
      icon: '🎉',
    });
  },
};
