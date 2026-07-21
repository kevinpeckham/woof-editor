// Placeholder — real tests land alongside the E2 port. This proves the
// vitest `node` project picks up files from this directory.

import { expect, test } from "vitest";

import { __VERSION_SENTINEL } from "./dom";

test("actions module loads (sentinel matches expected alpha)", () => {
	expect(__VERSION_SENTINEL).toBe("0.1.0-alpha.0");
});
