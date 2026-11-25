import { upstashTransaction } from "./upstash.js";
import type { GeneratedTask } from "../src/customTask/generatedTask.js";

/**
 * Generated custom tasks (docs/SPEC.md, section 14): the first content the server keeps. Stored
 * under a random id for 30 days, then Redis drops them on its own. No names, no e-mail: only
 * what the person typed in the form and the generated task.
 */
export type StoredCustomTask = {
  id: string;
  createdAt: string;
  input: { role: string; situation: string; deliverable: string; data: string | null };
  task: GeneratedTask;
  // Sharing with colleagues (docs/SPEC.md, section 14): asked for by the person, decided by the
  // author with `npm run custom-task`. Without it the task is only for whoever generated it.
  share?: { status: "pending" | "approved" | "rejected"; requestedAt: string; decidedAt?: string };
};

export type CustomTaskStore = {
  save(record: StoredCustomTask): Promise<void>;
  load(id: string): Promise<StoredCustomTask | null>;
  // Marks the task as waiting for approval and puts it on the author's list; keeps its 30 days.
  requestShare(id: string, requestedAt: string): Promise<StoredCustomTask | null>;
  // The author's switch (npm run custom-task -- off): no new tasks, existing ones still work.
  isGenerationOff(): Promise<boolean>;
  setGenerationOff(off: boolean): Promise<void>;
  // For the admin page: requests waiting for a decision, and the decision itself.
  listPending(): Promise<StoredCustomTask[]>;
  decideShare(id: string, status: "approved" | "rejected", decidedAt: string): Promise<StoredCustomTask | null>;
};

export const customTaskLifetimeSeconds = 30 * 24 * 60 * 60;
const keyOf = (id: string) => `custom-task:${id}`;
// Ids waiting for the author's decision; scripts/custom-task.mjs reads and clears it.
export const pendingShareKey = "custom-task:pending";
export const generationOffKey = "custom-task:off";

/** In this process's memory: for local development and tests only. */
export function memoryCustomTaskStore(options: { generationOff?: boolean } = {}): CustomTaskStore {
  const records = new Map<string, StoredCustomTask>();
  let generationOff = options.generationOff ?? false;
  return {
    async isGenerationOff() {
      return generationOff;
    },
    async setGenerationOff(off) {
      generationOff = off;
    },
    async listPending() {
      return [...records.values()].filter((record) => record.share?.status === "pending").map((record) => structuredClone(record));
    },
    async decideShare(id, status, decidedAt) {
      const record = records.get(id);
      if (!record) return null;
      record.share = { requestedAt: record.share?.requestedAt ?? decidedAt, status, decidedAt };
      return structuredClone(record);
    },
    async save(record) {
      records.set(record.id, structuredClone(record));
    },
    async load(id) {
      const record = records.get(id);
      return record ? structuredClone(record) : null;
    },
    async requestShare(id, requestedAt) {
      const record = records.get(id);
      if (!record) return null;
      record.share = { status: "pending", requestedAt };
      return structuredClone(record);
    },
  };
}

export function upstashCustomTaskStore(url: string, token: string): CustomTaskStore {
  return {
    async isGenerationOff() {
      const [value] = await upstashTransaction(url, token, [["GET", generationOffKey]]);
      return value !== null && value !== undefined;
    },
    async setGenerationOff(off) {
      await upstashTransaction(url, token, [off ? ["SET", generationOffKey, new Date().toISOString()] : ["DEL", generationOffKey]]);
    },
    async listPending() {
      const [ids] = await upstashTransaction(url, token, [["SMEMBERS", pendingShareKey]]);
      const list = (ids ?? []) as string[];
      if (list.length === 0) return [];
      const values = await upstashTransaction(url, token, list.map((id) => ["GET", keyOf(id)]));
      // A task that expired after 30 days leaves its id behind; it is dropped from the list here.
      const gone = list.filter((_, index) => typeof values[index] !== "string");
      if (gone.length > 0) await upstashTransaction(url, token, [["SREM", pendingShareKey, ...gone]]);
      return values.filter((value): value is string => typeof value === "string").map((value) => JSON.parse(value) as StoredCustomTask);
    },
    async decideShare(id, status, decidedAt) {
      const record = await this.load(id);
      if (!record) return null;
      record.share = { requestedAt: record.share?.requestedAt ?? decidedAt, status, decidedAt };
      // KEEPTTL: the decision does not extend the 30 days. XX: never recreate an expired task.
      const [written] = await upstashTransaction(url, token, [
        ["SET", keyOf(id), JSON.stringify(record), "KEEPTTL", "XX"],
        ["SREM", pendingShareKey, id],
      ]);
      return written === "OK" ? record : null;
    },
    async save(record) {
      await upstashTransaction(url, token, [["SET", keyOf(record.id), JSON.stringify(record), "EX", String(customTaskLifetimeSeconds)]]);
    },
    async load(id) {
      const [value] = await upstashTransaction(url, token, [["GET", keyOf(id)]]);
      return typeof value === "string" ? (JSON.parse(value) as StoredCustomTask) : null;
    },
    async requestShare(id, requestedAt) {
      const record = await this.load(id);
      if (!record) return null;
      record.share = { status: "pending", requestedAt };
      // KEEPTTL: asking to share does not make the task live longer. XX: never recreate a deleted one.
      const [written] = await upstashTransaction(url, token, [
        ["SET", keyOf(id), JSON.stringify(record), "KEEPTTL", "XX"],
        ["SADD", pendingShareKey, id],
      ]);
      // The task expired between reading and writing: nothing to share (the pending list cleans
      // the id up itself, src listPending).
      return written === "OK" ? record : null;
    },
  };
}
