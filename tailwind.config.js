/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        brand: 'var(--color-brand)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
      },
      spacing: {
        '0': '0px',
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
      },
      borderRadius: {
        none: '0',
        s: 'var(--radius-s)',
        m: 'var(--radius-m)',
        l: 'var(--radius-l)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        DEFAULT: 'var(--dur-std)',
        slow: 'var(--dur-slow)',
      },
    },
  },
  plugins: [],
}

