export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        er: {
          bg: '#0a0a0a',
          surface: '#161616',
          border: '#2a2a2a',
          gold: '#d4af37',
          accent: '#8b7355',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
