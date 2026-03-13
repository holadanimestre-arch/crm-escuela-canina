import { useState, useEffect } from 'react';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { supabase } from '../lib/supabase';
import { useJsApiLoader } from '@react-google-maps/api';

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];

interface Adiestrador {
    id: string;
    full_name: string;
    coverage_polygon_green: { lat: number, lng: number }[] | null;
    coverage_polygon_yellow: { lat: number, lng: number }[] | null;
    base_lat: number | null;
    base_lng: number | null;
}

interface AddressCoverageCheckerProps {
    cityId: string;
    initialAddress?: string;
    onAddressSelect: (address: string, lat: number | null, lng: number | null, recommendedAdiestradorId: string | null) => void;
}

export function AddressCoverageChecker({ cityId, initialAddress = '', onAddressSelect }: AddressCoverageCheckerProps) {
    const { loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries
    });

    const [adiestradores, setAdiestradores] = useState<Adiestrador[]>([]);
    const [evalStatus, setEvalStatus] = useState<'none' | 'green' | 'yellow' | 'red'>('none');
    const [evalMessage, setEvalMessage] = useState('');

    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            // Optional: specify country or bounds
        },
        debounce: 300,
    });

    useEffect(() => {
        if (initialAddress) {
            setValue(initialAddress, false);
        }
    }, [initialAddress]);

    // Fetch adiestradores when city changes
    useEffect(() => {
        async function fetchAdiestradores() {
            if (!cityId) {
                setAdiestradores([]);
                return;
            }
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, coverage_polygon_green, coverage_polygon_yellow, base_lat, base_lng')
                .eq('role', 'adiestrador')
                .eq('assigned_city_id', cityId);
            
            if (data) {
                setAdiestradores(data);
            }
        }
        fetchAdiestradores();
        setEvalStatus('none');
        setEvalMessage('');
    }, [cityId]);

    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        if (!window.google) return 999999;
        const p1 = new window.google.maps.LatLng(lat1, lng1);
        const p2 = new window.google.maps.LatLng(lat2, lng2);
        // Returns distance in meters
        return window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
    };

    const handleSelectAddress = async (address: string) => {
        setValue(address, false);
        clearSuggestions();

        try {
            const results = await getGeocode({ address });
            const { lat, lng } = await getLatLng(results[0]);
            
            evaluateCoverage(address, lat, lng);
        } catch (error) {
            console.error("Error getGeocode: ", error);
            onAddressSelect(address, null, null, null);
        }
    };

    const evaluateCoverage = (address: string, lat: number, lng: number) => {
        if (!window.google || !window.google.maps || !window.google.maps.geometry) {
            // If geometry library didn't load properly
            onAddressSelect(address, lat, lng, null);
            return;
        }

        const point = new window.google.maps.LatLng(lat, lng);
        
        let bestGreen: Adiestrador | null = null;
        let bestYellow: Adiestrador | null = null;
        let minDistanceGreen = Infinity;
        let minDistanceYellow = Infinity;

        // Evaluate all adiestradores
        for (const adiestrador of adiestradores) {
            // Check green zone
            if (adiestrador.coverage_polygon_green && adiestrador.coverage_polygon_green.length >= 3) {
                const polygonGreen = new window.google.maps.Polygon({ paths: adiestrador.coverage_polygon_green });
                if (window.google.maps.geometry.poly.containsLocation(point, polygonGreen)) {
                    // Falls in green zone
                    const dist = (adiestrador.base_lat && adiestrador.base_lng) 
                        ? calculateDistance(lat, lng, adiestrador.base_lat, adiestrador.base_lng)
                        : 0;
                    if (dist < minDistanceGreen) {
                        minDistanceGreen = dist;
                        bestGreen = adiestrador;
                    }
                    continue; // Already green, no need to check yellow for this adiestrador
                }
            }

            // Check yellow zone
            if (adiestrador.coverage_polygon_yellow && adiestrador.coverage_polygon_yellow.length >= 3) {
                const polygonYellow = new window.google.maps.Polygon({ paths: adiestrador.coverage_polygon_yellow });
                if (window.google.maps.geometry.poly.containsLocation(point, polygonYellow)) {
                    // Falls in yellow zone
                    const dist = (adiestrador.base_lat && adiestrador.base_lng) 
                        ? calculateDistance(lat, lng, adiestrador.base_lat, adiestrador.base_lng)
                        : 0;
                    if (dist < minDistanceYellow) {
                        minDistanceYellow = dist;
                        bestYellow = adiestrador;
                    }
                }
            }
        }

        let recommended = null;
        if (bestGreen) {
            setEvalStatus('green');
            setEvalMessage(`🟢 Adiestrador Recomendado: ${bestGreen.full_name} (Zona Gratuita). Distancia aprox: ${(minDistanceGreen/1000).toFixed(1)}km`);
            recommended = bestGreen.id;
        } else if (bestYellow) {
            setEvalStatus('yellow');
            setEvalMessage(`🟡 Adiestrador Disponible: ${bestYellow.full_name} (Con Suplemento). Distancia aprox: ${(minDistanceYellow/1000).toFixed(1)}km`);
            recommended = bestYellow.id;
        } else {
            setEvalStatus('red');
            setEvalMessage(`🔴 No hay cobertura para esta dirección con los parámetros actuales.`);
        }
        
        onAddressSelect(address, lat, lng, recommended);
    };

    if (loadError) return <div>Error cargando Google Maps</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        // Reset status if user starts typing manually after a selection
                        if (evalStatus !== 'none') {
                            setEvalStatus('none');
                            setEvalMessage('');
                            onAddressSelect(e.target.value, null, null, null);
                        } else {
                            // Just update text
                            onAddressSelect(e.target.value, null, null, null);
                        }
                    }}
                    disabled={!ready}
                    placeholder="Empieza a escribir la dirección..."
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none' }}
                />
                {status === "OK" && (
                    <ul style={{ position: 'absolute', zIndex: 50, background: 'white', width: '100%', listStyle: 'none', margin: '0.25rem 0 0 0', padding: 0, border: '1px solid #e5e7eb', borderRadius: '0.5rem', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        {data.map(({ place_id, description }) => (
                            <li
                                key={place_id}
                                onClick={() => handleSelectAddress(description)}
                                style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                {description}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {evalStatus !== 'none' && (
                <div style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    backgroundColor: evalStatus === 'green' ? '#f0fdf4' : evalStatus === 'yellow' ? '#fefce8' : '#fef2f2',
                    color: evalStatus === 'green' ? '#166534' : evalStatus === 'yellow' ? '#854d0e' : '#991b1b',
                    border: `1px solid ${evalStatus === 'green' ? '#bbf7d0' : evalStatus === 'yellow' ? '#fef08a' : '#fecaca'}`
                }}>
                    {evalMessage}
                </div>
            )}
        </div>
    );
}
