import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary } from "./error-boundary";

function BrokenChild(): React.ReactNode {
  throw new Error("sensitive recruiter token leaked");
}

describe("ErrorBoundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("DEV", false);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    consoleError.mockRestore();
    vi.unstubAllEnvs();
  });

  it("renders a production-safe recovery surface without raw exception details", () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <BrokenChild />
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toContain("Workspace recovery");
    expect(container.textContent).toContain("We hit a recoverable issue");
    expect(container.textContent).toContain("Reload");
    expect(container.textContent).toContain("Go to Optimize");
    expect(container.textContent).not.toContain("sensitive recruiter token");
    expect(container.textContent).not.toContain("Developer diagnostics");
  });
});
