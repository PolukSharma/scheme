import type { Ref } from "react";
import { SchemeWord } from "@/components/scheme-word";

export function ScreenHeader({
  title,
  headingRef,
}: {
  title?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className="mast">
      <h1 tabIndex={-1} ref={headingRef}>
        <SchemeWord />
        {title ? <span className="screen-name"> {title}</span> : null}
      </h1>
    </header>
  );
}
