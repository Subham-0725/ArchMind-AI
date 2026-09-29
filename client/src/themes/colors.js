/**
 * ArchMind AI Color System
 *
 * Dark-only technical workspace design with near-black backgrounds,
 * layered glass-morphic surfaces, and vivid cyan/blue accent colors.
 *
 * All colors are defined as hex values for use with Tailwind utilities.
 */

export const colors = {
  // ===================================================================
  // BACKGROUNDS
  // ===================================================================
  background: {
    // Page background - deepest layer
    page: {
      primary: '#04060b',
      secondary: '#050811',
      tertiary: '#03050a',
    },

    // Primary surfaces - cards, panels, primary containers
    surface: {
      primary: '#070c16',
      secondary: '#070c18',
      tertiary: '#080d1a',
      quaternary: '#080c16',
    },

    // Secondary surfaces - nested surfaces, input backgrounds
    surfaceSecondary: {
      primary: '#090e1b',
      secondary: '#09111f',
      tertiary: '#0a1020',
      quaternary: '#0b1222',
      quinary: '#0c1324',
    },

    // Tertiary surfaces - hover states, active states
    surfaceTertiary: {
      primary: '#0f1b33',
      secondary: '#050813',
      tertiary: '#04060d',
      quaternary: '#04060e',
    },
  },

  // ===================================================================
  // TEXT
  // ===================================================================
  text: {
    // Primary text - headlines, primary content
    primary: {
      white: '#ffffff',
      slate100: '#f1f5f9',
      slate200: '#e2e8f0',
    },

    // Secondary text - body text, descriptions
    secondary: {
      slate300: '#cbd5e1',
      slate400: '#94a3b8',
    },

    // Muted text - labels, metadata, disabled states
    muted: {
      slate500: '#64748b',
      slate600: '#475569',
    },
  },

  // ===================================================================
  // ACCENTS
  // ===================================================================
  accent: {
    // Primary accent (Cyan) - primary interactive elements, status indicators
    cyan: {
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
    },

    // Secondary accent (Blue) - secondary actions, data flow
    blue: {
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
    },

    // Tertiary accent (Indigo) - supporting accents
    indigo: {
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
    },

    // Sky - additional cyan variant
    sky: {
      400: '#38bdf8',
    },
  },

  // ===================================================================
  // STATE COLORS
  // ===================================================================
  state: {
    // Success states, positive indicators
    success: {
      emerald300: '#6ee7b7',
      emerald400: '#34d399',
      emerald500: '#10b981',
    },

    // Warning states
    warning: {
      amber400: '#fbbf24',
      amber500: '#f59e0b',
    },

    // Error states, destructive actions
    error: {
      red400: '#f87171',
      red500: '#ef4444',
    },
  },

  // ===================================================================
  // BORDERS
  // ===================================================================
  border: {
    // Subtle separators - use with opacity
    default: {
      white5: 'rgba(255, 255, 255, 0.05)',
      white7: 'rgba(255, 255, 255, 0.07)',
      white8: 'rgba(255, 255, 255, 0.08)',
      white9: 'rgba(255, 255, 255, 0.09)',
      white10: 'rgba(255, 255, 255, 0.1)',
      white15: 'rgba(255, 255, 255, 0.15)',
    },

    // Interactive borders, focus states - use with opacity
    accent: {
      cyan20: 'rgba(6, 182, 212, 0.2)',
      cyan25: 'rgba(6, 182, 212, 0.25)',
      cyan30: 'rgba(6, 182, 212, 0.3)',
      cyan40: 'rgba(6, 182, 212, 0.4)',
      cyan50: 'rgba(6, 182, 212, 0.5)',
      blue30: 'rgba(59, 130, 246, 0.3)',
      blue40: 'rgba(59, 130, 246, 0.4)',
    },
  },

  // ===================================================================
  // GRADIENTS
  // ===================================================================
  gradients: {
    // Primary gradient - hero elements, CTAs
    primary: {
      from: '#22d3ee', // cyan-400
      via: '#3b82f6',  // blue-500
      to: '#6366f1',   // indigo-500
    },

    // Text gradient - headlines
    text: {
      from: '#67e8f9', // cyan-300
      via: '#60a5fa',  // blue-400
      to: '#818cf8',   // indigo-400
    },

    // Glass surface - modals, overlays
    glass: {
      from: 'rgba(15, 23, 42, 0.78)',  // slate-900/78
      to: 'rgba(5, 11, 22, 0.88)',     // custom dark/88
    },
  },

  // ===================================================================
  // SHADOWS & GLOWS
  // ===================================================================
  shadows: {
    // Card shadows
    card: {
      default: '0 15px 30px rgba(0, 0, 0, 0.35)',
      lg: '0 20px 50px rgba(0, 0, 0, 0.5)',
      xl: '0 25px 70px rgba(0, 0, 0, 0.85)',
    },

    // Cyan glow effects
    glow: {
      cyan: {
        sm: '0 0 10px rgba(6, 182, 212, 0.15)',
        md: '0 0 20px rgba(6, 182, 212, 0.3)',
        lg: '0 0 25px rgba(6, 182, 212, 0.4)',
        xl: '0 0 35px rgba(6, 182, 212, 0.12)',
      },
      blue: {
        sm: '0 0 10px rgba(59, 130, 246, 0.15)',
        md: '0 0 20px rgba(59, 130, 246, 0.3)',
      },
      emerald: {
        sm: '0 0 6px rgba(52, 211, 153, 0.7)',
        md: '0 0 8px rgba(34, 211, 238, 0.8)',
      },
    },
  },
};

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Get a color value by path
 * @param {string} path - Dot notation path (e.g., 'accent.cyan.400')
 * @returns {string} Color value
 */
export const getColor = (path) => {
  return path.split('.').reduce((obj, key) => obj?.[key], colors);
};

/**
 * Create rgba color with custom opacity
 * @param {string} hex - Hex color value
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
export const withOpacity = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export default colors;
