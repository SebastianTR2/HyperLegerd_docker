/** @type {import('tailwindcss').Config} */
export default {
  /** Mayor especificidad (#root …) para ganar a CSS global / auto-dark agresivo */
  important: '#root',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /** Fondo general crema / marfil (pedido) */
        canvas: '#F8F6F2',
        /** Tarjetas y cabeceras */
        surface: '#FFFFFF',
        /** Filas alternas, bloques suaves */
        'surface-muted': '#F5F2EC',
        elevated: '#FFFFFF',
        /** Bordes discretos */
        line: '#E8E1D8',
        /** Texto secundario */
        muted: '#6B7280',
        /** Texto principal */
        ink: '#1F2937',
        'ink-secondary': '#374151',
        /** Acento naranja elegante */
        accent: '#D97706',
        'accent-hover': '#C96E0A',
        'accent-soft': '#FFF1E6',
        'accent-ring': 'rgba(217, 119, 6, 0.25)',
        /** Éxito suave */
        success: '#DCFCE7',
        'success-border': '#86EFAC',
        'success-text': '#2E8B57',
        /** Error / baja suave */
        danger: '#FEE2E2',
        'danger-border': '#FECACA',
        'danger-text': '#991B1B',
        'danger-solid': '#C75C5C',
        /** Aviso */
        warn: '#FEF9C3',
        'warn-border': '#FDE047',
        'warn-text': '#854D0E',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(31, 41, 55, 0.04), 0 4px 16px rgba(31, 41, 55, 0.06)',
        'card-hover': '0 2px 4px rgba(31, 41, 55, 0.06), 0 8px 20px rgba(31, 41, 55, 0.08)',
      },
    },
  },
  plugins: [],
}
