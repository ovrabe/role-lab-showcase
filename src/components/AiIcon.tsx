import { useId } from "react";

// The assistant's mark: a four-point spark in the AI colour sweep (docs/SPEC.md, section 9).
// Each icon gets its own gradient id: a shared id would point into a hidden phone tab,
// and browsers do not paint a gradient defined inside a hidden element.
export function AiIcon({ size = 16 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff7a45" />
          <stop offset="0.4" stopColor="#e5489b" />
          <stop offset="0.75" stopColor="#8a5cf6" />
          <stop offset="1" stopColor="#3d7bff" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c.6 4.6 2.4 7.4 7.4 8.6.5.1.5.7 0 .8C14.4 12.6 12.6 15.4 12 20c-.6-4.6-2.4-7.4-7.4-8.6-.5-.1-.5-.7 0-.8C9.6 9.4 11.4 6.6 12 2Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
