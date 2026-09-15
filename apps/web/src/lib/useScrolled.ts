import { useEffect, useState } from "react";

/** True after the window has moved past a small offset. */
export function useScrolled(offset = 24, releaseOffset = offset) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const leaveAt = Math.min(releaseOffset, offset);
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((was) => (was ? y > leaveAt : y > offset));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset, releaseOffset]);

  return scrolled;
}
