import { createClient } from "@supabase/supabase-js"

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY

function createMockSupabase() {
  const channel = {
    on() {
      return channel
    },
    subscribe() {
      return channel
    },
  }

  return {
    from() {
      return {
        select() {
          return {
            order() {
              return {
                limit: async () => ({
                  data: [
                    {
                      status: "few",
                      created_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                }),
              }
            },
          }
        },
        insert: async () => ({ error: null }),
      }
    },
    channel() {
      return channel
    },
    removeChannel() {},
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase env vars. Using mock Supabase client for demo purposes."
  )
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createMockSupabase()
