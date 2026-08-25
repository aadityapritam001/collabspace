/**
 * CollabSpace theme — DARK NAVY + PURPLE→CYAN (matches the CollabSpace logo).
 * The whole app runs in this cohesive dark aesthetic. Use `gradient` for hero moments.
 */
export const colors = {
  // Backgrounds
  surface: '#0F0B1F',          // deep navy — main app bg
  surface2: '#1A1533',         // elevated card
  surface3: '#251F42',         // input backgrounds
  surface4: '#332B57',         // subtle borders / hover
  onSurface: '#FFFFFF',
  onSurfaceMuted: '#B7B3D0',

  // Brand
  brand: '#A855F7',            // vibrant purple (primary)
  brandDark: '#7C3AED',
  brandSoft: '#2A1F4A',        // muted purple bg (for tinted areas)
  onBrand: '#FFFFFF',
  onBrandSoft: '#D8B4FE',

  // Accent
  accent: '#22D3EE',            // cyan — used sparingly for highlights
  onAccent: '#083344',

  // Status
  success: '#10B981',
  onSuccess: '#022C22',
  warning: '#F59E0B',
  onWarning: '#3A2400',
  error: '#F87171',
  onError: '#FFFFFF',
  info: '#B7B3D0',
  onInfo: '#0F0B1F',

  // Structure
  border: '#2A2450',
  borderStrong: '#3D3568',
  divider: '#231D40',
  muted: '#8B85AC',
};

// Gradient stops for hero surfaces / CTAs. Match the infinity logo colours.
export const gradient = {
  brand: ['#A855F7', '#22D3EE'] as [string, string],
  brandDeep: ['#7C3AED', '#06B6D4'] as [string, string],
  card: ['#1A1533', '#0F0B1F'] as [string, string],
  hero: ['#251F42', '#0F0B1F'] as [string, string],
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, xl: 28, pill: 999 };

export const font = {
  display: 'System',
  text: 'System',
  size: { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 30 },
  weight: { regular: '400' as const, medium: '500' as const, bold: '700' as const },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  glow: {
    shadowColor: '#A855F7',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
};
