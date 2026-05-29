/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f4f6f9',
        surface: '#ffffff',
        elevated: '#ffffff',
        sidebar: '#1e293b',
        'sidebar-hover': '#334155',
        'sidebar-active': '#2563eb',
        ink: '#1f2937',
        'ink-secondary': '#374151',
        muted: '#6b7280',
        line: '#e5e7eb',
        accent: '#2563eb',
        'accent-soft': '#dbeafe',
        'accent-hover': '#1d4ed8',
        success: '#16a34a',
        'success-soft': '#dcfce7',
        'success-ink': '#166534',
        danger: '#dc2626',
        'danger-soft': '#fee2e2',
        'danger-ink': '#991b1b',
        warning: '#ca8a04',
        'warning-soft': '#fef9c3',
        'warning-ink': '#854d0e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card-md': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.5rem',
      },
    },
  },
  plugins: [],
}
