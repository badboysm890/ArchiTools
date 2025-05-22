import React from 'react';

const SkeletonLoader = ({ rows = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse h-8 rounded glassy-bg bg-smortr-hover/60"
        style={{ minWidth: 0 }}
      >
        &nbsp;
      </div>
    ))}
  </div>
);

export default SkeletonLoader; 