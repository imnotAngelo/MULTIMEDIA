import { ConversationView } from '@/components/ConversationView';

export function Chatbox() {
  return (
    <ConversationView
      title="Message"
      subtitle="Send your inquiries and questions to your instructor"
      emptyContactsLabel="No instructors are available yet. Please check back later."
    />
  );
}

export default Chatbox;
