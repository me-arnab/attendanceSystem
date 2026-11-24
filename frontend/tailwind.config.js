/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5fa',
          100: '#e1ecf5',
          200: '#c3d8eb',
          300: '#95bee0',
          400: '#609fd1',
          500: '#3a81c2',
          600: '#2867a5',
          700: '#225286',
          800: '#1e466f',
          900: '#0f2942', // Deep corporate navy
          950: '#0a1a2c',
        },
        slate: {
          850: '#151e2e',
          900: '#0f172a',
        }
      },
    },
  },
  plugins: [],
}
