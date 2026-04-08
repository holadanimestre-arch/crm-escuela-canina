import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextType {
    session: Session | null
    user: User | null
    profile: Profile | null
    assignedCityIds: string[]
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [assignedCityIds, setAssignedCityIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setLoading(false)
            }
        })

        // 2. Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)

            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setProfile(null)
                setAssignedCityIds([])
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function fetchProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) {
                console.error('Error fetching profile:', error)
            } else {
                setProfile(data)
                // Fetch assigned cities from junction table for adiestradores
                if (data.role === 'adiestrador') {
                    const { data: cityData, error: cityError } = await supabase
                        .from('adiestrador_cities')
                        .select('city_id')
                        .eq('profile_id', userId)
                    if (cityError) {
                        console.error('Error fetching adiestrador cities:', cityError)
                    } else {
                        setAssignedCityIds((cityData || []).map(c => c.city_id))
                    }
                } else {
                    setAssignedCityIds([])
                }
            }
        } catch (err) {
            console.error('Unexpected error fetching profile:', err)
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setProfile(null)
        setAssignedCityIds([])
        setSession(null)
        setUser(null)
    }

    const value = {
        session,
        user,
        profile,
        assignedCityIds,
        loading,
        signOut
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

