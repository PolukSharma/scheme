/**
 * The only visual rendering of the product name.
 * "Sc" is USC cardinal. "heme" is near-black, or white when `restColor` is set for a dark background.
 */
export function Wordmark({ restColor = "#1A1A1A" }: { restColor?: string }) {
  return (
    <span className="wordmark" aria-label="Scheme">
      <span style={{ color: "#990000" }}>Sc</span>
      <span style={{ color: restColor }}>heme</span>
    </span>
  );
}
