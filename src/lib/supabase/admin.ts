import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client. It bypasses RLS and can perform admin auth
// operations (e.g. deleting a user), so it must NEVER reach the browser:
// `import 'server-only'` makes including this module in a client bundle a build
// error. Loaded lazily (dynamic import from the deleteAccount action) so this
// top-level key check only runs server-side at call time, never during the
// client build or the jsdom test suite.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}
if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (server-only); account deletion cannot run without it');
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
