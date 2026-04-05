/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  safelist: [
    'bg-background', 'text-foreground', 'bg-card', 'text-card-foreground',
    'border-border', 'ring-ring', 'bg-popover', 'text-popover-foreground',
    'bg-primary', 'text-primary-foreground', 'bg-secondary', 'text-secondary-foreground',
    'bg-muted', 'text-muted-foreground', 'bg-accent', 'text-accent-foreground',
    'bg-destructive', 'text-destructive', 'border-input',
  ],
  presets: [require("./src/components/ui/preset")],
  plugins: [],
};
