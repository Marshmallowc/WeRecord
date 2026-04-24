'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { UserType } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  couple_id: string
  identity: UserType
  display_name: string
  avatar_url: string
  alipay_code?: string
}

interface IdentityContextType {
  identity: UserType | null
  setIdentity: (identity: UserType) => void
  user: any | null
  profile: Profile | null
  partnerProfile: Profile | null
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
  signOut: () => Promise<void>
}

const IdentityContext = createContext<IdentityContextType | null>(null)

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentityState] = useState<UserType | null>(null)
  const [user, setUser] = useState<any | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [pendingUploads, setPendingUploads] = useState<any[]>([])
  const supabase = createClient()
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)

  const fetchProfiles = async (currentUserId?: string) => {
    const targetId = currentUserId || user?.id
    console.log(`[IdentityContext] fetchProfiles starting for ID: ${targetId}`)
    if (!targetId) {
      console.log('[IdentityContext] fetchProfiles skipped: No targetId.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // 1. 尝试获取我的资料
      let { data: myData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single()

      // 2. 如果不存在，则是新用户，执行初始化插入
      if (!myData) {
        const { data: newData, error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            id: targetId,
            identity: 'me',
            display_name: user?.email?.split('@')[0] || '新用户'
          })
          .select('*')
          .single()
        
        if (insertError) throw insertError
        myData = newData
      }

      if (myData) {
        setIdentityState(myData.identity)

        // 3. 如果已绑定，获取当前 Couple 下的所有成员
        if (myData.couple_id) {
          const { data: groupData } = await supabase
            .from('profiles')
            .select('*')
            .eq('couple_id', myData.couple_id)
          
          if (groupData) setProfiles(groupData)
        } else {
          setProfiles([myData])
        }
      }
    } catch (e) {
      console.error('[IdentityContext] Failed to refresh profiles:', e)
    } finally {
      setIsLoading(false)
      console.log('[IdentityContext] Profile loading complete.')
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchProfiles(currentUser.id)
      } else {
        setProfiles([])
        setIdentityState(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const setIdentity = async (id: UserType) => {
    if (!user) return
    console.log(`[IdentityContext] Switching identity to: ${id}`)
    const { error } = await supabase
      .from('profiles')
      .update({ identity: id })
      .eq('id', user.id)
    
    if (error) {
      console.error('[IdentityContext] Error updating identity:', error)
    } else {
      setIdentityState(id)
      // Refresh profiles to reflect the change immediately
      await fetchProfiles(user.id)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setIdentityState(null)
    setUser(null)
    setProfiles([])
    router.push('/login')
  }

  const addPendingUpload = (upload: any) => {
    setPendingUploads(prev => [upload, ...prev])
  }

  const removePendingUpload = (id: string) => {
    setPendingUploads(prev => prev.filter(u => u.id !== id))
  }

  const myProfile = profiles.find(p => p.id === user?.id)
  const partnerProfile = profiles.find(p => p.id !== user?.id)

  const displayName = isLoading ? '...' : (myProfile?.display_name || '用户')
  const partnerName = isLoading ? '...' : (partnerProfile?.display_name || '伙伴')
  const avatarUrl = myProfile?.avatar_url || ''
  const partnerAvatarUrl = partnerProfile?.avatar_url || ''
  const alipayCode = myProfile?.alipay_code || ''
  const partnerAlipayCode = partnerProfile?.alipay_code || ''

  return (
    <IdentityContext.Provider value={{
      identity, setIdentity, user, profile: myProfile || null, partnerProfile: partnerProfile || null,
      displayName, partnerName, avatarUrl, partnerAvatarUrl, alipayCode, partnerAlipayCode,
      refreshProfiles: fetchProfiles, pendingUploads, addPendingUpload, removePendingUpload, signOut
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
