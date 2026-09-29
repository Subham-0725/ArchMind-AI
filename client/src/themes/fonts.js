/**
 * ArchMind AI Typography System
 *
 * Font families, weights, sizes, and line heights for consistent typography
 * across the application.
 */

export const fonts = {
  // ===================================================================
  // FONT FAMILIES
  // ===================================================================
  family: {
    // UI text - body text, headlines, general UI
    sans: [
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      '"Noto Sans"',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
      '"Noto Color Emoji"',
    ].join(', '),

    // Code/mono - code snippets, technical labels
    mono: [
      'ui-monospace',
      'SFMono-Regular',
      'Menlo',
      'Monaco',
      'Consolas',
      '"Liberation Mono"',
      '"Courier New"',
      'monospace',
    ].join(', '),
  },

  // ===================================================================
  // FONT WEIGHTS
  // ===================================================================
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // ===================================================================
  // FONT SIZES
  // ===================================================================
  size: {
    // Micro text - badges, metadata, system labels
    micro: {
      xs: '8px',    // text-[8px]
      sm: '9px',    // text-[9px]
      md: '10px',   // text-[10px]
      lg: '11px',   // text-[11px]
    },

    // Small - secondary content, captions
    small: '12px',  // text-xs

    // Base - body text
    base: {
      sm: '14px',   // text-sm
      md: '16px',   // text-base
    },

    // Headings
    heading: {
      lg: '18px',   // text-lg
      xl: '20px',   // text-xl
      '2xl': '24px',  // text-2xl
      '3xl': '30px',  // text-3xl
      '4xl': '36px',  // text-4xl
      '5xl': '48px',  // text-5xl
      '6xl': '60px',  // text-6xl
      '7xl': '72px',  // text-7xl
    },
  },

  // ===================================================================
  // LINE HEIGHTS
  // ===================================================================
  lineHeight: {
    none: 1,
    tight: 1.08,      // For large headlines
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,   // For body text with good readability
    loose: 2,
  },

  // ===================================================================
  // LETTER SPACING
  // ===================================================================
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',       // For badges and labels
    ultraWide: '0.18em',   // For uppercase mono labels (e.g., "STEP 01")
    superWide: '0.2em',    // For extreme uppercase tracking
  },

  // ===================================================================
  // TEXT TRANSFORM PRESETS
  // ===================================================================
  transform: {
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize',
    none: 'none',
  },

  // ===================================================================
  // COMMON TYPOGRAPHY COMBINATIONS
  // ===================================================================
  presets: {
    // Hero headline
    hero: {
      fontFamily: 'sans',
      fontSize: '72px',       // text-7xl
      fontWeight: 900,        // font-black
      lineHeight: 1.08,       // leading-[1.08]
      letterSpacing: '-0.025em',
    },

    // Section headline
    sectionHeading: {
      fontFamily: 'sans',
      fontSize: '48px',       // text-5xl
      fontWeight: 800,        // font-extrabold
      lineHeight: 1.25,       // leading-tight
      letterSpacing: '-0.025em',
    },

    // Card title
    cardTitle: {
      fontFamily: 'sans',
      fontSize: '18px',       // text-lg
      fontWeight: 700,        // font-bold
      lineHeight: 1.5,
      letterSpacing: '0',
    },

    // Body text
    body: {
      fontFamily: 'sans',
      fontSize: '14px',       // text-sm
      fontWeight: 400,        // font-normal
      lineHeight: 1.625,      // leading-relaxed
      letterSpacing: '0',
    },

    // Body small
    bodySmall: {
      fontFamily: 'sans',
      fontSize: '12px',       // text-xs
      fontWeight: 400,
      lineHeight: 1.625,
      letterSpacing: '0',
    },

    // Mono label (badges, status)
    monoLabel: {
      fontFamily: 'mono',
      fontSize: '10px',       // text-[10px]
      fontWeight: 700,        // font-bold
      lineHeight: 1,
      letterSpacing: '0.18em', // tracking-widest
      textTransform: 'uppercase',
    },

    // Mono label small
    monoLabelSmall: {
      fontFamily: 'mono',
      fontSize: '9px',        // text-[9px]
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
    },

    // Code snippet
    code: {
      fontFamily: 'mono',
      fontSize: '12px',       // text-xs
      fontWeight: 400,
      lineHeight: 1.625,
      letterSpacing: '0',
    },

    // Button text
    button: {
      fontFamily: 'mono',
      fontSize: '12px',       // text-xs
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: '0.05em', // tracking-wider
      textTransform: 'uppercase',
    },

    // Button small
    buttonSmall: {
      fontFamily: 'mono',
      fontSize: '10px',       // text-[10px]
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
  },
};

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Get a font preset by name
 * @param {string} presetName - Name of the preset
 * @returns {object} Font style object
 */
export const getFontPreset = (presetName) => {
  return fonts.presets[presetName] || {};
};

/**
 * Create custom font style
 * @param {object} options - Font style options
 * @returns {object} Font style object
 */
export const createFontStyle = ({
  family = 'sans',
  size = '14px',
  weight = 400,
  lineHeight = 1.5,
  letterSpacing = '0',
  transform = 'none',
} = {}) => {
  return {
    fontFamily: fonts.family[family] || family,
    fontSize: size,
    fontWeight: weight,
    lineHeight,
    letterSpacing,
    textTransform: transform,
  };
};

/**
 * Convert font preset to CSS string
 * @param {object} preset - Font preset object
 * @returns {string} CSS string
 */
export const presetToCSS = (preset) => {
  return Object.entries(preset)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value};`;
    })
    .join(' ');
};

export default fonts;
