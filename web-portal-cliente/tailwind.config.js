/** @type {import('tailwindcss').Config} */
export default {
  important: '#root',
  content: ['./index.html', './src/index.css', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f4f6f9',
        surface: '#ffffff',
        'surface-muted': '#f9fafb',
        elevated: '#ffffff',
        sidebar: '#1e293b',
        'sidebar-hover': '#334155',
        'sidebar-active': '#2563eb',
        ink: '#1f2937',
        'ink-secondary': '#374151',
        muted: '#6b7280',
        line: '#e5e7eb',
        accent: {
          DEFAULT: '#2563eb',
          soft: '#dbeafe',
          hover: '#1d4ed8',
        },
        success: {
          DEFAULT: '#16a34a',
          soft: '#dcfce7',
          ink: '#166534',
        },
        danger: {
          DEFAULT: '#dc2626',
          soft: '#fee2e2',
          ink: '#991b1b',
        },
        warning: {
          DEFAULT: '#ca8a04',
          soft: '#fef9c3',
          ink: '#854d0e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card-md': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 2px 4px rgba(0, 0, 0, 0.06), 0 8px 20px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.5rem',
      },
    },
  },
  plugins: [],
}
