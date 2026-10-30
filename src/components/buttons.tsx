"use client";

import { useFormStatus } from "react-dom";
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function SubmitButton({ children, className = "btn-primary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Saving…" : children}
    </button>
  );
}

const UNDO_MS = 5000;

/**
 * Delete with Undo. Put inside a <form action={deleteX}> with a hidden id.
 * The row hides straight away and a "Deleted · Undo" bar shows for a few seconds;
 * the delete is only sent to the server when that time runs out.
 */
export function DeleteButton({ label = "Delete" }: { label?: string; confirmText?: string }) {
  const { pending } = useFormStatus();
  const btn = useRef<HTMLButtonElement>(null);
  const row = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const undo = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (row.current) row.current.style.display = "";
    setWaiting(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="submit"
        disabled={pending || waiting}
        aria-label={label === "✕" ? "Delete" : undefined}
        onClick={(e) => {
          if (timer.current) return; // already counting down; let the real submit through
          e.preventDefault();
          const b = btn.current!;
          row.current = b.closest<HTMLElement>("tr, li, [data-row]");
          if (row.current) row.current.style.display = "none";
          setWaiting(true);
          timer.current = setTimeout(() => {
            setWaiting(false);
            b.form?.requestSubmit(b);
          }, UNDO_MS);
        }}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 sm:min-h-0 sm:min-w-0 sm:py-1"
      >
        {pending ? "…" : label}
      </button>
      {waiting &&
        createPortal(
          <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
            <div className="flex items-center gap-4 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
              Deleted
              <button type="button" onClick={undo} className="min-h-11 rounded px-3 font-semibold text-brand-100 underline sm:min-h-0">
                Undo
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
