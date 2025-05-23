import React, { useState } from 'react';
import Logo from '../common/Logo';
import { useDispatch, useSelector } from 'react-redux';
import { setSplitView, setOverlayView } from '../../store/slices/uiSlice';
import logoImg from '../../assets/SmortrLogo.png';

const Navbar = () => {
  const dispatch = useDispatch();
  const { splitView, overlayView } = useSelector(state => state.ui);
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="h-16 flex items-center px-6 shadow-smortr z-50 bg-gradient-to-r from-smortr-accent via-smortr-accent-2 to-smortr-accent-3 transition-colors">
      <div className="flex items-center space-x-3">
        {/* add the logo here */}
        <img src={logoImg} alt="Smortr" className="h-9 w-auto" />
        {/* <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-lg select-none">Smortr</h1> */}
      </div>
      <div className="flex-1 flex justify-center">
        <div className="flex items-center space-x-2 bg-smortr-card rounded-xl px-4 py-2 shadow-smortr card-pop">
          <button
            className={`px-4 py-1.5 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-smortr-accent-2 ${
              splitView
                ? 'bg-smortr-accent-2 text-white shadow'
                : 'text-smortr-text-secondary hover:bg-smortr-hover hover:text-smortr-accent-2'
            }`}
            onClick={() => dispatch(setSplitView(!splitView))}
          >
            Split
          </button>
          <button
            className={`px-4 py-1.5 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-smortr-accent-3 ${
              overlayView
                ? 'bg-smortr-accent-3 text-white shadow'
                : 'text-smortr-text-secondary hover:bg-smortr-hover hover:text-smortr-accent-3'
            }`}
            onClick={() => dispatch(setOverlayView(!overlayView))}
          >
            Overlay
          </button>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            className="w-10 h-10 bg-smortr-accent-2 rounded-full flex items-center justify-center text-white font-bold text-lg shadow hover:scale-105 transition"
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="User menu"
          >
            BA
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 card shadow-smortr-lg fade-in">
              <div className="px-4 py-3 border-b border-smortr-border">
                <span className="block text-sm font-semibold text-smortr-text">Badfy17g</span>
                <span className="block text-xs text-smortr-text-secondary">user@email.com</span>
              </div>
              <div className="py-2">
                <button className="w-full text-left px-4 py-2 hover:bg-smortr-hover rounded-xl transition text-smortr-text-secondary">Profile (coming soon)</button>
                <button className="w-full text-left px-4 py-2 hover:bg-smortr-hover rounded-xl transition text-smortr-text-secondary">Settings (coming soon)</button>
                <button className="w-full text-left px-4 py-2 hover:bg-smortr-hover rounded-xl transition text-red-400">Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 