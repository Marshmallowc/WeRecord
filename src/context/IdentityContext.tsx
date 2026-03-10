'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { UserType } from '@/lib/supabase'

interface Profile {
  id: string
  display_name: string
  avatar_url: string
  alipay_code?: string
}

interface IdentityContextType {
  identity: UserType | null
  setIdentity: (identity: UserType) => void
  displayName: string
  partnerName: string
  avatarUrl: string
  partnerAvatarUrl: string
  alipayCode: string
  partnerAlipayCode: string
  refreshProfiles: () => Promise<void>
}

// 🚀 Module-level Prefetch: Initiates fetch as soon as the JS module is loaded,
// outrunning the React component lifecycle.
const profilesPrefetch = typeof window !== 'undefined'
  ? fetch('/api/profiles').then(res => res.json()).catch(() => ({ data: [] }))
  : Promise.resolve({ data: [] });

const IdentityContext = createContext<IdentityContextType | null>(null)

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentityState] = useState<UserType | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [mounted, setMounted] = useState(false)

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles')
      const { data } = await res.json()
      if (data) setProfiles(data)
    } catch (e) {
      console.error('Failed to refresh profiles', e)
    }
  }

  useEffect(() => {
    // 1. Sync identity immediately
    const stored = localStorage.getItem('werecord_identity') as UserType | null
    setIdentityState(stored)

    // 2. Consume the prefetched promise (often already resolved by now)
    profilesPrefetch.then(resp => {
      if (resp.data) setProfiles(resp.data)
    })

    setMounted(true)
  }, [])

  const setIdentity = (id: UserType) => {
    localStorage.setItem('werecord_identity', id)
    setIdentityState(id)
  }

  const myProfile = profiles.find(p => p.id === identity)
  const partnerProfile = profiles.find(p => p.id !== identity && (p.id === 'me' || p.id === 'her'))

  // Safe defaults while loading or when data is missing
  const displayName = myProfile?.display_name || (identity === 'me' ? '我' : (identity === 'her' ? '她' : '用户'))
  const partnerName = partnerProfile?.display_name || (identity === 'me' ? '她' : (identity === 'her' ? '我' : 'Ta'))
  const avatarUrl = myProfile?.avatar_url || ''
  const partnerAvatarUrl = partnerProfile?.avatar_url || ''
  const alipayCode = myProfile?.alipay_code || ''
  const partnerAlipayCode = partnerProfile?.alipay_code || ''

  return (
    <IdentityContext.Provider value={{
      identity, setIdentity, displayName, partnerName,
      avatarUrl, partnerAvatarUrl, alipayCode, partnerAlipayCode, refreshProfiles: fetchProfiles
    }}>
      {/* 
          Removing the blocking 'if (!mounted) return null' 
          allows the app to show a meaningful state (at least the layout) 
          immediately, providing a faster "First Meaningful Paint".
      */}
      {children}
    </IdentityContext.Provider>
  )
}

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used within IdentityProvider')
  return ctx
}
