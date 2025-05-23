import React, { useState } from 'react';
import Navbar from './components/layout/Navbar';
import LeftSidebar from './components/layout/LeftSidebar';
import RightSidebar from './components/layout/RightSidebar';
import MainContent from './components/layout/MainContent';
import ChatInput from './components/layout/ChatInput';
import ChatMessages from './components/chat/ChatMessages';
import ErrorBoundary from './components/common/ErrorBoundary';
import FileManager from './components/FileManager';
import { useChat } from './hooks/useChat';
import { FaFolder, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

function App() {
  const { messages, isTyping, clearChat } = useChat();
  const [isFileManagerExpanded, setIsFileManagerExpanded] = useState(false);
  const [isFileManagerHovered, setIsFileManagerHovered] = useState(false);

  const shouldShowExpanded = isFileManagerExpanded || isFileManagerHovered;

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
            
            {/* Chat Area - expanded when file manager is collapsed */}
            <div className={`border-l border-smortr-border flex flex-col bg-smortr-sidebar transition-all duration-300 ${
              shouldShowExpanded ? 'w-96' : 'w-[480px]'
            }`}>
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
              <ErrorBoundary>
                <ChatMessages messages={messages} isTyping={isTyping} />
              </ErrorBoundary>
            </div>
          </div>
          <ChatInput />
        </main>
        
        {/* Collapsible File Manager */}
        <div 
          className={`relative border-l border-smortr-border transition-all duration-300 bg-smortr-bg ${
            shouldShowExpanded ? 'w-80' : 'w-12'
          }`}
          onMouseEnter={() => setIsFileManagerHovered(true)}
          onMouseLeave={() => setIsFileManagerHovered(false)}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsFileManagerExpanded(!isFileManagerExpanded)}
            className="absolute top-4 -left-3 z-10 bg-smortr-accent text-white p-1.5 rounded-full shadow-lg hover:bg-smortr-accent/90 transition-colors"
            title={isFileManagerExpanded ? 'Collapse File Manager' : 'Expand File Manager'}
          >
            {shouldShowExpanded ? <FaChevronRight size={12} /> : <FaChevronLeft size={12} />}
          </button>

          {/* Collapsed State - Tab */}
          {!shouldShowExpanded && (
            <div className="h-full flex flex-col items-center justify-center py-4">
              <div className="transform -rotate-90 whitespace-nowrap text-smortr-text-secondary text-sm font-medium mb-4">
                File Manager
              </div>
              {/* <FaFolder className="text-smortr-text-secondary w-6 h-6" /> */}
            </div>
          )}

          {/* Expanded State - Full File Manager */}
          {shouldShowExpanded && (
            <div className="h-full overflow-hidden">
              <FileManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App; 