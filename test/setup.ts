// Mock server-only in Vitest runner
import { vi } from "vitest";

vi.mock("server-only", () => {
  return {};
});
