'use client'

/**
 * Authentication Context Provider using Supabase Auth
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { createSupabaseComponentClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Types
interface UserProfile {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'viewer'
  organization: {
    id: string
    name: string
    plan_tier: 'free' | 'pro' | 'enterprise'
  }
  is_active: boolean
  last_login: string | null
  created_at: string
}

interface AuthContextType {
  // Auth state
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  loading: boolean
  
  // Auth methods
  signUp: (email: string, password: string, name: string, organizationName?: string) => Promise<{ error?: AuthError }>
  signIn: (email: string, password: string) => Promise<{ error?: AuthError }>
  signOut: () => Promise<{ error?: AuthError }>
  resetPassword: (email: string) => Promise<{ error?: AuthError }>
  
  // Profile methods
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: Error }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  const supabase = createSupabaseComponentClient()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user || null)
        
        if (session?.user) {
          await fetchUserProfile(session.access_token)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user || null)
        
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserProfile(session.access_token)
        } else if (event === 'SIGNED_OUT') {
          setUserProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Fetch user profile from our API
  const fetchUserProfile = async (accessToken: string) => {
    try {
      const response = await fetch(`${apiUrl}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const profile = await response.json()
        setUserProfile(profile)
      } else {
        console.error('Failed to fetch user profile:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  // Sign up new user
  const signUp = async (
    email: string, 
    password: string, 
    name: string, 
    organizationName?: string
  ) => {
    try {
      const response = await fetch(`${apiUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          name,
          organization_name: organizationName
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        return { error: { message: errorData.detail || 'Signup failed' } as AuthError }
      }
      
      return {}
    } catch (error) {
      return { error: { message: 'Network error during signup' } as AuthError }
    }
  }

  // Sign in user
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        return { error }
      }
      
      // Profile will be fetched automatically by the auth state listener
      return {}
    } catch (error) {
      return { error: { message: 'Network error during signin' } as AuthError }
    }
  }

  // Sign out user
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (!error) {
        setUserProfile(null)
        router.push('/')
      }
      
      return { error }
    } catch (error) {
      return { error: { message: 'Network error during signout' } as AuthError }
    }
  }

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      return { error }
    } catch (error) {
      return { error: { message: 'Network error during password reset' } as AuthError }
    }
  }

  // Refresh user profile
  const refreshProfile = async () => {
    if (session?.access_token) {
      await fetchUserProfile(session.access_token)
    }
  }

  // Update user profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!session?.access_token) {
        return { error: new Error('Not authenticated') }
      }
      
      const response = await fetch(`${apiUrl}/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        return { error: new Error(errorData.detail || 'Update failed') }
      }
      
      const updatedProfile = await response.json()
      setUserProfile(updatedProfile)
      
      return {}
    } catch (error) {
      return { error: error as Error }
    }
  }

  const value: AuthContextType = {
    // State
    user,
    session,
    userProfile,
    loading,
    
    // Methods
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshProfile,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  redirectTo: string = '/auth/login'
) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading && !user) {
        router.push(redirectTo)
      }
    }, [user, loading, router])

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (!user) {
      return null
    }

    return <Component {...props} />
  }
}