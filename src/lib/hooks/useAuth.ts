import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()
  
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting session:', error)
      } else if (session) {
        setToken(session.access_token)
        setUser(session.user)
      }
      
      setLoading(false)
    }
    
    getInitialSession()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setToken(session.access_token)
          setUser(session.user)
        } else {
          setToken(null)
          setUser(null)
        }
        setLoading(false)
      }
    )
    
    return () => subscription.unsubscribe()
  }, [supabase.auth])
  
  return {
    token,
    user,
    loading,
    isAuthenticated: !!token
  }
}