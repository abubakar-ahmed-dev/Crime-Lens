/**
 * Supabase Client Configuration
 *
 * This module provides a configured Supabase client for citizen authentication.
 * Citizens use Supabase Auth, while Admin/Police users use the existing JWT system.
 */

import { createClient } from '@supabase/supabase-js';

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable');
}

/**
 * Supabase client with anon key configuration
 * Suitable for client-side and server-side operations
 */
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      // Auto-refresh tokens
      autoRefreshToken: true,
      // Detect session changes
      detectSessionChanges: true,
      // Persist session
      persistSession: true,
    },
  }
);

/**
 * Supabase admin client with service role key
 * Use this for admin operations that bypass RLS
 */
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionChanges: false,
          persistSession: false,
        },
      }
    )
  : null;

export default supabase;
