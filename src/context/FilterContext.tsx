import React, { createContext, useContext, useState, useEffect } from 'react'
import { startOfMonth, subMonths, subDays } from 'date-fns'

export type DateRangePreset = 'today' | '7days' | '30days' | 'month' | 'prev_month' | 'custom'

interface DateRange {
    from: Date
    to: Date
}

interface FilterContextType {
    cityId: string | 'all'
    setCityId: (id: string | 'all') => void
    dateRange: DateRange
    setDateRange: (range: DateRange) => void
    datePreset: DateRangePreset
    setDatePreset: (preset: DateRangePreset) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: React.ReactNode }) {
    const [cityId, setCityId] = useState<string | 'all'>('all')
    const [datePreset, setDatePreset] = useState<DateRangePreset>('month')
    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: new Date()
    })

    // Update date range when preset changes
    useEffect(() => {
        const now = new Date()
        switch (datePreset) {
            case 'today':
                setDateRange({ from: now, to: now })
                break
            case '7days':
                setDateRange({ from: subDays(now, 7), to: now })
                break
            case '30days':
                setDateRange({ from: subDays(now, 30), to: now })
                break
            case 'month':
                setDateRange({ from: startOfMonth(now), to: now })
                break
            case 'prev_month':
                const prev = subMonths(now, 1)
                setDateRange({ from: startOfMonth(prev), to: subDays(startOfMonth(now), 1) }) // End of prev month
                break
            // custom case handled manually
        }
    }, [datePreset])

    const value = {
        cityId,
        setCityId,
        dateRange,
        setDateRange,
        datePreset,
        setDatePreset
    }

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export const useFilters = () => {
    const context = useContext(FilterContext)
    if (context === undefined) {
        throw new Error('useFilters must be used within a FilterProvider')
    }
    return context
}
