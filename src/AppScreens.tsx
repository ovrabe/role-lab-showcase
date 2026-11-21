import { sweepPositionFor } from "./components/RoleBadge";
import { HomeScreen } from "./screens/HomeScreen";
import { MethodologyScreen } from "./screens/MethodologyScreen";
import { AboutScreen } from "./screens/AboutScreen";
import { MakingOfScreen } from "./screens/MakingOfScreen";
import { CustomTaskScreen } from "./screens/CustomTaskScreen";
import { ReleaseNotesScreen } from "./screens/ReleaseNotesScreen";
import { ChallengeScreen } from "./screens/ChallengeScreen";
import { ChallengeMapScreen } from "./screens/ChallengeMapScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { TaskScreen } from "./screens/TaskScreen";
import { CalibrationScreen } from "./screens/CalibrationScreen";
import { SamplesScreen } from "./screens/SamplesScreen";
import { RoleTasksScreen } from "./screens/RoleTasksScreen";
import { TourScreen } from "./screens/TourScreen";
import { TesterScenarioScreen } from "./screens/TesterScenarioScreen";
import { roleGroups } from "./roles/roleGroups";
import { isParticipantBuild, isWebBuild } from "./buildFlags";
import { loadRoles } from "./roles/loadRoles";
import { loadChallenges } from "./challenges/loadChallenges";
import { dailyChallenge, pragueDay } from "./challenges/dailyChallenge";
import { loadLastRoleId } from "./session/sessionStorage";
import type { AiAvailability } from "./runtime/useAiAvailability";
import type { AiBackend } from "./ai/aiBackend";
import { useMemo } from "react";
import { savedCustomRole } from "./customTask/savedCustomTask";
import { isCustomTask } from "./customTask/customTaskRole";

// Plain state instead of a router: the page runs inside claude.ai and from a
// local file, where URL-based routing is unreliable.
export type Screen =
  | { name: "home" }
  | { name: "methodology" }
  | { name: "about" }
  | { name: "makingOf" }
  | { name: "customTask" }
  | { name: "profile" }
  | { name: "releaseNotes" }
  | { name: "challenge"; challengeId: string }
  | { name: "challengeMap" }
  | { name: "calibration" }
  | { name: "samples" }
  | { name: "tour" }
  | { name: "testing" }
  | { name: "role"; roleId: string }
  | { name: "task"; roleId: string };

// Role configs and challenges are bundled into the page, so loading them once at start is enough.
export const { activeRoles, errors } = loadRoles();
const { challenges } = loadChallenges();
const groups = roleGroups(activeRoles);

// The role's colour in the badge sweep, the same on the home page, the role page and in its tasks.
function sweepPositionOfRole(roleId: string): number {
  return sweepPositionFor(groups.findIndex((group) => group.role.roleId === roleId), groups.length);
}

// After a reload, go straight back to the task that was open, if that role still exists.
export function initialScreen(): Screen {
  // ?kalibrace opens the author's calibration panel (docs/SPEC.md, M3.5).
  const params = new URLSearchParams(window.location.search);
  // Neither exists in the page for people taking the task (src/buildFlags.ts).
  if (!isParticipantBuild && params.has("kalibrace")) return { name: "calibration" };
  // ?ukazky opens the sample evaluations for demos (docs/DEMO.md).
  if (!isParticipantBuild && params.has("ukazky")) return { name: "samples" };
  // ?prohlidka opens the guided tour, so a link can send someone straight to it.
  if (params.has("prohlidka")) return { name: "tour" };
  // ?testovani opens the tester scenario; it sends answers to the server, so web version only.
  if (isWebBuild && params.has("testovani")) return { name: "testing" };
  // ?jak-vznikl opens the making-of page, so it can be linked from an e-mail.
  if (isWebBuild && params.has("jak-vznikl")) return { name: "makingOf" };
  // ?vlastni-vyzva opens the custom task (docs/SPEC.md, section 14); ?vlastni-vyzva=<id> a shared one.
  if (isWebBuild && params.has("vlastni-vyzva")) return { name: "customTask" };
  const lastRoleId = loadLastRoleId();
  // A generated custom task is known only in this browser (src/customTask/savedCustomTask.ts).
  return lastRoleId && (activeRoles.some((role) => role.id === lastRoleId) || (isWebBuild && savedCustomRole(lastRoleId)))
    ? { name: "task", roleId: lastRoleId }
    : { name: "home" };
}

type ScreenContentProps = {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  aiStatus: AiAvailability;
  backend: AiBackend | null;
};

/** What the main area shows on each screen. The frame around it (header, footer) stays in App. */
export function ScreenContent({ screen, setScreen, aiStatus, backend }: ScreenContentProps) {
  const taskId = screen.name === "task" ? screen.roleId : null;
  // Read once per task: a new object on every render would look like another task to the screen.
  const selectedRole = useMemo(
    () => (taskId ? (activeRoles.find((role) => role.id === taskId) ?? (isWebBuild ? savedCustomRole(taskId) : null) ?? undefined) : undefined),
    [taskId],
  );
  // Worked out on every render, so a page left open past midnight offers the new day's challenge.
  const todaysChallenge = dailyChallenge(challenges, pragueDay(new Date()));
  const selectedChallenge = screen.name === "challenge" ? challenges.find((challenge) => challenge.id === screen.challengeId) : undefined;
  const openChallenge = (challengeId: string) => setScreen({ name: "challenge", challengeId });

  return (
    <>
      {screen.name === "home" && (
        <HomeScreen
          activeRoles={activeRoles}
          errors={errors}
          onSelectRole={(roleId) => setScreen({ name: "role", roleId })}
          onOpenMethodology={() => setScreen({ name: "methodology" })}
          onOpenTour={() => setScreen({ name: "tour" })}
          onOpenAbout={isWebBuild ? () => setScreen({ name: "about" }) : undefined}
          onOpenProfile={() => setScreen({ name: "profile" })}
          challenges={challenges}
          dailyChallenge={todaysChallenge}
          onSelectChallenge={openChallenge}
          onOpenChallengeMap={() => setScreen({ name: "challengeMap" })}
          onOpenCustomTask={isWebBuild ? () => setScreen({ name: "customTask" }) : undefined}
        />
      )}
      {screen.name === "methodology" && (
        <MethodologyScreen
          // One entry per role: the rubric belongs to the role, not to a task.
          roles={groups.map((group) => group.role)}
          onOpenCalibration={() => setScreen({ name: "calibration" })}
          onOpenSamples={() => setScreen({ name: "samples" })}
        />
      )}
      {screen.name === "profile" && <ProfileScreen roles={activeRoles} onSelectRole={(roleId) => setScreen({ name: "task", roleId })} />}
      {screen.name === "releaseNotes" && <ReleaseNotesScreen />}
      {screen.name === "role" && (
        <RoleTasksScreen
          tasks={activeRoles.filter((task) => task.roleId === screen.roleId)}
          sweepPosition={sweepPositionOfRole(screen.roleId)}
          onSelectTask={(taskId) => setScreen({ name: "task", roleId: taskId })}
        />
      )}
      {screen.name === "challenge" && selectedChallenge && (
        // key: another challenge starts with an empty answer.
        <ChallengeScreen
          key={selectedChallenge.id}
          challenge={selectedChallenge}
          aiStatus={aiStatus}
          backend={backend}
          onBack={() => setScreen({ name: "challengeMap" })}
        />
      )}
      {screen.name === "challengeMap" && (
        <ChallengeMapScreen challenges={challenges} dailyChallengeId={todaysChallenge?.id ?? null} onSelect={openChallenge} />
      )}
      {isWebBuild && screen.name === "about" && (
        <AboutScreen onOpenMethodology={() => setScreen({ name: "methodology" })} onOpenMakingOf={() => setScreen({ name: "makingOf" })} />
      )}
      {isWebBuild && screen.name === "makingOf" && <MakingOfScreen onOpenTour={() => setScreen({ name: "tour" })} />}
      {isWebBuild && screen.name === "customTask" && <CustomTaskScreen onStart={(taskId) => setScreen({ name: "task", roleId: taskId })} />}
      {!isParticipantBuild && screen.name === "calibration" && <CalibrationScreen roles={activeRoles} aiStatus={aiStatus} backend={backend} />}
      {!isParticipantBuild && screen.name === "samples" && <SamplesScreen roles={activeRoles} />}
      {isWebBuild && screen.name === "testing" && <TesterScenarioScreen />}
      {screen.name === "tour" && (
        <TourScreen
          onChooseTask={() => setScreen({ name: "home" })}
          onTryChallenge={todaysChallenge ? () => openChallenge(todaysChallenge.id) : undefined}
        />
      )}
      {screen.name === "task" && selectedRole && (
        // key: switching roles must start a fresh component with that role's own session.
        <TaskScreen
          key={selectedRole.id}
          role={selectedRole}
          roleSweepPosition={isCustomTask(selectedRole) ? 50 : sweepPositionOfRole(selectedRole.roleId)}
          aiStatus={aiStatus}
          backend={backend}
        />
      )}
    </>
  );
}
