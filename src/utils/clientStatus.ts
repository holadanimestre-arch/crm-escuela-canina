export type ClientStatus = 'evaluado' | 'activo' | 'finalizado'

const LABELS: Record<ClientStatus, string> = {
    evaluado: 'Pdte. Evaluación',
    activo: 'Activo',
    finalizado: 'Finalizado',
}

export function clientStatusLabel(status: string | null | undefined): string {
    if (!status) return '-'
    return LABELS[status as ClientStatus] ?? status
}
