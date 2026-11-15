import { useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import { SampleViewer } from "../result/SampleViewer";

// For the author (docs/DEMO.md): real sample evaluations to open instantly in a demo,
// without submitting anything and without spending usage. Reached from the bottom of
// "Jak hodnotíme" or with ?ukazky, because samples reveal the data traps.
export function SamplesScreen({ roles }: { roles: RoleConfig[] }) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const role = roles.find((candidate) => candidate.id === roleId);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="mb-2">Ukázková hodnocení</h1>
        <p className="text-ink-muted max-w-2xl">
          Pro autora a předvedení. Skutečná hodnocení vymyšlených běhů. Obsahují rozbor záludností v datech, proto je
          neukazuj nikomu, kdo bude úkol teprve řešit.
        </p>
      </div>
      {roles.length > 1 && (
        <label className="block">
          <span className="font-semibold mr-2">Role</span>
          <select
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            className="rl-select"
          >
            {roles.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title} · {candidate.taskTitle}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* key: switching roles starts a fresh viewer with that role's own samples. */}
      {role && <SampleViewer key={role.id} role={role} />}
    </section>
  );
}
