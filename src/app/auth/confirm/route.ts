import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('code')
  redirectTo.searchParams.delete('type')

  console.log('[Auth Confirm] Request params:', { token_hash: !!token_hash, code: !!code, type, next })

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      console.log('[Auth Confirm] OTP verified successfully')
      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    } else {
      console.error('[Auth Confirm] OTP verification error:', error.message)
    }
  } else if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      console.log('[Auth Confirm] Code exchanged for session successfully')
      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    } else {
      console.error('[Auth Confirm] Code exchange error:', error.message)
    }
  }

  // If we reach here, something went wrong
  console.log('[Auth Confirm] Authentication failed, redirecting to login...')
  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'auth-failed')
  redirectTo.searchParams.set('error_description', '验证失败，请尝试重新发送链接')
  return NextResponse.redirect(redirectTo)
}
