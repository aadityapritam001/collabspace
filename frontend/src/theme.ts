/**
 * CollabSpace theme tokens — derived directly from /app/design_guidelines.json
 * ("4 Tactile / Playful LIGHT" personality). Central place to change look & feel.
 */
export const colors = {
  surface: '#FCFCFA',
  onSurface: '#171714',
  surface2: '#F2F2ED',
  onSurface2: '#3A3A35',
  surface3: '#E5E5DE',
  surfaceInverse: '#171714',
  onSurfaceInverse: '#FCFCFA',
  brand: '#FF5A5F',
  brandSoft: '#FFE1E2',
  onBrand: '#FFFFFF',
  onBrandSoft: '#BA131A',
  accent: '#FFC300',
  onAccent: '#4D3A00',
  success: '#00C49A',
  onSuccess: '#003B2E',
  warning: '#FFC300',
  error: '#E63946',
  onError: '#FFFFFF',
  info: '#4A4A45',
  border: '#E5E5DE',
  borderStrong: '#C2C2B8',
  divider: '#E5E5DE',
  muted: '#6B6B63',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export const font = {
  // System stack — no external font files required.
  display: 'System',
  text: 'System',
  size: { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 30 },
  weight: { regular: '400' as const, medium: '500' as const },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
};
