import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm, SetupForm } from "@/components/AuthForms";

export const metadata = { title: "Log in – Site Manager" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  const firstRun = (await prisma.user.count()) === 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="text-4xl">🏗️</div>
          <h1 className="mt-2 text-2xl font-bold">Site Manager</h1>
          <p className="text-sm text-stone-400">Construction project tracker</p>
        </div>
        <div className="card p-6">
          {firstRun ? (
            <>
              <h2 className="text-lg font-semibold">Create the admin account</h2>
              <p className="mb-5 mt-1 text-sm text-stone-500">
                First time here. This account can add other users (e.g. your partners) later.
              </p>
              <SetupForm />
            </>
          ) : (
            <>
              <h2 className="mb-5 text-lg font-semibold">Log in</h2>
              <LoginForm next={next ?? "/"} />
              <p className="mt-4 text-center text-xs text-stone-500">Forgot password? Ask your admin to reset it.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
