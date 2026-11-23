import type { AdminOverview, FeedbackItem } from "./adminApi";

// "Zpětná vazba": the newest notes, ratings of evaluations and tester reports (the same
// entries also go to GitHub Issues). Contacts are personal data: shown only here, to the author.

const ratingNames: Record<string, string> = { yes: "Odpovídá", rather_yes: "Spíš ano", rather_no: "Spíš ne", no: "Neodpovídá" };
const when = (iso: string) => new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

function Entry({ item }: { item: FeedbackItem }) {
  if (item.kind === "evaluation") {
    return (
      <>
        <p className="text-sm text-ink-muted">Hodnocení · {item.roleId} · úroveň {item.level} · {when(item.at)}</p>
        <p className="font-semibold">{ratingNames[item.rating] ?? item.rating}{item.disagree.length > 0 ? ` · nesouhlas: ${item.disagree.join(", ")}` : ""}</p>
        {item.comment && <p className="text-sm whitespace-pre-wrap">{item.comment}</p>}
      </>
    );
  }
  if (item.kind === "tester") {
    return (
      <>
        <p className="text-sm text-ink-muted">Tester · {when(item.at)}{item.contact ? ` · ${item.contact}` : ""}</p>
        <dl className="text-sm space-y-1">
          {item.answers.map((answer, index) => (
            <div key={index}>
              <dt className="text-ink-muted">{answer.question}</dt>
              <dd className="whitespace-pre-wrap">{answer.answer}</dd>
            </div>
          ))}
        </dl>
      </>
    );
  }
  return (
    <>
      <p className="text-sm text-ink-muted">Vzkaz{item.page ? ` · ${item.page}` : ""} · {when(item.at)}{item.contact ? ` · ${item.contact}` : ""}</p>
      <p className="text-sm whitespace-pre-wrap">{item.message}</p>
    </>
  );
}

export function FeedbackTab({ data }: { data: AdminOverview }) {
  if (data.feedback.length === 0) return <p className="card text-sm text-ink-muted">Zatím žádná zpětná vazba.</p>;
  const ratings = data.feedback.filter((item) => item.kind === "evaluation");
  const counts = Object.keys(ratingNames).map((rating) => `${ratingNames[rating]} ${ratings.filter((item) => item.kind === "evaluation" && item.rating === rating).length}`);
  return (
    <div className="space-y-4">
      {ratings.length > 0 && <p className="text-sm text-ink-muted">Odpovídá hodnocení práci? {counts.join(" · ")}</p>}
      {data.feedback.map((item, index) => (
        <article key={index} className="card space-y-1">
          <Entry item={item} />
        </article>
      ))}
    </div>
  );
}
