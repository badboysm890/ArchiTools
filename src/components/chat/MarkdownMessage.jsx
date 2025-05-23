import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import './MarkdownMessage.css';

const MarkdownMessage = ({ content, isUser = false }) => {
  const [showThinking, setShowThinking] = useState(false);

  // Process content to handle <think> tags
  const processContent = (rawContent) => {
    if (!rawContent || typeof rawContent !== 'string') {
      return { mainContent: '', thinkingContent: '' };
    }

    // Extract thinking content between <think> tags
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    const thinkingMatches = rawContent.match(thinkRegex);
    
    let thinkingContent = '';
    if (thinkingMatches) {
      thinkingContent = thinkingMatches
        .map(match => match.replace(/<\/?think>/gi, '').trim())
        .join('\n\n');
    }

    // Remove thinking content from main content
    const mainContent = rawContent.replace(thinkRegex, '').trim();

    return { mainContent, thinkingContent };
  };

  const { mainContent, thinkingContent } = processContent(content);

  // Custom components for markdown rendering
  const markdownComponents = {
    // Code blocks with syntax highlighting
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (inline) {
        return (
          <code 
            className="bg-smortr-hover px-1.5 py-0.5 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div className="my-4">
          {language && (
            <div className="bg-smortr-hover px-3 py-1 text-xs text-smortr-text-secondary border-b border-smortr-border rounded-t-lg">
              {language}
            </div>
          )}
          <pre className={`${language ? 'rounded-t-none' : ''} bg-smortr-bg border border-smortr-border rounded-lg p-4 overflow-x-auto`}>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    },

    // Tables
    table({ children }) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="w-full border-collapse border border-smortr-border rounded-lg">
            {children}
          </table>
        </div>
      );
    },

    thead({ children }) {
      return <thead className="bg-smortr-hover">{children}</thead>;
    },

    th({ children }) {
      return (
        <th className="border border-smortr-border px-4 py-2 text-left font-semibold text-smortr-text">
          {children}
        </th>
      );
    },

    td({ children }) {
      return (
        <td className="border border-smortr-border px-4 py-2 text-smortr-text">
          {children}
        </td>
      );
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-smortr-accent pl-4 py-2 my-4 bg-smortr-hover/30 italic">
          {children}
        </blockquote>
      );
    },

    // Lists
    ul({ children }) {
      return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>;
    },

    ol({ children }) {
      return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
    },

    // Headings
    h1({ children }) {
      return <h1 className="text-2xl font-bold mt-6 mb-4 text-smortr-text">{children}</h1>;
    },

    h2({ children }) {
      return <h2 className="text-xl font-bold mt-5 mb-3 text-smortr-text">{children}</h2>;
    },

    h3({ children }) {
      return <h3 className="text-lg font-semibold mt-4 mb-2 text-smortr-text">{children}</h3>;
    },

    // Links
    a({ href, children }) {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-smortr-accent hover:underline"
        >
          {children}
        </a>
      );
    },

    // Horizontal rules
    hr() {
      return <hr className="border-smortr-border my-6" />;
    },

    // Paragraphs
    p({ children }) {
      return <p className="mb-3 last:mb-0">{children}</p>;
    }
  };

  return (
    <div className="markdown-content">
      {/* Main content */}
      {mainContent && (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
            components={markdownComponents}
          >
            {mainContent}
          </ReactMarkdown>
        </div>
      )}

      {/* Thinking content (collapsible) */}
      {thinkingContent && !isUser && (
        <div className="mt-4 border-t border-smortr-border/50 pt-3 thinking-section">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center space-x-2 text-xs text-smortr-text-secondary hover:text-smortr-text transition-colors thinking-toggle w-full"
          >
            <svg 
              className={`w-3 h-3 transition-transform ${showThinking ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{showThinking ? 'Hide' : 'Show'} AI thinking process</span>
            <div className="flex-1"></div>
            <span className="text-xs opacity-60">
              {showThinking ? '🤔' : '💭'}
            </span>
          </button>
          
          {showThinking && (
            <div className="mt-3 p-3 bg-smortr-hover/20 rounded-lg border border-smortr-border/30 thinking-content">
              <div className="text-xs text-smortr-text-secondary mb-2 font-medium flex items-center space-x-1">
                <span>🤔</span>
                <span>AI Thinking Process:</span>
              </div>
              <div className="prose prose-sm max-w-none text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight, rehypeRaw]}
                  components={{
                    ...markdownComponents,
                    p({ children }) {
                      return <p className="mb-2 last:mb-0 text-sm text-smortr-text-secondary">{children}</p>;
                    },
                    code({ node, inline, className, children, ...props }) {
                      if (inline) {
                        return (
                          <code 
                            className="bg-smortr-bg/50 px-1 py-0.5 rounded text-xs font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      return markdownComponents.code({ node, inline, className, children, ...props });
                    }
                  }}
                >
                  {thinkingContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarkdownMessage; 