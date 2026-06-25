import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization')

  console.log('[SUPABASE SERVER] Auth header received:', authHeader ? `${authHeader.substring(0, 25)}...` : 'None')
  console.log('[SUPABASE SERVER] URL configured:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'UNDEFINED')

  const clientOptions: any = {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {}
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {}
      },
    },
  }

  // If Authorization header is provided (e.g. from React Native app), pass it to Supabase client
  if (authHeader) {
    clientOptions.global = {
      headers: {
        Authorization: authHeader,
      },
    }
  }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    clientOptions
  )

  // Wrap client.auth.getUser to add transient error retries (e.g. ECONNRESET, fetch failed)
  const originalGetUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = async (jwt?: string) => {
    let attempt = 0
    const maxAttempts = 3
    while (true) {
      try {
        const res = await originalGetUser(jwt)
        // If it failed with a transient error (e.g. network/5xx error, but NOT 400/401/403 client errors)
        if (res.error && (!res.error.status || res.error.status >= 500) && attempt < maxAttempts - 1) {
          throw res.error
        }
        return res
      } catch (err: any) {
        attempt++
        if (attempt >= maxAttempts) {
          console.error(`[SUPABASE SERVER] getUser failed after ${maxAttempts} attempts:`, err)
          return { data: { user: null }, error: err }
        }
        const delay = attempt * 1000
        console.warn(`[SUPABASE SERVER] getUser failed (${err.message || err}). Retrying in ${delay}ms... (${attempt}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  return client
}
