import React from 'react';
import Navbar from './components/layout/Navbar';
import LeftSidebar from './components/layout/LeftSidebar';
import RightSidebar from './components/layout/RightSidebar';
import MainContent from './components/layout/MainContent';
import ChatInput from './components/layout/ChatInput';
import FileManager from './components/FileManager';

function App() {
  return (
    <div className="flex flex-col h-screen bg-smortr-bg">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <main className="flex-1 flex flex-col">
          <MainContent />
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