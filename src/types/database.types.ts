export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    email: string | null
                    full_name: string | null
                    role: 'admin' | 'comercial' | 'adiestrador'
                    assigned_city_id: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    email?: string | null
                    full_name?: string | null
                    role?: 'admin' | 'comercial' | 'adiestrador'
                    assigned_city_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string | null
                    full_name?: string | null
                    role?: 'admin' | 'comercial' | 'adiestrador'
                    assigned_city_id?: string | null
                    created_at?: string
                }
            }
            cities: {
                Row: {
                    id: string
                    name: string
                    active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    active?: boolean
                    created_at?: string
                }
            }
            leads: {
                Row: {
                    id: string
                    name: string
                    phone: string | null
                    email: string | null
                    city_id: string | null
                    status: 'nuevo' | 'intentando_contactar_lupe' | 'intentando_contactar_aroha' | 'intentando_contactar_pablo' | 'tiene_que_hablarlo_lupe' | 'tiene_que_hablarlo_aroha' | 'tiene_que_hablarlo_pablo' | 'evaluacion_aceptada_lupe' | 'evaluacion_aceptada_aroha' | 'evaluacion_aceptada_pablo' | 'evaluacion_denegada_lupe' | 'evaluacion_denegada_aroha' | 'evaluacion_denegada_pablo' | 'perdido'
                    comercial_id: string | null
                    notes: string | null
                    source: string | null
                    external_source_id: string | null
                    created_at: string
                    evaluation_accepted_at: string | null
                    first_contact_at: string | null
                    effective_contact_at: string | null
                    contact_attempts: number | null
                    send_whatsapp: boolean | null
                }
                Insert: {
                    id?: string
                    name: string
                    phone?: string | null
                    email?: string | null
                    city_id?: string | null
                    status?: 'nuevo' | 'intentando_contactar_lupe' | 'intentando_contactar_aroha' | 'intentando_contactar_pablo' | 'tiene_que_hablarlo_lupe' | 'tiene_que_hablarlo_aroha' | 'tiene_que_hablarlo_pablo' | 'evaluacion_aceptada_lupe' | 'evaluacion_aceptada_aroha' | 'evaluacion_aceptada_pablo' | 'evaluacion_denegada_lupe' | 'evaluacion_denegada_aroha' | 'evaluacion_denegada_pablo' | 'perdido'
                    comercial_id?: string | null
                    notes?: string | null
                    source?: string | null
                    external_source_id?: string | null
                    created_at?: string
                    evaluation_accepted_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    phone?: string | null
                    email?: string | null
                    city_id?: string | null
                    status?: 'nuevo' | 'intentando_contactar_lupe' | 'intentando_contactar_aroha' | 'intentando_contactar_pablo' | 'tiene_que_hablarlo_lupe' | 'tiene_que_hablarlo_aroha' | 'tiene_que_hablarlo_pablo' | 'evaluacion_aceptada_lupe' | 'evaluacion_aceptada_aroha' | 'evaluacion_aceptada_pablo' | 'evaluacion_denegada_lupe' | 'evaluacion_denegada_aroha' | 'evaluacion_denegada_pablo' | 'perdido'
                    comercial_id?: string | null
                    notes?: string | null
                    source?: string | null
                    external_source_id?: string | null
                    created_at?: string
                    evaluation_accepted_at?: string | null
                }
            }
            clients: {
                Row: {
                    id: string
                    lead_id: string | null
                    name: string
                    phone: string | null
                    email: string | null
                    address: string | null
                    city_id: string
                    dog_breed: string | null
                    dog_age: string | null
                    status: 'evaluado' | 'activo' | 'finalizado'
                    created_at: string
                    evaluation_done_at: string | null
                    call_reason: string | null
                    observations: string | null
                    converted_by: string | null
                }
                Insert: {
                    id?: string
                    lead_id?: string | null
                    name: string
                    phone?: string | null
                    email?: string | null
                    address?: string | null
                    city_id: string
                    dog_breed?: string | null
                    dog_age?: string | null
                    status?: 'evaluado' | 'activo' | 'finalizado'
                    created_at?: string
                    evaluation_done_at?: string | null
                    call_reason?: string | null
                    observations?: string | null
                    converted_by?: string | null
                }
            }
            evaluations: {
                Row: {
                    id: string
                    client_id: string
                    city_id: string
                    adiestrador_id: string | null
                    result: 'aprobada' | 'rechazada'
                    comments: string | null
                    scheduled_date: string | null
                    total_sessions: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    client_id: string
                    city_id: string
                    adiestrador_id?: string | null
                    result: 'aprobada' | 'rechazada'
                    comments?: string | null
                    scheduled_date?: string | null
                    total_sessions?: number | null
                    created_at?: string
                }
            }
            evaluation_results: {
                Row: {
                    id: string
                    evaluation_id: string
                    category: string
                    item: string
                    score: number | null
                    observations: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    evaluation_id: string
                    category: string
                    item: string
                    score?: number | null
                    observations?: string | null
                    created_at?: string
                }
            }
            sessions: {
                Row: {
                    id: string
                    client_id: string
                    session_number: number
                    date: string
                    completed: boolean
                    comments: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    client_id: string
                    session_number: number
                    date: string
                    completed?: boolean
                    comments?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    client_id?: string
                    session_number?: number
                    date?: string
                    completed?: boolean
                    comments?: string | null
                    created_at?: string
                }
            }
            payments: {
                Row: {
                    id: string
                    client_id: string
                    amount: number
                    payment_number: number
                    received: boolean
                    received_at: string | null
                    method: 'efectivo' | 'transferencia' | null
                    notes: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    client_id: string
                    amount: number
                    payment_number: number
                    received?: boolean
                    received_at?: string | null
                    method?: 'efectivo' | 'transferencia' | 'tarjeta' | null
                    notes?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    client_id?: string
                    amount?: number
                    payment_number?: number
                    received?: boolean
                    received_at?: string | null
                    method?: 'efectivo' | 'transferencia' | 'tarjeta' | null
                    notes?: string | null
                    created_at?: string
                }
            }
            invoices: {
                Row: {
                    id: string
                    invoice_number: number
                    client_id: string
                    payment_id: string | null
                    amount: number
                    date: string
                    pdf_url: string | null
                    status: 'emitida' | 'anulada'
                    created_at: string
                }
                Insert: {
                    id?: string
                    invoice_number?: number
                    client_id: string
                    payment_id?: string | null
                    amount: number
                    date?: string
                    pdf_url?: string | null
                    status?: 'emitida' | 'anulada'
                    created_at?: string
                }
                Update: {
                    id?: string
                    invoice_number?: number
                    client_id?: string
                    payment_id?: string | null
                    amount?: number
                    date?: string
                    pdf_url?: string | null
                    status?: 'emitida' | 'anulada'
                    created_at?: string
                }
            }
            dog_breeds: {
                Row: {
                    id: string
                    name: string
                    active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    active?: boolean
                    created_at?: string
                }
            }
            call_reasons: {
                Row: {
                    id: string
                    name: string
                    active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    active?: boolean
                    created_at?: string
                }
            }
        }
    }
}
