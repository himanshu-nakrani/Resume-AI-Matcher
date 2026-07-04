import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useCopy } from "./use-copy";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

let latestCopy: ReturnType<typeof useCopy> | null = null;

function HookHarness(): null {
  latestCopy = useCopy();
  return null;
}

function setClipboardApi(
  writeText: ((text: string) => Promise<void>) | undefined,
) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

describe("useCopy", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestCopy = null;
    toastMock.mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
    vi.restoreAllMocks();
  });

  async function renderHook(): Promise<ReturnType<typeof useCopy>> {
    await act(async () => {
      root.render(<HookHarness />);
    });

    if (!latestCopy) {
      throw new Error("useCopy did not render.");
    }

    return latestCopy;
  }

  it("uses the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboardApi(writeText);

    const copyHook = await renderHook();
    await act(async () => {
      await copyHook.copy("hello", "Copied summary");
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Copied summary",
      duration: 2000,
    });
  });

  it("falls back to execCommand when clipboard access is unavailable", async () => {
    setClipboardApi(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    const copyHook = await renderHook();
    await act(async () => {
      await copyHook.copy("fallback copy");
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Copied to clipboard",
      duration: 2000,
    });
  });

  it("shows a user-facing error when copying is blocked", async () => {
    setClipboardApi(undefined);
    const execCommand = vi.fn().mockReturnValue(false);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    const copyHook = await renderHook();
    await act(async () => {
      await copyHook.copy("blocked copy");
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Failed to copy",
      description: "Your browser blocked clipboard access.",
    });
  });
});
