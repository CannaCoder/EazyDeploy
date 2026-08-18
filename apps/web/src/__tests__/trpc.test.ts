import { describe, it, expect } from "vitest";
import { trpc } from "../lib/trpc.js";

describe("Web App tRPC Client", () => {
  it("initializes trpc react client successfully", () => {
    expect(trpc).toBeDefined();
    expect(trpc.useContext).toBeDefined();
  });
});
