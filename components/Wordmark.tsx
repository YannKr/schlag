import { StyleSheet, Text, View } from 'react-native';

import { SIGNAL } from '@/constants/colors';
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING } from '@/constants/typography';

interface WordmarkProps {
  size?: number;
  color?: string;
  accent?: string;
  /** If true, renders on a single baseline without margin. */
  inline?: boolean;
}

/**
 * Signal wordmark — "Schlag◆" with an accent diamond. Swiss-editorial
 * typographic mark used in library header, web sidebar, and splash states.
 */
export function Wordmark({
  size = 36,
  color = SIGNAL.ink,
  accent = SIGNAL.accent,
  inline = false,
}: WordmarkProps) {
  return (
    <View style={[styles.row, inline && styles.inline]}>
      <Text
        style={[
          styles.word,
          {
            fontSize: size,
            color,
            lineHeight: size * 1.0,
          },
        ]}
      >
        Schlag
      </Text>
      <Text
        style={[
          styles.diamond,
          {
            fontSize: size * 0.9,
            color: accent,
            lineHeight: size * 1.0,
            marginLeft: size * 0.04,
          },
        ]}
      >
        ◆
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  inline: {
    alignSelf: 'flex-start',
  },
  word: {
    fontFamily: FONT_FAMILY.display,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: LETTER_SPACING.displayTighter,
  },
  diamond: {
    fontFamily: FONT_FAMILY.display,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
