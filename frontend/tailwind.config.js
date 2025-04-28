/** @type {import('tailwindcss').Config} */
export default {
  important: '#root',
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-primary': '#18191A', // deep charcoal
        'dark-secondary': '#232526', // slightly lighter charcoal
        'dark-tertiary': '#2C2F31', // for cards/inputs
        'accent-primary': '#bb86fc',
        'accent-secondary': '#3700b3',
        'text-primary': '#F3F4F6', // near white
        'text-secondary': '#B0B3B8' // muted gray
      },
      boxShadow: {
        'neon-blue': '0 0 5px #00f3ff, 0 0 10px #00f3ff, 0 0 15px #00f3ff',
        'neon-green': '0 0 5px #00ff66, 0 0 10px #00ff66, 0 0 15px #00ff66',
        'glass': '0 0 15px rgba(0, 0, 0, 0.1)',
        'glass-strong': '0 0 20px rgba(0, 0, 0, 0.2)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}