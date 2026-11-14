export type ChatTurn = { role: "user" | "assistant"; content: string };

// sample() accepts at most 256 KiB of text; keep a margin for the platform's framing.
export const maxPromptBytes = 200_000;

const encoder = new TextEncoder();
const bytesOf = (turns: ChatTurn[]) => turns.reduce((total, turn) => total + encoder.encode(turn.content).length, 0);

export type FittedTurns = { turns: ChatTurn[]; droppedTurns: number };

/**
 * Drops the oldest conversation turns until the call fits the budget. The first
 * turn (instructions) and the last turn (the new message) are never dropped.
 * Returns null when even instructions plus the new message are too large.
 */
export function fitTurnsToBudget(turns: ChatTurn[], budget = maxPromptBytes): FittedTurns | null {
  const [instructions, ...conversation] = turns;
  let droppedTurns = 0;
  while (conversation.length > 1 && bytesOf([instructions, ...conversation]) > budget) {
    conversation.shift();
    droppedTurns++;
  }
  const fitted = [instructions, ...conversation];
  return bytesOf(fitted) > budget ? null : { turns: fitted, droppedTurns };
}
