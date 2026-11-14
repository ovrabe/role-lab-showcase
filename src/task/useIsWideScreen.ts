import { useEffect, useState } from "react";

// Matches Tailwind's lg breakpoint, where the task screen switches to two columns.
const wideScreenQuery = "(min-width: 1024px)";

export function useIsWideScreen(): boolean {
  const [isWide, setIsWide] = useState(() => window.matchMedia(wideScreenQuery).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(wideScreenQuery);
    const handleChange = () => setIsWide(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isWide;
}
