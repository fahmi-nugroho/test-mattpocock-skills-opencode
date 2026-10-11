"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Admin login (ticket 05): single-admin email+password via Supabase Auth.
 * No signup UI is exposed — the admin account is created manually in
 * the Supabase dashboard. Browser-session guard: an existing session
 * redirects straight to /admin.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Created inside the effect (not during render) so static prerender
    // never touches env vars — same pattern as AvailabilityCalendar.
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) router.replace("/admin");
        else setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("Email atau kata sandi salah. Coba lagi.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
  }

  if (checking) {
    return (
      <main className="mx-auto max-w-sm px-4 py-20">
        <p className="text-center text-sm text-neutral-600">Memeriksa sesi…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-center text-2xl font-bold">Login Admin</h1>
      <p className="mt-1 text-center text-sm text-neutral-600">
        Khusus pemilik — kelola jadwal dan pengaturan.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Kata sandi</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {loading ? "Masuk…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
