export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        er: {
          bg: 'var(--er-bg)',
          surface: 'var(--er-surface)',
          border: 'var(--er-border)',
          gold: 'var(--er-gold)',
          accent: 'var(--er-accent)',
          fg: 'var(--er-fg)',
          muted: 'var(--er-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
