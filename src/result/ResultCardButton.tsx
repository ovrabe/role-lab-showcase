import { useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import { cardContent, drawResultCard } from "./resultCard";
import { saveBlobFile } from "../runtime/fileSaver";

type Props = { role: RoleConfig; evaluation: StoredEvaluation; level: { level: number; label: string } };

/** Downloads the personal result card (resultCard.ts) as a PNG. */
export function ResultCardButton({ role, evaluation, level }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    setNotice(null);
    try {
      // The page's own font, so the card looks like the app.
      const blob = await drawResultCard(cardContent(role, evaluation, level), getComputedStyle(document.body).fontFamily);
      const outcome = await saveBlobFile(`role-lab-karta-${role.id}.png`, blob);
      if (outcome.kind === "declined") setNotice("Stažení bylo zrušeno.");
      if (outcome.kind === "error") setNotice(outcome.message);
    } catch {
      setNotice("Kartu se nepodařilo vytvořit.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void save()}
        disabled={isSaving}
        className="border border-line rounded-full px-[1.1rem] py-2 font-medium bg-surface hover:border-accent disabled:opacity-50"
      >
        Stáhnout kartu s výsledkem
      </button>
      {notice && (
        <p role="status" className="text-sm text-ink-muted">
          {notice}
        </p>
      )}
    </div>
  );
}
