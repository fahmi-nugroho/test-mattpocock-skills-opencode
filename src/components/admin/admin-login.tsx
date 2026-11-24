"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mapSignInError } from "@/lib/login-errors";
import { BUSINESS_NAME } from "@/lib/brand";

/**
 * Admin login (ticket 05): single-admin email+password via Supabase Auth.
 * No signup UI is exposed — the admin account is created manually in
 * the Supabase dashboard. Browser-session guard: an existing session
 * redirects straight to /admin.
 */
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    try {
      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(mapSignInError(signInError));
        setLoading(false);
        return;
      }
    } catch (networkError) {
      setError(mapSignInError(networkError));
      setLoading(false);
      return;
    }
    router.replace("/admin");
  }

  if (checking) {
    return (
      <main className="mx-auto max-w-sm bg-cream px-4 py-20 text-espresso">
        <p className="text-center text-sm text-neutral-600">Memeriksa sesi…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm bg-cream px-4 py-10 text-espresso sm:py-20">
      <p className="text-center text-sm font-medium uppercase tracking-widest text-gold">
        {BUSINESS_NAME}
      </p>
      <h1 className="mt-2 text-center font-display text-2xl font-bold">
        Login Admin
      </h1>
      <p className="mt-1 text-center text-sm text-neutral-600">
        Masuk untuk mengelola jadwal dan pengaturan.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"
      >
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <div className="block">
          <label htmlFor="admin-password" className="text-sm font-medium">
            Kata sandi
          </label>
          <div className="relative mt-1">
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 pr-24 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? "Sembunyikan kata sandi"
                  : "Tampilkan kata sandi"
              }
              className="absolute inset-y-0 right-0 min-w-11 rounded-r-lg px-3 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              {showPassword ? "Sembunyi" : "Tampilkan"}
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-full bg-espresso px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
        >
          {loading ? "Masuk…" : "Masuk"}
        </button>
      </form>
      <details className="mt-3 px-1">
        <summary className="w-fit cursor-pointer py-3 text-sm font-semibold underline underline-offset-4">
          Lupa kata sandi?
        </summary>
        <p className="text-sm leading-relaxed text-neutral-700">
          Hubungi pengelola proyek Supabase untuk memulihkan akses. Siapkan alamat email akun admin.
        </p>
      </details>
    </main>
  );
}
