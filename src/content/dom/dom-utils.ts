import { POLL } from "../../shared/constants.js";
import { TimeoutError } from "../../core/errors/errors.js";

/** Bounded, backoff-based DOM helpers. Never tight-loop. */

export function queryFirst(selectors: readonly string[], root: ParentNode = document): Element | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch {
      // Ignore invalid selector, try next.
    }
  }
  return null;
}

export function queryAllMerged(selectors: readonly string[], root: ParentNode = document): Element[] {
  const out: Element[] = [];
  const seen = new Set<Element>();
  for (const sel of selectors) {
    try {
      for (const el of root.querySelectorAll(sel)) {
        if (!seen.has(el)) {
          seen.add(el);
          out.push(el);
        }
      }
    } catch {
      // ignore
    }
  }
  return out;
}

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
  predicate: () => boolean,
  opts: { timeoutMs?: number; baseIntervalMs?: number } = {}
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? POLL.defaultTimeoutMs;
  let interval = opts.baseIntervalMs ?? POLL.baseIntervalMs;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(interval);
    interval = Math.min(interval * POLL.backoffFactor, POLL.maxIntervalMs);
  }
  throw new TimeoutError("Timed out waiting for page condition.");
}

export async function waitForElement(
  selectors: readonly string[],
  opts: { timeoutMs?: number; mustBeVisible?: boolean } = {}
): Promise<Element> {
  let found: Element | null = null;
  await waitFor(
    () => {
      found = queryFirst(selectors);
      if (!found) return false;
      if (opts.mustBeVisible === true && !isVisible(found)) return false;
      return true;
    },
    opts
  );
  if (!found) throw new TimeoutError("Element not found.");
  return found;
}

/** Observe SPA/DOM changes with a bounded lifetime; caller disconnects via returned fn. */
export function observeDomOnce(
  target: Node,
  onChange: () => void,
  opts: { timeoutMs?: number } = {}
): () => void {
  const observer = new MutationObserver(() => onChange());
  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
  const timer = window.setTimeout(() => observer.disconnect(), opts.timeoutMs ?? POLL.defaultTimeoutMs);
  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}
