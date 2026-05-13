/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0c1017',
        surface: '#131a24',
        elevated: '#1a2330',
        muted: '#8b9aaf',
        line: '#2a3545',
        accent: '#5a7a9a',
        'accent-soft': '#3d5266',
        'accent-hover': '#6d8aad',
        success: '#4a9d7a',
        danger: '#b85c5c',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.35)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
