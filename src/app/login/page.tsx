import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
