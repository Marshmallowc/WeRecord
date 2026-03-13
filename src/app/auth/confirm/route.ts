import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'
  const device = searchParams.get('device') // Check if it's from another device

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('code')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('device')

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // If the verification came from a different device (e.g., computer while phone is waiting)
      // we redirect to a plain success page or login with status to avoid session hijacking on computer
      if (device === 'other') {
        redirectTo.pathname = '/login'
        redirectTo.searchParams.set('status', 'verified')
        return NextResponse.redirect(redirectTo)
      }

      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    }
  } else if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (device === 'other') {
        redirectTo.pathname = '/login'
        redirectTo.searchParams.set('status', 'verified')
        return NextResponse.redirect(redirectTo)
      }
      
      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    }
  }

  // Fallback for failure
  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'auth-failed')
  redirectTo.searchParams.set('error_description', '验证失败，请尝试重新发送链接')
  return NextResponse.redirect(redirectTo)
}
