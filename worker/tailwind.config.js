module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        bg:      '#111c1c',
        bgdark:  '#0a1414',
        bgcard:  '#162424',
        coral:   '#e8806a',
        teal:    '#4ecdc4',
        dim:     '#6a9090',
        border:  '#1e3232',
        textmain:'#cde0de',
      },
    },
  },
  plugins: [],
};
