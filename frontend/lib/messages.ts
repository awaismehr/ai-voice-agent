import type { UIMessage } from "ai";

/** A row as returned by `GET /api/conversation/:id`. */
export interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

/** Joins a message's text parts into plain text (v7 messages carry `parts`, not `content`). */
export function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export function fromStored(rows: StoredMessage[]): UIMessage[] {
  return rows.map((row) => ({
    id: `stored-${row.id}`,
    role: row.role,
    parts: [{ type: "text", text: row.content }],
  }));
}
