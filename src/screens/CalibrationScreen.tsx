import { useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import type { AiAvailability } from "../runtime/useAiAvailability";
import type { AiBackend } from "../ai/aiBackend";
import { CalibrationPanel } from "../calibration/CalibrationPanel";

type CalibrationScreenProps = {
  roles: RoleConfig[];
  aiStatus: AiAvailability;
  backend: AiBackend | null;
};

// Hidden screen for the author: reached from the bottom of "Jak hodnotíme" or with ?kalibrace.
export function CalibrationScreen({ roles, aiStatus, backend }: CalibrationScreenProps) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const role = roles.find((candidate) => candidate.id === roleId);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="mb-2">Kalibrace hodnotitele</h1>
        <p className="text-ink-muted max-w-2xl">
          Pro autora. Ověřuje, že hodnotitel řadí slabou, střední a silnou práci správně a že se jeho hodnocení mezi
          opakováními moc neliší.
        </p>
      </div>
      {roles.length > 1 && (
        <label className="block">
          <span className="font-semibold mr-2">Role</span>
          <select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="rl-select">
            {roles.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* key: switching roles starts a fresh panel with that role's own results. */}
      {role && <CalibrationPanel key={role.id} role={role} aiStatus={aiStatus} backend={backend} />}
    </section>
  );
}
