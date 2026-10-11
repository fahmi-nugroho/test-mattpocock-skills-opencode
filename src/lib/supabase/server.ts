import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (public reads; authenticated admin
// session handling lands with ticket 04). No DB code yet — ticket 02.
export const supabaseServer = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
