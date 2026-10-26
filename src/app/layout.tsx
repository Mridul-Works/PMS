import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { SiteForm } from "@/components/SiteForm";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Site Manager – Construction PMS",
  description: "Track labour, attendance, materials, expenses and budget for construction sites",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  // not logged in: only the login page gets here (middleware redirects everything else)
  if (!user)
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
      </html>
    );

  const [sites, current] = await Promise.all([
    prisma.site.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
    getCurrentSite(),
  ]);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Sidebar sites={sites} currentId={current?.id} user={{ name: user.name, role: user.role }} />
        <main className="min-h-screen lg:pl-64">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
            {current ? (
              children
            ) : (
              <div className="mx-auto max-w-2xl">
                <h1 className="text-2xl font-bold">Welcome 👋</h1>
                <p className="mb-6 mt-1 text-stone-500">Start by creating your first construction site. You can add more sites later.</p>
                <div className="card p-5">
                  <SiteForm />
                </div>
              </div>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
