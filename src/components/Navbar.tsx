"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (isAuthPage) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">📷</span>
          <span className="font-bold text-slate-900">Camera Sync</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${pathname === "/dashboard" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Dashboard
          </Link>
          <Link
            href="/recordings"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${pathname === "/recordings" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Recordings
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}
