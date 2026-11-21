import { useEffect, useState } from "react";
import { fetchCustomTaskStatus, type StatusOutcome } from "./customTaskApi";
import { GeneratedPreview } from "./GeneratedPreview";
import { saveCustomTask } from "./savedCustomTask";
import { customTaskConfigId } from "./customTaskRole";

// A link ?vlastni-vyzva=<id> opened in another browser than the one that generated the task.

const waitingText: Record<string, string> = {
  none: "Tenhle úkol zatím není sdílený.",
  pending: "Úkol čeká na schválení autorem aplikace. Zkus odkaz otevřít později.",
  rejected: "Sdílení tohohle úkolu nebylo schváleno.",
};

export function SharedTaskView({ id, onStart }: { id: string; onStart: (taskId: string) => void }) {
  const [outcome, setOutcome] = useState<StatusOutcome | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCustomTaskStatus(id).then((result) => active && setOutcome(result));
    return () => {
      active = false;
    };
  }, [id]);

  if (outcome?.kind === "ok" && outcome.status === "approved" && outcome.task) {
    const task = outcome.task;
    return (
      <GeneratedPreview
        task={task}
        onStart={() => {
          // Kept in this browser like an own task, so a reload goes back to it.
          saveCustomTask({ id, task });
          onStart(customTaskConfigId(id));
        }}
      />
    );
  }
  return (
    <p role="status" className="card">
      {outcome === null
        ? "Načítám úkol…"
        : outcome.kind === "missing"
          ? "Úkol neexistuje nebo už vypršel. Vygenerované úkoly se mažou po 30 dnech."
          : outcome.kind === "error"
            ? outcome.message
            : waitingText[outcome.status] ?? waitingText.pending}
    </p>
  );
}
