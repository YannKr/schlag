import { memo } from 'react';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import type { IntervalGlyph } from '@/constants';

interface GlyphProps {
  kind: IntervalGlyph;
  size?: number;
  color?: string;
  opacity?: number;
}

/**
 * Non-color redundancy badge for interval hues. Twelve simple shapes, one
 * per interval color — same SVG path set as the design prototype.
 */
function GlyphComponent({ kind, size = 10, color = '#FFFFFF', opacity = 1 }: GlyphProps) {
  const common = { fill: color, opacity };

  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      {renderGlyph(kind, common, color, opacity)}
    </Svg>
  );
}

function renderGlyph(
  kind: IntervalGlyph,
  common: { fill: string; opacity: number },
  color: string,
  opacity: number,
) {
  switch (kind) {
    case 'circle':
      return <Circle cx="5" cy="5" r="4" {...common} />;
    case 'triangle':
      return <Polygon points="5,1 9,9 1,9" {...common} />;
    case 'square':
      return <Rect x="1.5" y="1.5" width="7" height="7" {...common} />;
    case 'diamond':
      return <Polygon points="5,1 9,5 5,9 1,5" {...common} />;
    case 'hexagon':
      return <Polygon points="5,1 9,3.5 9,6.5 5,9 1,6.5 1,3.5" {...common} />;
    case 'pentagon':
      return <Polygon points="5,1 9,4 7.5,9 2.5,9 1,4" {...common} />;
    case 'plus':
      return <Path d="M4 1h2v3h3v2H6v3H4V6H1V4h3z" {...common} />;
    case 'star':
      return (
        <Polygon
          points="5,1 6.2,4 9.5,4 6.8,6 7.8,9.2 5,7.2 2.2,9.2 3.2,6 0.5,4 3.8,4"
          {...common}
        />
      );
    case 'chevron':
      return (
        <>
          <Polygon points="1,2 3,2 6.5,5 3,8 1,8 4.5,5" {...common} />
          <Polygon points="5,2 7,2 9.5,5 7,8 5,8 7.5,5" {...common} />
        </>
      );
    case 'wave':
      return (
        <Path
          d="M1 3 Q 2.5 1, 4 3 T 7 3 T 10 3 M1 7 Q 2.5 5, 4 7 T 7 7 T 10 7"
          stroke={color}
          strokeWidth={1.4}
          fill="none"
          opacity={opacity}
        />
      );
    case 'line':
      return <Rect x="1" y="4" width="8" height="2" {...common} />;
    case 'dot':
      return <Circle cx="5" cy="5" r="1.8" {...common} />;
    default:
      return null;
  }
}

export const Glyph = memo(GlyphComponent);
