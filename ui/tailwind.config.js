/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        m3: {
          primary: '#0B57D0', // Google Blue
          'on-primary': '#FFFFFF',
          'primary-container': '#D3E3FD',
          'on-primary-container': '#041E49',
          secondary: '#5E5E5E',
          'secondary-container': '#E3E3E3',
          'on-secondary-container': '#1F1F1F',
          tertiary: '#0F5223', // Green accent
          'tertiary-container': '#C4EED0',
          'on-tertiary-container': '#072711',
          error: '#B3261E',
          'error-container': '#F9DEDC',
          'on-error-container': '#410E0B',
          surface: '#F8F9FA',
          'surface-variant': '#E1E3E1',
          'on-surface-variant': '#444746',
          outline: '#747775',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '3rem',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.05)',
        'glass-hover': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-dark': '0 4px 30px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      zIndex: {
        '60': '60',
        '70': '70',
        'modal': '100',
      },
    },
  },
  plugins: [],
}
