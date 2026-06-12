import { supabase } from './supabase'

/**
 * Tras completar una sesión, comprueba si el cliente ya ha completado TODAS las
 * sesiones contratadas y, en ese caso, lo marca como 'finalizado'.
 *
 * El nº contratado se toma de evaluations.total_sessions (configurable por
 * cliente); si no está definido, se usa 8 por defecto. Se cuentan solo las
 * sesiones de adiestramiento completadas (sin contar la evaluación inicial).
 *
 * @returns true si el cliente se ha marcado como finalizado en esta llamada.
 */
export async function finalizeClientIfSessionsComplete(clientId: string | null | undefined): Promise<boolean> {
    if (!clientId) return false

    // Nº de sesiones contratadas (de la evaluación más reciente)
    const { data: evalRows } = await supabase
        .from('evaluations')
        .select('total_sessions, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
    const total = (evalRows?.[0] as any)?.total_sessions || 8

    // Sesiones de adiestramiento completadas (excluye la evaluación inicial)
    const { count } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('completed', true)
        .neq('is_evaluation', true)

    if ((count || 0) >= total) {
        // Evitar tocarlo si ya está finalizado
        const { data: cli } = await supabase
            .from('clients')
            .select('status')
            .eq('id', clientId)
            .maybeSingle()
        if ((cli as any)?.status === 'finalizado') return false

        const { error } = await supabase
            .from('clients')
            .update({ status: 'finalizado' } as any)
            .eq('id', clientId)
        if (!error) return true
    }
    return false
}
