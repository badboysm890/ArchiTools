import React from 'react';
import Navbar from './components/layout/Navbar';
import LeftSidebar from './components/layout/LeftSidebar';
import RightSidebar from './components/layout/RightSidebar';
import MainContent from './components/layout/MainContent';
import ChatInput from './components/layout/ChatInput';
import ChatMessages from './components/chat/ChatMessages';
import FileManager from './components/FileManager';
import { useChat } from './hooks/useChat';

function App() {
  const { messages, isTyping, clearChat } = useChat();

  return (
    <div className="flex flex-col h-screen bg-smortr-bg">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <main className="flex-1 flex flex-col">
          <div className="flex flex-1 overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
              <MainContent />
            </div>
            
            {/* Chat Area */}
            <div className="w-96 border-l border-smortr-border flex flex-col bg-smortr-sidebar">
              <div className="px-4 py-3 border-b border-smortr-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-smortr-text">AI Assistant</h2>
                  <p className="text-xs text-smortr-text-secondary">Ask questions or upload images for analysis</p>
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="ml-2 px-2 py-1 rounded bg-smortr-hover text-smortr-text-secondary text-xs hover:bg-red-100 hover:text-red-600 border border-transparent hover:border-red-300 transition-colors flex items-center"
                    title="Clear chat"
                  >
                    {/* Trash icon (inline SVG) */}
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear
                  </button>
                )}
              </div>
              <ChatMessages messages={messages} isTyping={isTyping} />
            </div>
          </div>
          <ChatInput />
        </main>
        <div className="w-80 border-l border-smortr-border">
          <FileManager />
        </div>
      </div>
    </div>
  );
}

export default App; 