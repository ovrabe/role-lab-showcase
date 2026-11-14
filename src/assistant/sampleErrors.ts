// How the page reacts to each error code from sample(), per docs/RUNTIME.md.
// Branch on the code only; `message` is developer-facing English.

export type SampleErrorHandling = {
  // silent: the person stopped it. blocked: AI unusable for this view, hide the chat.
  // notice: tell the person, keep the chat. bug: our page sent something wrong.
  kind: "silent" | "blocked" | "notice" | "bug";
  message: string;
  // Whether the partially written answer (e.text) may stay on screen.
  keepPartial: boolean;
  // Whether to offer a manual "Zkusit znovu" button. The page never retries by itself.
  offerRetry: boolean;
};

const blockedMessage =
  "Tahle stránka nemá povolené volat Clauda, takže asistent nemůže odpovídat. Úkol můžeš dokončit i bez něj.";

export function handleSampleError(error: unknown): SampleErrorHandling {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "upstream_error";

  switch (code) {
    case "cancelled":
      return { kind: "silent", message: "", keepPartial: true, offerRetry: false };

    case "not_granted":
      return {
        kind: "blocked",
        message:
          "Volání Clauda nebylo povoleno, takže asistent teď nemůže odpovídat. Úkol můžeš dokončit i bez něj.",
        keepPartial: false,
        offerRetry: false,
      };
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
      return { kind: "blocked", message: blockedMessage, keepPartial: false, offerRetry: false };

    case "rate_limited":
      return {
        kind: "notice",
        message: "Claude je teď vytížený nebo jsi narazil na limit. Zkus to za chvíli.",
        keepPartial: true,
        offerRetry: true,
      };
    case "session_expired":
      return {
        kind: "notice",
        message: "Přihlášení do claude.ai vypršelo. Přihlas se znovu a obnov stránku. Rozpracovaný úkol zůstane uložený.",
        keepPartial: true,
        offerRetry: false,
      };
    case "refused":
      return {
        kind: "notice",
        message: "Claude na tuhle zprávu odmítl odpovědět. Zkus ji položit jinak.",
        keepPartial: false,
        offerRetry: false,
      };
    case "empty_completion":
      return {
        kind: "notice",
        message: "Claude nevrátil žádnou odpověď. Zkus zprávu zkrátit nebo zjednodušit.",
        keepPartial: false,
        offerRetry: false,
      };

    // Web build: the project's server is not set up (no API key on the deployment).
    case "unavailable":
      return {
        kind: "blocked",
        message: "Asistent je teď nedostupný, server ještě není nastavený. Úkol můžeš dokončit i bez něj.",
        keepPartial: false,
        offerRetry: false,
      };
    // Web build: daily limits (server/rateLimit.ts). Counters reset at midnight Czech time.
    case "limit_person":
      return {
        kind: "notice",
        message: "Tvůj dnešní limit je vyčerpaný (dva pokusy denně). Zkus to zítra, rozpracovaný úkol zůstane uložený.",
        keepPartial: false,
        offerRetry: false,
      };
    case "limit_daily":
      return {
        kind: "notice",
        message: "Role Lab dnes vyčerpal denní limit pro všechny. Zkus to zítra, rozpracovaný úkol zůstane uložený.",
        keepPartial: false,
        offerRetry: false,
      };
    // Web build: the server found the conversation too long for one call.
    case "too_large":
      return {
        kind: "notice",
        message: "Zpráva i s přiloženými podklady je na asistenta příliš dlouhá. Zkrať ji nebo přilož méně podkladů.",
        keepPartial: false,
        offerRetry: false,
      };

    case "invalid_json":
      return {
        kind: "notice",
        message: "Hodnotitel vrátil odpověď v nečekaném tvaru. Zkus hodnocení spustit znovu.",
        keepPartial: false,
        offerRetry: true,
      };

    case "invalid_request":
    case "unknown_role":
    case "prompt_too_large":
    case "transform_error":
    case "queue_overflow":
      console.error("sample() rejected because of the page:", error);
      return {
        kind: "bug",
        message: "Něco se pokazilo na straně stránky, zpráva se neodeslala. Zkus to znovu. Když to nepomůže, dej vědět autorovi.",
        keepPartial: true,
        offerRetry: true,
      };

    // upstream_error and any unknown code
    default:
      return {
        kind: "notice",
        message: "Spojení s Claudem se přerušilo. Co stihl napsat, zůstává. Můžeš to zkusit znovu.",
        keepPartial: true,
        offerRetry: true,
      };
  }
}

export function partialTextOf(error: unknown): string {
  return typeof error === "object" && error !== null && "text" in error && typeof error.text === "string"
    ? error.text
    : "";
}
