import { useState } from "react";
import type { Screen } from "./AppScreens";
import { roleOfTask } from "./roles/taskRoles";

// The screens the person came through, so the arrows in the header work like a browser's:
// back returns where they really were (not always to the home page), forward undoes a back.
// Plain state, like the screens themselves: URL routing is unreliable inside claude.ai and
// in a local file.
const maxDepth = 30;

type Trail = { past: Screen[]; current: Screen; future: Screen[] };

const sameScreen = (a: Screen, b: Screen) => JSON.stringify(a) === JSON.stringify(b);

// After a reload straight into a task, back should still lead to that role's tasks.
function startingTrail(first: Screen): Trail {
  const home: Screen = { name: "home" };
  if (first.name === "home") return { past: [], current: home, future: [] };
  if (first.name === "task") return { past: [home, { name: "role", roleId: roleOfTask(first.roleId) }], current: first, future: [] };
  return { past: [home], current: first, future: [] };
}

export function useScreenHistory(initial: () => Screen) {
  const [trail, setTrail] = useState<Trail>(() => startingTrail(initial()));

  function open(next: Screen) {
    setTrail((now) => {
      if (sameScreen(now.current, next)) return now;
      // The home page is the root: going there starts the trail again.
      if (next.name === "home") return { past: [], current: next, future: [] };
      // A new step makes the old way forward meaningless, as in a browser.
      return { past: [...now.past, now.current].slice(-maxDepth), current: next, future: [] };
    });
  }

  function back() {
    setTrail((now) =>
      now.past.length === 0
        ? now
        : { past: now.past.slice(0, -1), current: now.past[now.past.length - 1], future: [now.current, ...now.future] },
    );
  }

  function forward() {
    setTrail((now) =>
      now.future.length === 0 ? now : { past: [...now.past, now.current], current: now.future[0], future: now.future.slice(1) },
    );
  }

  return { screen: trail.current, open, back, forward, canGoBack: trail.past.length > 0, canGoForward: trail.future.length > 0 };
}
