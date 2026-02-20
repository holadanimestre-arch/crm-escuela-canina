// Evaluation categories and items for the dog assessment form

export const EVALUATION_CATEGORIES = [
    {
        id: 'socializacion',
        name: 'Socialización',
        items: [
            'Reacción con otros perros',
            'Reacción con personas desconocidas',
            'Comportamiento en espacios públicos',
            'Tolerancia al contacto físico',
        ]
    },
    {
        id: 'obediencia',
        name: 'Obediencia Básica',
        items: [
            'Respuesta a la llamada',
            'Sentado',
            'Tumbado',
            'Quieto',
            'Paseo con correa',
        ]
    },
    {
        id: 'ansiedad',
        name: 'Ansiedad y Estrés',
        items: [
            'Ansiedad por separación',
            'Comportamiento destructivo',
            'Ladrido excesivo',
            'Inquietud general',
        ]
    },
    {
        id: 'agresividad',
        name: 'Agresividad',
        items: [
            'Agresividad hacia personas',
            'Agresividad hacia otros perros',
            'Protección de recursos (comida, juguetes)',
            'Agresividad territorial',
        ]
    },
    {
        id: 'miedos',
        name: 'Miedos y Fobias',
        items: [
            'Ruidos fuertes',
            'Objetos nuevos',
            'Situaciones nuevas',
            'Manipulación veterinaria',
        ]
    }
]

export const SCORE_LABELS: Record<number, string> = {
    1: 'Muy Mal',
    2: 'Mal',
    3: 'Regular',
    4: 'Bien',
    5: 'Excelente'
}
