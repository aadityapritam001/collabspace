/**
 * Reusable Brand logo & wordmark component.
 * Renders the attached CollabSpace app-icon PNG at any size, optional wordmark.
 */
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';

const LOGO = require('../../assets/images/collabspace-logo.png');

type Props = {
  size?: number;
  showWordmark?: boolean;
  tagline?: string;
};

export function BrandLogo({ size = 72, showWordmark = false, tagline }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={LOGO}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        contentFit="cover"
        transition={200}
      />
      {showWordmark ? (
        <>
          <Text style={[styles.wordmark, { fontSize: size * 0.34 }]}>CollabSpace</Text>
          {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  wordmark: { color: colors.onSurface, fontWeight: '700', letterSpacing: 0.5 },
  tagline: { color: colors.onSurfaceMuted, fontSize: font.size.base },
});
