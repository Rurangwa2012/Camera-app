import Link from "next/link";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-6 text-6xl">📷</div>
      <h1 className="mb-3 text-3xl font-bold text-slate-900">
        My Phone Camera Sync
      </h1>
      <p className="mb-8 max-w-md text-slate-600">
        Use one phone as a camera and another as a viewer. Secure, transparent,
        and always under your control.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/login">
          <Button size="lg" className="w-full sm:w-auto">
            Log In
          </Button>
        </Link>
        <Link href="/signup">
          <Button variant="secondary" size="lg" className="w-full sm:w-auto">
            Sign Up
          </Button>
        </Link>
      </div>
      <div className="mt-12 grid max-w-lg gap-4 text-left text-sm text-slate-600">
        <div className="flex gap-3 rounded-xl bg-white p-4 shadow-sm">
          <span>🔒</span>
          <div>
            <strong className="text-slate-800">No hidden access</strong>
            <p>Camera starts only when you tap &quot;Start Camera&quot;</p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-white p-4 shadow-sm">
          <span>🔴</span>
          <div>
            <strong className="text-slate-800">Visible recording</strong>
            <p>Recording is OFF by default with a clear red REC indicator</p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-white p-4 shadow-sm">
          <span>📱</span>
          <div>
            <strong className="text-slate-800">Your devices only</strong>
            <p>Pair your phones before streaming — only you can access them</p>
          </div>
        </div>
      </div>
    </div>
  );
}
