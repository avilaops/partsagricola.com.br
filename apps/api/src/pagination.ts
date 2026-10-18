import { z } from "zod";
export type Cursor = { createdAt: string; id: string };
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
export function decodeCursor(value: string): Cursor {
  try {
    return z
      .object({ createdAt: z.string().datetime(), id: z.string().uuid() })
      .parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}
export const cursorSchema = z
  .string()
  .optional()
  .refine((value) => {
    if (!value) return true;
    try {
      decodeCursor(value);
      return true;
    } catch {
      return false;
    }
  }, "cursor inválido");
