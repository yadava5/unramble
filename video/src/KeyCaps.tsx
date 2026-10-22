import { Easing, interpolate } from "remotion";
import { color, font } from "./theme";
import { T } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const press = (frame: number, down: number) =>
  interpolate(frame, [down, down + 3, T.keysUp, T.keysUp + 5], [0, 1, 1, 0], clamp);

const Key = ({ size, width, depth, children }: { size: number; width: number; depth: number; children: React.ReactNode }) => {
  const travel = size * 0.07;
  return (
    <div style={{ width, height: size + travel, position: "relative" }}>
      {/* key wall */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: size, borderRadius: size * 0.2, background: "#8C8C8C" }} />
      {/* key face */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: depth * travel,
          height: size,
          borderRadius: size * 0.2,
          background: depth > 0.5 ? "#E6E6E6" : color.paper,
          boxShadow: "inset 0 -2px 0 rgba(0, 0, 0, 0.08)",
          color: color.canvas,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** The ⌃ G chord, shown large enough that a muted viewer sees what was pressed. */
export const KeyCaps = ({ frame, size }: { frame: number; size: number }) => {
  const appear = interpolate(frame, [T.keysIn, T.keysIn + 10], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const leave = interpolate(frame, [T.keysOut, T.keysOut + 10], [0, 1], clamp);
  const opacity = appear * (1 - leave);
  if (opacity === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: size * 0.16,
        opacity,
        transform: `translateY(${(1 - appear) * size * 0.25 + leave * size * 0.1}px)`,
        filter: "drop-shadow(0 18px 40px rgba(0, 0, 0, 0.8))",
      }}
    >
      <Key size={size} width={size * 1.55} depth={press(frame, T.ctrlDown)}>
        <span style={{ position: "absolute", right: size * 0.16, top: size * 0.04, fontFamily: font.mono, fontSize: size * 0.42, fontWeight: 500 }}>⌃</span>
        <span style={{ position: "absolute", left: size * 0.16, bottom: size * 0.12, fontFamily: font.sans, fontSize: size * 0.2, fontWeight: 500 }}>control</span>
      </Key>
      <Key size={size} width={size} depth={press(frame, T.gDown)}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.sans,
            fontSize: size * 0.46,
            fontWeight: 600,
          }}
        >
          G
        </span>
      </Key>
    </div>
  );
};
