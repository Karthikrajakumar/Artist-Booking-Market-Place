import "server-only";
import { z } from "zod";

export const shortlistQuerySchema = z
  .object({
    cursor: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
