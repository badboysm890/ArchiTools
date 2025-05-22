import React from 'react';

const Breadcrumb = ({ path = '.', onNavigate }) => {
  const segments = path === '.' ? [] : path.split('/');
  const fullSegments = segments.reduce((acc, seg, idx) => {
    const prev = acc[idx - 1] || '.';
    acc.push(prev === '.' ? seg : prev + '/' + seg);
    return acc;
  }, []);

  return (
    <nav className="flex items-center space-x-2 px-3 py-1 rounded glassy-bg text-smortr-text-secondary" aria-label="Breadcrumb">
      <button
        className="hover:text-smortr-accent focus:outline-none"
        onClick={() => onNavigate('.')}
      >
        Root
      </button>
      {segments.map((seg, idx) => (
        <React.Fragment key={fullSegments[idx]}>
          <span className="mx-1">/</span>
          <button
            className="hover:text-smortr-accent focus:outline-none"
            onClick={() => onNavigate(fullSegments[idx])}
          >
            {seg}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb; 