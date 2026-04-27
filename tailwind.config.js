/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        'ink-faded': 'var(--ink-faded)',
        'accent-blood': 'var(--accent-blood)',
        'accent-gold': 'var(--accent-gold)',
        'accent-sage': 'var(--accent-sage)',
      },
      fontFamily: {
        display: ['"Crimson Pro"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        paper: '0 2px 8px var(--paper-shadow), 0 1px 2px var(--paper-shadow)',
      },
    },
  },
  plugins: [],
};
