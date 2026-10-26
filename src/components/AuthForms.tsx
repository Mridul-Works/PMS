"use client";

import { useActionState } from "react";
import { changeMyPassword, createUser, login, setupAdmin, type FormState } from "@/lib/auth-actions";

function Message({ state }: { state: FormState }) {
  if (state?.error) return <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{state.error}</div>;
  if (state?.ok) return <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{state.ok}</div>;
  return null;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input {...rest} className="input" />
    </label>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Input label="Username" name="username" required autoComplete="username" autoCapitalize="none" defaultValue={state?.username} autoFocus={!state?.username} />
      <Input label="Password" name="password" type="password" required autoComplete="current-password" autoFocus={!!state?.username} />
      <Message state={state} />
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAdmin, undefined);
  return (
    <form action={action} className="space-y-4">
      <Input label="Your name" name="name" required autoFocus placeholder="e.g. Mridul" />
      <Input label="Username" name="username" required autoCapitalize="none" placeholder="e.g. mridul" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Password" name="password" type="password" required minLength={6} autoComplete="new-password" />
        <Input label="Confirm password" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      <Message state={state} />
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Creating…" : "Create admin account"}
      </button>
    </form>
  );
}

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <form action={action} className="space-y-3" key={state?.ok}>
      <Input label="Name *" name="name" required placeholder="e.g. Vinay" />
      <Input label="Username *" name="username" required autoCapitalize="none" placeholder="e.g. vinay" />
      <Input label="Password * (min 6)" name="password" type="text" required minLength={6} autoComplete="off" />
      <label className="block">
        <span className="label">Access</span>
        <select name="role" className="input" defaultValue="MEMBER">
          <option value="MEMBER">Member – can add & view entries</option>
          <option value="ADMIN">Admin – also manages users, partners & sites</option>
        </select>
      </label>
      <Message state={state} />
      <button disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Add user"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeMyPassword, undefined);
  return (
    <form action={action} className="space-y-3" key={state?.ok}>
      <Input label="Current password" name="current" type="password" required autoComplete="current-password" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="New password" name="password" type="password" required minLength={6} autoComplete="new-password" />
        <Input label="Confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      <Message state={state} />
      <button disabled={pending} className="btn-ghost">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
