import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";

// Server-side Supabase client (public reads via anon key; the month
// availability RPC exposes day-status only, so no PII reaches clients).
// Authenticated admin session handling lands with ticket 04.
export const supabaseServer = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
