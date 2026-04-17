import { useEffect, useState } from 'react'
import { supabase, type Partner } from '@/lib/supabase'

export function usePartner() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function getPartner() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('partners')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error) throw error
        setPartner(data)
      } catch (err: any) {
        console.error('[usePartner] Error fetching partner profile:', err.message)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    getPartner()
  }, [])

  return { partner, loading, error }
}
