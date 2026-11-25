import { useEffect, useRef, useState } from "react";
import type { Screen } from "./AppScreens";
import { roleOfTask } from "./roles/taskRoles";
import { isWebBuild } from "./buildFlags";

// The screens the person came through, so the arrows in the header work like a browser's:
// back returns where they really were (not always to the home page), forward undoes a back.
//
// On the web the trail lives in the browser's own history, so the browser's back button and
// the back gesture on a phone move between screens instead of leaving the site. Inside
// claude.ai (and in a local file) the page sits in a frame without browser arrows and
// history changes are unreliable there, so the trail is kept in the page's own state.
const maxDepth = 30;

type Trail = { past: Screen[]; current: Screen; future: Screen[] };
// What each browser history entry carries: the screen and its place in the trail.
type Entry = { roleLab: true; screen: Screen; index: number };

const home: Screen = { name: "home" };
const sameScreen = (a: Screen, b: Screen) => JSON.stringify(a) === JSON.stringify(b);
const isEntry = (value: unknown): value is Entry =>
  typeof value === "object" && value !== null && (value as Entry).roleLab === true;

// After a reload straight into a task, back should still lead to that role's tasks.
function startingScreens(first: Screen): Screen[] {
  if (first.name === "home") return [home];
  if (first.name === "task") return [home, { name: "role", roleId: roleOfTask(first.roleId) }, first];
  return [home, first];
}

export function useScreenHistory(initial: () => Screen) {
  const [trail, setTrail] = useState<Trail>(() => {
    const screens = startingScreens(initial());
    return { past: screens.slice(0, -1), current: screens[screens.length - 1], future: [] };
  });
  // Web only: how far the browser can go forward from here (entries we pushed after this one).
  const [browserForward, setBrowserForward] = useState(0);
  const [browserIndex, setBrowserIndex] = useState(0);
  // The same index for the popstate listener, which is set up once and can't read fresh state.
  const indexRef = useRef(0);

  useEffect(() => {
    if (!isWebBuild) return;
    // A reload keeps the browser's entry: continue from it instead of starting over.
    if (isEntry(window.history.state)) {
      const entry = window.history.state;
      setTrail({ past: entry.index > 0 ? [home] : [], current: entry.screen, future: [] });
      indexRef.current = entry.index;
      setBrowserIndex(entry.index);
    } else {
      // Fresh visit: write the starting screens into the browser's history, so its back
      // button walks the same way as the arrow in the header.
      const screens = startingScreens(trail.current);
      screens.forEach((screen, index) => {
        const entry: Entry = { roleLab: true, screen, index };
        if (index === 0) window.history.replaceState(entry, "");
        else window.history.pushState(entry, "");
      });
      indexRef.current = screens.length - 1;
      setBrowserIndex(screens.length - 1);
    }
    function onPopState(event: PopStateEvent) {
      if (!isEntry(event.state)) return;
      const entry = event.state;
      // Going back makes one more step forward possible, going forward one fewer.
      const step = entry.index < indexRef.current ? 1 : -1;
      indexRef.current = entry.index;
      setBrowserIndex(entry.index);
      setBrowserForward((forward) => Math.max(0, forward + step));
      setTrail({ past: entry.index > 0 ? [home] : [], current: entry.screen, future: [] });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Runs once: later screens are pushed by open().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(next: Screen) {
    if (sameScreen(trail.current, next)) return;
    if (isWebBuild) {
      const index = browserIndex + 1;
      // Without the query: ?vlastni-vyzva=<id> or ?admin belongs to the screen the link opened,
      // not to every later one (Home and back to "Vlastní výzva" showed the shared task again).
      window.history.pushState({ roleLab: true, screen: next, index } satisfies Entry, "", window.location.pathname);
      indexRef.current = index;
      setBrowserIndex(index);
      setBrowserForward(0);
      setTrail({ past: [home], current: next, future: [] });
      return;
    }
    setTrail((now) => {
      // The home page is the root: going there starts the trail again.
      if (next.name === "home") return { past: [], current: next, future: [] };
      // A new step makes the old way forward meaningless, as in a browser.
      return { past: [...now.past, now.current].slice(-maxDepth), current: next, future: [] };
    });
  }

  function back() {
    if (isWebBuild) {
      if (browserIndex > 0) window.history.back();
      return;
    }
    setTrail((now) =>
      now.past.length === 0
        ? now
        : { past: now.past.slice(0, -1), current: now.past[now.past.length - 1], future: [now.current, ...now.future] },
    );
  }

  function forward() {
    if (isWebBuild) {
      if (browserForward > 0) window.history.forward();
      return;
    }
    setTrail((now) =>
      now.future.length === 0 ? now : { past: [...now.past, now.current], current: now.future[0], future: now.future.slice(1) },
    );
  }

  return {
    screen: trail.current,
    open,
    back,
    forward,
    canGoBack: isWebBuild ? browserIndex > 0 : trail.past.length > 0,
    canGoForward: isWebBuild ? browserForward > 0 : trail.future.length > 0,
  };
}
