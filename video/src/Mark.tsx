import { MARK_PATH, STROKE, TILE, TILE_RADIUS, WORDMARK } from "./brand-geometry";

type MarkProps = {
  size: number;
  tile: string;
  stroke: string;
  /** 0..1: how much of the stroke is drawn, loop first. */
  draw?: number;
};

const Glyph = ({ tile, stroke, draw = 1 }: Omit<MarkProps, "size">) => (
  <>
    <rect width={TILE} height={TILE} rx={TILE_RADIUS} fill={tile} />
    <path
      d={MARK_PATH}
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - draw}
      fill="none"
      stroke={stroke}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      // A zero-length dash still paints a round cap; hide it until drawing starts.
      opacity={draw > 0 ? 1 : 0}
    />
  </>
);

export const Mark = ({ size, ...rest }: MarkProps) => (
  <svg width={size} height={size} viewBox={`0 0 ${TILE} ${TILE}`}>
    <Glyph {...rest} />
  </svg>
);

/** Mark plus "unramble" in outlined Instrument Sans: the same geometry as assets/wordmark.svg. */
export const Wordmark = ({
  height,
  text,
  textOpacity = 1,
  ...rest
}: Omit<MarkProps, "size"> & { height: number; text: string; textOpacity?: number }) => (
  <svg height={height} width={(height / TILE) * WORDMARK.width} viewBox={`0 0 ${WORDMARK.width} ${TILE}`}>
    <Glyph {...rest} />
    <path transform={`translate(${WORDMARK.textX} ${WORDMARK.baseline})`} d={WORDMARK.textPath} fill={text} opacity={textOpacity} />
  </svg>
);
