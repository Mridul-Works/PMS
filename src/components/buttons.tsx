"use client";

import { useFormStatus } from "react-dom";
import { ReactNode } from "react";

export function SubmitButton({ children, className = "btn-primary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Saving…" : children}
    </button>
  );
}

/** Small delete button that asks for confirmation. Put inside a <form action={deleteX}> with hidden id. */
export function DeleteButton({ label = "Delete", confirmText = "Delete this entry?" }: { label?: string; confirmText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}
