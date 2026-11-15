/**
 * Product title. The letters "Sc" are USC cardinal and the rest of the word is black.
 * Cardinal is #990000 from https://identity.usc.edu/identity/color/
 */
export function SchemeWord({ restColor = "#000000" }: { restColor?: string }) {
  return (
    <span className="scheme-word">
      <span className="scheme-sc" style={{ color: "#990000" }}>
        Sc
      </span>
      <span className="scheme-rest" style={{ color: restColor }}>
        heme
      </span>
    </span>
  );
}
