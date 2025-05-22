/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'smortr': {
          'bg': '#181A20',        // Main background (darker)
          'bg-light': '#F7F8FA',  // Light background
          'sidebar': '#23272F',    // Sidebar background
          'sidebar-light': '#FFFFFF',
          'accent': '#2563eb',     // Blue accent (modern)
          'accent-2': '#7C3AED',   // Secondary accent (purple)
          'accent-3': '#F59E42',   // Tertiary accent (orange)
          'text': '#F3F4F6',       // Primary text color (light)
          'text-dark': '#181A20',  // Primary text color (dark)
          'text-secondary': '#A0AEC0', // Secondary text color
          'border': '#2D3748',     // Border color
          'border-light': '#E2E8F0',
          'hover': '#23272F',      // Hover state color
          'hover-light': '#F1F5F9',
          'notification': '#FF3B30', // Notification/marker color
          'card': '#23272F',       // Card background
          'card-light': '#FFFFFF',
          'shadow': 'rgba(0,0,0,0.08)',
        },
      },
      boxShadow: {
        'smortr': '0 2px 8px 0 rgba(0,0,0,0.08)',
        'smortr-lg': '0 8px 32px 0 rgba(0,0,0,0.16)',
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
    },
  },
  plugins: [],
} 