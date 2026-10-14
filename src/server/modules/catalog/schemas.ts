import "server-only";
import { z } from "zod";

export const artistSearchQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    category: z.string().trim().optional(),
    city: z.string().trim().optional(),
    minPriceMinor: z.coerce.number().int().nonnegative().optional(),
    maxPriceMinor: z.coerce.number().int().nonnegative().optional(),
    sort: z.enum(["price_asc", "price_desc", "newest"]).default("newest"),
    cursor: z.string().trim().optional(),
    // Hard cap page size at 50 to prevent abuse
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .refine(
    (data) => {
      if (data.minPriceMinor !== undefined && data.maxPriceMinor !== undefined) {
        return data.minPriceMinor <= data.maxPriceMinor;
      }
      return true;
    },
    {
      message: "minPriceMinor must not exceed maxPriceMinor",
      path: ["minPriceMinor"],
    }
  );

export type ArtistSearchQuery = z.infer<typeof artistSearchQuerySchema>;
