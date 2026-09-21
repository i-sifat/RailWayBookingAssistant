/**
 * Framework-safe input helpers. We only use public DOM APIs + real events
 * so React/Vue/Angular pick up the change. No private framework internals.
 */
import { sleep } from "./dom-utils.js";

function dispatchAll(el: HTMLElement): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
}

/** Set value via native setter so framework-controlled inputs update. */
export function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = descriptor?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  dispatchAll(input);
}

export function setSelectValue(select: HTMLSelectElement, value: string): boolean {
  const wanted = value.trim().toLowerCase();
  for (const opt of Array.from(select.options)) {
    const label = (opt.textContent ?? "").trim().toLowerCase();
    if (label === wanted || opt.value.toLowerCase() === wanted) {
      select.value = opt.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
  }
  return false;
}

export async function humanType(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  input.focus();
  // Clear via native setter (select-all + delete semantics without execCommand).
  setNativeValue(input, "");
  await sleep(60);
  // Type in small chunks to trigger autocomplete without hammering the page.
  const chunk = 3;
  for (let i = 0; i < value.length; i += chunk) {
    const part = value.slice(0, i + chunk);
    setNativeValue(input, part);
    await sleep(70);
  }
  input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  await sleep(120);
}

export function readInputValue(el: Element | null): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value ?? "";
  if (el instanceof HTMLSelectElement)
    return el.selectedOptions[0]?.textContent?.trim() ?? el.value ?? "";
  return el?.textContent?.trim() ?? "";
}
