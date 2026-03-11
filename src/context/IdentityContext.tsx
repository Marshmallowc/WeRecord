'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { UserType } from '@/lib/supabase'
import { setIdentityCookie } from '@/app/actions'

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
  pendingUploads: any[]
  addPendingUpload: (upload: any) => void
  removePendingUpload: (id: string) => void
}

// 🚀 Module-level Prefetch: Initiates fetch as soon as the JS module is loaded,
// outrunning the React component lifecycle.
const profilesPrefetch = typeof window !== 'undefined'
  ? fetch('/api/profiles').then(res => res.json()).catch(() => ({ data: [] }))
  : Promise.resolve({ data: [] });

const IdentityContext = createContext<IdentityContextType | null>(null)

export function IdentityProvider({ children, initialIdentity = null }: { children: React.ReactNode, initialIdentity?: UserType | null }) {
  const [identity, setIdentityState] = useState<UserType | null>(initialIdentity)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [pendingUploads, setPendingUploads] = useState<any[]>([])

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
    // 1. Sync identity (Support SSR prop + fallback to localStorage for migration)
    if (!initialIdentity) {
      const stored = localStorage.getItem('werecord_identity') as UserType | null
      if (stored) {
        setIdentityState(stored)
        // 🔥 自动帮助老用户把 localStorage 迁移到 Cookie，这样下一次刷新就变成“秒开”了
        setIdentityCookie(stored).catch(e => console.error('[IdentityContext] Migration error', e))
      }
    } else {
      setIdentityState(initialIdentity)
    }

    // 2. Consume the prefetched promise (often already resolved by now)
    profilesPrefetch.then(resp => {
      if (resp.data) setProfiles(resp.data)
    })
  }, [initialIdentity])

  const setIdentity = (id: UserType) => {
    localStorage.setItem('werecord_identity', id)
    setIdentityState(id)
  }

  const addPendingUpload = (upload: any) => {
    setPendingUploads(prev => [upload, ...prev])
  }

  const removePendingUpload = (id: string) => {
    setPendingUploads(prev => prev.filter(u => u.id !== id))
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
      avatarUrl, partnerAvatarUrl, alipayCode, partnerAlipayCode, refreshProfiles: fetchProfiles,
      pendingUploads, addPendingUpload, removePendingUpload
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
