'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { UserType } from '@/lib/supabase'

interface Profile {
  id: string
  display_name: string
  avatar_url: string
}

interface IdentityContextType {
  identity: UserType | null
  setIdentity: (identity: UserType) => void
  displayName: string
  partnerName: string
  avatarUrl: string
  partnerAvatarUrl: string
  refreshProfiles: () => Promise<void>
}

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
      console.error('Failed to fetch profiles', e)
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('werecord_identity') as UserType | null
    setIdentityState(stored)
    fetchProfiles()
    setMounted(true)
  }, [])

  const setIdentity = (id: UserType) => {
    localStorage.setItem('werecord_identity', id)
    setIdentityState(id)
  }

  const myProfile = profiles.find(p => p.id === identity)
  const partnerProfile = profiles.find(p => p.id !== identity && (p.id === 'me' || p.id === 'her'))

  const displayName = myProfile?.display_name || (identity === 'me' ? '我' : '她')
  const partnerName = partnerProfile?.display_name || (identity === 'me' ? '她' : '我')
  const avatarUrl = myProfile?.avatar_url || ''
  const partnerAvatarUrl = partnerProfile?.avatar_url || ''

  if (!mounted) return null

  return (
    <IdentityContext.Provider value={{
      identity, setIdentity, displayName, partnerName,
      avatarUrl, partnerAvatarUrl, refreshProfiles: fetchProfiles
    }}>
      {children}
    </IdentityContext.Provider>
  )
}

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used within IdentityProvider')
  return ctx
}
