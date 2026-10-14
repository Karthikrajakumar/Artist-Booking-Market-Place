import "server-only";
import { z } from "zod";

export const artistSearchQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    category: z.string().trim().optional(),
    city: z.string().trim().optional(),
    minPriceMinor: z.coerce.number().int().nonnegative().optional(),
    maxPriceMinor: z.coerce.number().int().positive().optional(),
    sort: z.enum(["price_asc", "price_desc", "newest"]).default("newest"),
    cursor: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface ArtistSearchQuery {
  q?: string;
  category?: string;
  city?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  sort?: "price_asc" | "price_desc" | "newest";
  cursor?: string;
  limit?: number;
}
