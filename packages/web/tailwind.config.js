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
          'gold-bright': 'var(--er-gold-bright)',
          accent: 'var(--er-accent)',
          fg: 'var(--er-fg)',
          muted: 'var(--er-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        er: ['Cinzel', 'Optimus Princeps', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'spin-gold': 'spinGold 1s linear infinite',
      },
    },
  },
};
