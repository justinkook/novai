import baseConfig from '@workspace/ui/tailwind.config';
import type { Config } from 'tailwindcss';

const config: Config = {
  ...baseConfig,
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      ...baseConfig.theme?.extend,
      keyframes: {
        'gradient-xy-enhanced': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'left center',
            transform: 'rotate(-3deg)',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
            transform: 'rotate(3deg)',
          },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'gradient-xy-enhanced': 'gradient-xy-enhanced 15s ease infinite',
        'gradient-x': 'gradient-x 3s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        ...baseConfig.theme?.extend?.colors,
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      fontFamily: {
        ...baseConfig.theme?.extend?.fontFamily,
        mono: [
          '"Fira Code"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
      },
      letterSpacing: {
        tighter: '-0.04em',
      },
    },
  },
  plugins: [
    ...(baseConfig.plugins || []),
    require('tailwind-scrollbar-hide'),
    require('@assistant-ui/react/tailwindcss')({
      components: ['thread'],
    }),
    require('tailwind-scrollbar'),
  ],
};

export default config;
