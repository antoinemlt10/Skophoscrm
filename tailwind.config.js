/** @type {import('tailwindcss').Config} */

// Design tokens live as CSS variables in src/index.css (channel-triplet format, e.g. "10 11 15").
// We map them here so utilities like `bg-base`, `text-secondary`, `border-default` work AND
// still support opacity modifiers (e.g. `bg-accent/10`). This is the standard Tailwind v3 pattern.
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // These are built dynamically (e.g. `bg-${stageColor}`) so Tailwind can't
  // see them in the source — list them here so they're never purged.
  safelist: ['bg-muted', 'bg-info', 'bg-accent', 'bg-streak', 'bg-success', 'bg-danger'],
  theme: {
    extend: {
      colors: {
        base: withAlpha('--bg-base'),
        surface: withAlpha('--bg-surface'),
        elevated: withAlpha('--bg-elevated'),
        overlay: withAlpha('--bg-overlay'),
        'border-subtle': withAlpha('--border-subtle'),
        'border-default': withAlpha('--border-default'),
        'border-strong': withAlpha('--border-strong'),
        primary: withAlpha('--text-primary'),
        secondary: withAlpha('--text-secondary'),
        muted: withAlpha('--text-muted'),
        accent: withAlpha('--accent'),
        'accent-hover': withAlpha('--accent-hover'),
        success: withAlpha('--success'),
        danger: withAlpha('--danger'),
        streak: withAlpha('--streak'),
        info: withAlpha('--info'),
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Space Grotesk"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
        pop: '0 24px 60px -20px rgba(0,0,0,0.7)',
        glow: '0 0 28px -4px rgb(var(--accent) / 0.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'scale-in': {
          from: { opacity: 0, transform: 'scale(0.96) translateY(6px)' },
          to: { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'flame-flicker': {
          '0%,100%': { transform: 'scale(1) rotate(-2deg)', opacity: 0.95 },
          '50%': { transform: 'scale(1.08) rotate(2deg)', opacity: 1 },
        },
        'bounce-soft': {
          '0%': { transform: 'scale(0.4)', opacity: 0 },
          '55%': { transform: 'scale(1.12) translateY(-6px)', opacity: 1 },
          '75%': { transform: 'scale(0.96) translateY(0)' },
          '100%': { transform: 'scale(1) translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.16,1,0.3,1)',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both',
        flame: 'flame-flicker 1.6s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 0.7s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
}
