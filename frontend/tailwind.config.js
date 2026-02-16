/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Colores estilo LexIA (verde claro)
        claude: {
          orange: '#64c27b',    // Verde claro (reemplaza azul)
          lightOrange: '#7BD18E', // Verde más claro
          darkOrange: '#52a068',  // Verde más oscuro
          beige: '#FAF8F5',     // Nuevo fondo beige crema
          darkBeige: '#F5F2EF',
          text: '#3D3D3D',      // Nuevo color de texto principal
          gray: {
            50: '#FAFAF9',      // Muy claro
            100: '#F4F2F0',     // Claude background claro
            200: '#E8E6E3',     // Bordes suaves
            300: '#D1CDC7',     // Texto secundario claro
            400: '#9B9691',     // Texto secundario
            500: '#6B6661',     // Texto normal
            600: '#4F4B45',     // Texto oscuro
            700: '#3A362F',     // Casi negro
            800: '#2A2621',     // Modo oscuro background
            900: '#1A1813',     // Modo oscuro más oscuro
          }
        },
        // Mantener primary para compatibilidad (ahora verde claro)
        primary: {
          50: '#F0FAF3',
          100: '#E1F5E7',
          200: '#C3EBCF',
          300: '#A5E0B7',
          400: '#87D69F',
          500: '#64c27b',      // Verde claro principal
          600: '#52a068',
          700: '#407E55',
          800: '#2E5C42',
          900: '#1C3A2F',
        },
        // Colores legales (mantener para iconos)
        legal: {
          gold: '#D4AF37',
          bronze: '#CD7F32',
          darkblue: '#1e3a8a',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'claude': ['Inter', 'system-ui', 'sans-serif'], // Fuente similar a Claude
      },
      animation: {
        'typing': 'typing 1.5s steps(3) infinite',
        'balance': 'balance 0.6s ease-in-out',
        'pulse-scale': 'pulseScale 2s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'rotate': 'rotate 0.5s ease-in-out',
      },
      keyframes: {
        typing: {
          '0%': { opacity: '0' },
          '20%': { opacity: '1' },
          '40%': { opacity: '1' },
          '60%': { opacity: '1' },
          '80%': { opacity: '0' },
          '100%': { opacity: '0' },
        },
        balance: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-8deg)' },
          '75%': { transform: 'rotate(8deg)' },
        },
        pulseScale: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-2px)' },
          '75%': { transform: 'translateX(2px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        rotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
};