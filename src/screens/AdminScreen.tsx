import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fetchOverview, loadToken, saveToken, type AdminOverview } from "../admin/adminApi";
import { OverviewTab } from "../admin/OverviewTab";
import { TasksTab } from "../admin/TasksTab";
import { ModelsTab } from "../admin/ModelsTab";
import { ApprovalsTab } from "../admin/ApprovalsTab";
import { FeedbackTab } from "../admin/FeedbackTab";

// The author's admin page (?admin, web version only, docs/PRODUCTION.md part 11). Without the
// token it shows only the sign-in; everything else comes from /api/admin after it.

const tabs = [
  { id: "overview", label: "Přehled" },
  { id: "tasks", label: "Úkoly" },
  { id: "models", label: "Modely a útrata" },
  { id: "approvals", label: "Ke schválení" },
  { id: "feedback", label: "Zpětná vazba" },
] as const;
type TabId = (typeof tabs)[number]["id"];
const periods = [7, 30, 90];

export function AdminScreen() {
  const [token, setToken] = useState(loadToken);
  const [typed, setTyped] = useState("");
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const result = await fetchOverview(token, days);
    setLoading(false);
    if (result.ok) {
      setData(result.value);
      setError(null);
    } else {
      setError(result.message);
      if (result.signOut) signOut();
    }
  }, [token, days]);

  useEffect(() => {
    void load();
  }, [load]);

  function signIn(event: FormEvent) {
    event.preventDefault();
    saveToken(typed.trim());
    setToken(typed.trim());
    setTyped("");
  }

  function signOut() {
    saveToken(null);
    setToken("");
    setData(null);
  }

  if (!token) {
    return (
      <form onSubmit={signIn} className="max-w-sm mx-auto card space-y-3">
        <h1 className="text-xl">Admin</h1>
        {error && <p role="alert" className="rounded-control bg-notice p-3 text-sm text-notice-ink">{error}</p>}
        <label className="block">
          <span className="block text-sm mb-1">Token</span>
          <input type="password" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} className="w-full rounded-control border border-line bg-surface p-2" />
        </label>
        <button type="submit" disabled={typed.trim().length === 0} className="rounded-full bg-action text-action-contrast px-5 py-2 font-semibold disabled:opacity-50">
          Přihlásit
        </button>
        <p className="text-xs text-ink-muted">Token zůstane jen v téhle kartě. Po zavření ho zadáš znovu.</p>
      </form>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Admin</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {periods.map((period) => (
            <button key={period} type="button" onClick={() => setDays(period)} aria-pressed={days === period} className={`rounded-full px-3 py-1 border ${days === period ? "border-accent font-semibold" : "border-line"}`}>
              {period} dní
            </button>
          ))}
          <button type="button" onClick={() => void load()} className="rounded-full px-3 py-1 border border-line">
            {loading ? "Načítám…" : "Obnovit"}
          </button>
          <button type="button" onClick={signOut} className="rounded-full px-3 py-1 border border-line">
            Odhlásit
          </button>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Části adminu">
        {tabs.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`rounded-full px-4 py-1.5 ${tab === item.id ? "bg-action text-action-contrast" : "border border-line"}`}>
            {item.label}
            {item.id === "approvals" && data && data.pendingShares.length > 0 ? ` (${data.pendingShares.length})` : ""}
          </button>
        ))}
      </nav>
      {error && <p role="alert" className="rounded-control bg-notice p-3 text-sm text-notice-ink">{error}</p>}
      {!data && !error && <p className="text-ink-muted">Načítám…</p>}
      {data && tab === "overview" && <OverviewTab data={data} />}
      {data && tab === "tasks" && <TasksTab data={data} />}
      {data && tab === "models" && <ModelsTab data={data} />}
      {data && tab === "approvals" && <ApprovalsTab data={data} token={token} onChanged={() => void load()} />}
      {data && tab === "feedback" && <FeedbackTab data={data} />}
      {data && <p className="text-xs text-ink-muted">Stav k {new Date(data.generatedAt).toLocaleString("cs-CZ")}. Data jsou anonymní denní součty, uchovávají se 90 dní.</p>}
    </section>
  );
}
