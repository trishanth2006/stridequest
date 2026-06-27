/** @type {import('tailwindcss').Config} */
const palette = require('./src/theme/palette')
// Omit keys that collide with stock Tailwind scales still used as classes
// (e.g. `yellow-400`) until those usages are consolidated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { yellow, blue, gray, ...themeColors } = palette

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: themeColors,
    },
  },
  plugins: [],
}
