/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  safelist: [
    'dark:bg-gray-900',
    'dark:bg-gray-800',
    'dark:bg-gray-700',
    'dark:text-white',
    'dark:text-gray-200',
    'dark:text-gray-300',
    'dark:text-gray-400',
    'dark:border-gray-700',
    'dark:border-gray-600',
    'dark:hover:bg-gray-600',
    'dark:hover:bg-gray-700',
  ],
  theme: {
    extend: {
      colors: {
        // Sampled from the logo: the wordmark's azure (#0083eb) anchors 500, and
        // the ramp darkens towards the mark's navy (#041636). The default
        // Tailwind blue this replaced was indigo-leaning and visibly disagreed
        // with the artwork sitting next to it. 600 carries white text at 5.06:1,
        // comfortably past AA and better than the 4.5:1 it had before.
        primary: {
          50: '#f0f8fe',
          100: '#deeffc',
          200: '#b8dcf9',
          300: '#85c3f5',
          400: '#47a6f1',
          500: '#0083eb',
          600: '#016fca',
          700: '#025aa6',
          800: '#024482',
          900: '#032e5e',
        },
        // The mark's navy, for dark surfaces that should read as brand rather
        // than as neutral grey.
        navy: {
          700: '#0a2a55',
          800: '#071e3f',
          900: '#041636',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
