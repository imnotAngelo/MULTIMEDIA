import { ConversationView } from '@/components/ConversationView';

export function InstructorMessages() {
  return (
    <ConversationView
      title="Student Messages"
      subtitle="Reply to student inquiries and questions"
      emptyContactsLabel="No students have registered yet."
    />
  );
}

export default InstructorMessages;
