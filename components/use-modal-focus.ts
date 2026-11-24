"use client";

import { useEffect, useRef, type RefObject } from "react";

// Keep keyboard and assistive-technology users inside the active overlay.
export function useModalFocus<T extends HTMLElement>(ref: RefObject<T | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background = new Map<HTMLElement, boolean>();
    let branch: HTMLElement = panel;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch && !["SCRIPT", "STYLE"].includes(sibling.tagName) && !sibling.matches('[role="status"], [role="alert"], [data-modal-backdrop]')) {
          background.set(sibling, sibling.inert);
          sibling.setAttribute("inert", "");
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    )).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert]") && element.getClientRects().length > 0);
    const focusFirst = () => (focusable()[0] ?? panel).focus({ preventScroll: true });
    focusFirst();

    function keydown(event: KeyboardEvent) {
      if (panel?.closest("[inert]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (!first || (event.shiftKey && (document.activeElement === first || document.activeElement === panel))) {
          event.preventDefault();
          (last ?? panel)?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    function focusin(event: FocusEvent) {
      if (!panel?.closest("[inert]") && !panel!.contains(event.target as Node)) focusFirst();
    }
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      background.forEach((inert, element) => { element.inert = inert; });
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected && !opener.closest("[inert]")) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
