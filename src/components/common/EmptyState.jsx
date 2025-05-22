import React from 'react';

const EmptyState = ({
  illustration = 'folder',
  title = 'Nothing here yet',
  description = 'There is no content to display.',
  children,
}) => {
  // Simple SVGs for different empty states
  const illustrations = {
    folder: (
      <svg width="80" height="80" fill="none" viewBox="0 0 80 80" aria-hidden="true">
        <rect x="8" y="28" width="64" height="36" rx="8" fill="#2563eb" fillOpacity="0.08" />
        <rect x="16" y="36" width="48" height="20" rx="4" fill="#2563eb" fillOpacity="0.16" />
        <rect x="24" y="44" width="32" height="8" rx="2" fill="#2563eb" fillOpacity="0.24" />
        <rect x="20" y="20" width="16" height="8" rx="2" fill="#7C3AED" fillOpacity="0.24" />
      </svg>
    ),
    file: (
      <svg width="80" height="80" fill="none" viewBox="0 0 80 80" aria-hidden="true">
        <rect x="20" y="16" width="40" height="48" rx="6" fill="#7C3AED" fillOpacity="0.08" />
        <rect x="28" y="24" width="24" height="32" rx="3" fill="#7C3AED" fillOpacity="0.16" />
        <rect x="32" y="36" width="16" height="4" rx="2" fill="#7C3AED" fillOpacity="0.24" />
        <rect x="32" y="44" width="16" height="4" rx="2" fill="#2563eb" fillOpacity="0.16" />
      </svg>
    ),
    search: (
      <svg width="80" height="80" fill="none" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="36" cy="36" r="20" fill="#F59E42" fillOpacity="0.08" />
        <rect x="28" y="32" width="16" height="8" rx="2" fill="#F59E42" fillOpacity="0.16" />
        <circle cx="56" cy="56" r="8" fill="#F59E42" fillOpacity="0.16" />
        <rect x="52" y="52" width="8" height="16" rx="4" fill="#2563eb" fillOpacity="0.16" transform="rotate(45 52 52)" />
      </svg>
    ),
    tool: (
      <svg width="80" height="80" fill="none" viewBox="0 0 80 80" aria-hidden="true">
        <rect x="24" y="24" width="32" height="32" rx="8" fill="#2563eb" fillOpacity="0.08" />
        <rect x="32" y="32" width="16" height="16" rx="4" fill="#2563eb" fillOpacity="0.16" />
        <rect x="36" y="36" width="8" height="8" rx="2" fill="#7C3AED" fillOpacity="0.24" />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 fade-in" role="status" aria-live="polite">
      <div className="mb-4">{illustrations[illustration]}</div>
      <h2 className="text-xl font-bold text-smortr-text mb-2">{title}</h2>
      <p className="text-sm text-smortr-text-secondary mb-4 max-w-xs mx-auto">{description}</p>
      {children}
    </div>
  );
};

export default EmptyState; 