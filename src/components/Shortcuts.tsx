"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const visible = (el: HTMLElement) => el.offsetParent !== null || el.getClientRects().length > 0;

function focusFirst(root: ParentNode) {
  const el = [...root.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([disabled]), select, textarea, button:not([disabled])")].find(visible);
  el?.focus({ preventScroll: true });
}

/** Jump to the page's add form (the Card with id="add"), open it and focus its first field. Returns false if there is none. */
export function jumpToAdd() {
  const el = document.getElementById("add");
  if (!el) return false;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => focusFirst(el), 350);
  return true;
}

/** Event the Sidebar listens to, to close the phone menu. */
export const CLOSE_MENU = "pms:close-menu";

/** Laptop keyboard shortcuts: N new entry · / search · Esc close. (Enter saves: normal form behaviour.) */
export function Shortcuts() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

      if (e.key === "Escape") {
        if (typing) t!.blur();
        document.querySelectorAll<HTMLDetailsElement>("#add details[open], details#add[open]").forEach((d) => (d.open = false));
        window.dispatchEvent(new Event(CLOSE_MENU));
        return;
      }
      if (typing) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        if (!jumpToAdd()) router.push("/payments#add");
      } else if (e.key === "/") {
        const search = [...document.querySelectorAll<HTMLElement>("[data-search], input[type=search]")].find(visible);
        e.preventDefault();
        if (search) search.focus();
        else jumpToAdd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
