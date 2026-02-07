'use client';

import { ChatContainer } from '@/components/chat/ChatContainer';

export default function ChatPage() {
  return (
    <div className="h-full">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Chat with Shelly
      </h1>
      <ChatContainer />
    </div>
  );
}
