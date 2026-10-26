import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteUser, updateUser } from "@/lib/auth-actions";
import { Badge, Card, PageHeader } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/buttons";
import { ChangePasswordForm, NewUserForm } from "@/components/AuthForms";

export default async function UsersPage() {
  const me = await requireUser();
  const isAdmin = me.role === "ADMIN";
  const users = isAdmin
    ? await prisma.user.findMany({ orderBy: { id: "asc" }, include: { partners: { include: { site: true } } } })
    : [];

  return (
    <>
      <PageHeader title="Users & Login" subtitle="Who can log in to this app" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isAdmin ? (
            <Card title={`Users (${users.length})`}>
              <ul className="space-y-3">
                {users.map((u) => (
                  <li key={u.id} className="rounded-lg border border-stone-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold">{u.name}</span>
                        <span className="ml-2 text-sm text-stone-500">@{u.username}</span>
                        {u.id === me.id && <span className="ml-2"><Badge tone="PRESENT">you</Badge></span>}
                      </div>
                      <div className="flex gap-1">
                        <Badge tone={u.role === "ADMIN" ? "SETTLEMENT" : undefined}>{u.role === "ADMIN" ? "Admin" : "Member"}</Badge>
                        {!u.active && <Badge tone="ABSENT">Blocked</Badge>}
                      </div>
                    </div>
                    {u.partners.length > 0 && (
                      <div className="mt-1 text-xs text-stone-500">
                        Partner: {u.partners.map((p) => `${p.name} (${p.site.name})`).join(", ")}
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-brand-700">Edit / reset password</summary>
                      <form action={updateUser} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="id" value={u.id} />
                        <label className="block">
                          <span className="label">Name</span>
                          <input name="name" defaultValue={u.name} className="input" />
                        </label>
                        <label className="block">
                          <span className="label">Access</span>
                          <select name="role" defaultValue={u.role} className="input">
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="label">New password (leave empty to keep)</span>
                          <input name="password" type="text" minLength={6} autoComplete="off" className="input" />
                        </label>
                        <label className="flex items-end gap-2 pb-2 text-sm">
                          <input type="checkbox" name="active" defaultChecked={u.active} /> Can log in
                        </label>
                        <div className="sm:col-span-2">
                          <SubmitButton>Save</SubmitButton>
                        </div>
                      </form>
                      {u.id !== me.id && (
                        <form action={deleteUser} className="mt-2">
                          <input type="hidden" name="id" value={u.id} />
                          <DeleteButton label="Delete user" confirmText={`Delete user ${u.name}? Their entries stay.`} />
                        </form>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-stone-600">
                Logged in as <b>{me.name}</b> (@{me.username}). Only an admin can add or manage users.
              </p>
            </Card>
          )}

          <Card title="Change my password">
            <ChangePasswordForm />
          </Card>
        </div>

        {isAdmin && (
          <Card title="Add user">
            <NewUserForm />
            <p className="mt-4 text-xs text-stone-500">
              Tip: after adding a user, link them to their partner on <b>Partners &amp; Funds</b> so “Paid by” is filled automatically when they enter payments.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
