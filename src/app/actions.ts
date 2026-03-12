'use server'

import { cookies } from 'next/headers'
import type { UserType } from '@/lib/supabase/types'

export async function setIdentityCookie(id: UserType) {
  const cookieStore = await cookies()
  cookieStore.set('werecord_identity', id, { maxAge: 31536000, path: '/' })
}
