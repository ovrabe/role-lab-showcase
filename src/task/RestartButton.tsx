import { useState } from "react";

// Confirmation lives in the page: window.confirm() may be blocked inside claude.ai.
export function RestartButton({ onConfirm }: { onConfirm: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink hover:border-[var(--color-control-border)]"
      >
        Začít znovu
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label="Začít znovu" className="flex flex-wrap items-center gap-2 text-sm">
      <span>Smazat celý průběh včetně textu a začít znovu?</span>
      <button
        type="button"
        onClick={() => {
          setIsConfirming(false);
          onConfirm();
        }}
        className="rounded-full bg-action text-action-contrast px-4 py-1.5 font-medium"
      >
        Smazat a začít znovu
      </button>
      <button
        type="button"
        autoFocus
        onClick={() => setIsConfirming(false)}
        className="rounded-full border border-line bg-surface px-4 py-1.5"
      >
        Ponechat
      </button>
    </div>
  );
}
