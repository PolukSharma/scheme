/**
 * Product title. The letters "Sc" are cardinal red and the rest is a different color.
 */
export function SchemeWord({ restColor = "#1a1a1a" }: { restColor?: string }) {
  return (
    <span className="scheme-word">
      <span style={{ color: "#990000" }}>Sc</span>
      <span style={{ color: restColor }}>heme</span>
    </span>
  );
}
