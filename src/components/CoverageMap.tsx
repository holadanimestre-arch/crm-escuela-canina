import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon, Marker } from '@react-google-maps/api';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';

const libraries: ("places" | "drawing" | "geometry")[] = ['places', 'drawing', 'geometry'];

interface CoverageMapProps {
    baseAddress: string;
    setBaseAddress: (address: string) => void;
    baseLat: number | null;
    setBaseLat: (lat: number | null) => void;
    baseLng: number | null;
    setBaseLng: (lng: number | null) => void;
    polygonGreen: any[] | null;
    setPolygonGreen: (path: any[] | null) => void;
    polygonYellow: any[] | null;
    setPolygonYellow: (path: any[] | null) => void;
}

const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '0.5rem'
};

const defaultCenter = {
    lat: 40.416775, // Madrid default
    lng: -3.703790
};

export function CoverageMap({
    baseAddress,
    setBaseAddress,
    baseLat,
    setBaseLat,
    baseLng,
    setBaseLng,
    polygonGreen,
    setPolygonGreen,
    polygonYellow,
    setPolygonYellow
}: CoverageMapProps) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [drawingMode, setDrawingMode] = useState<google.maps.drawing.OverlayType | null>(null);
    const [activeColor, setActiveColor] = useState<'green' | 'yellow'>('green');

    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);

    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            /* Define options like componentRestrictions */
        },
        debounce: 300,
    });

    useEffect(() => {
        setValue(baseAddress, false);
    }, [baseAddress]);

    const handleSelectAddress = async (address: string) => {
        setValue(address, false);
        setBaseAddress(address);
        clearSuggestions();

        try {
            const results = await getGeocode({ address });
            const { lat, lng } = await getLatLng(results[0]);
            setBaseLat(lat);
            setBaseLng(lng);
            if (map) {
                map.panTo({ lat, lng });
                map.setZoom(11);
            }
        } catch (error) {
            console.error("Error getGeocode: ", error);
        }
    };

    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
        if (baseLat && baseLng) {
            map.panTo({ lat: baseLat, lng: baseLng });
            map.setZoom(11);
        }
    }, [baseLat, baseLng]);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    const onPolygonComplete = (polygon: google.maps.Polygon) => {
        const path = polygon.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
        if (activeColor === 'green') {
            setPolygonGreen(path);
        } else {
            setPolygonYellow(path);
        }
        polygon.setMap(null); // remove the drawing manager's raw polygon so we can manage it in React state
        setDrawingMode(null);
    };

    const clearPolygon = (color: 'green' | 'yellow') => {
        if (color === 'green') setPolygonGreen(null);
        if (color === 'yellow') setPolygonYellow(null);
    };

    const toggleDrawingMode = (color: 'green' | 'yellow') => {
        setActiveColor(color);
        setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    }

    if (loadError) return <div>Error cargando mapas</div>;
    if (!isLoaded) return <div>Cargando mapa...</div>;

    const center = baseLat && baseLng ? { lat: baseLat, lng: baseLng } : defaultCenter;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>
                    Dirección Base del Adiestrador
                </label>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={!ready}
                    placeholder="Buscar dirección principal..."
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}
                />
                {status === "OK" && (
                    <ul style={{ position: 'absolute', zIndex: 10, background: 'white', width: '100%', listStyle: 'none', margin: 0, padding: 0, border: '1px solid #e5e7eb', borderRadius: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {data.map(({ place_id, description }) => (
                            <li
                                key={place_id}
                                onClick={() => handleSelectAddress(description)}
                                style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                            >
                                {description}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Drawing Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={() => toggleDrawingMode('green')}
                    style={{ padding: '0.5rem 1rem', backgroundColor: drawingMode && activeColor === 'green' ? '#16a34a' : '#f0fdf4', color: drawingMode && activeColor === 'green' ? 'white' : '#166534', border: '1px solid #16a34a', borderRadius: '0.5rem', cursor: 'pointer', flex: 1, fontWeight: 600 }}
                >
                    {drawingMode && activeColor === 'green' ? 'Trazando...' : '📍 Dibujar Zona Gratis'}
                </button>
                <button
                    type="button"
                    onClick={() => clearPolygon('green')}
                    style={{ padding: '0.5rem', background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                    🗑️
                </button>

                <button
                    type="button"
                    onClick={() => toggleDrawingMode('yellow')}
                    style={{ padding: '0.5rem 1rem', backgroundColor: drawingMode && activeColor === 'yellow' ? '#ca8a04' : '#fefce8', color: drawingMode && activeColor === 'yellow' ? 'white' : '#854d0e', border: '1px solid #ca8a04', borderRadius: '0.5rem', cursor: 'pointer', flex: 1, fontWeight: 600 }}
                >
                    {drawingMode && activeColor === 'yellow' ? 'Trazando...' : '📍 Dibujar Zona Suplemento'}
                </button>
                <button
                    type="button"
                    onClick={() => clearPolygon('yellow')}
                    style={{ padding: '0.5rem', background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                    🗑️
                </button>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Haz clic en el botón de dibujar, luego haz clics en el mapa para marcar las esquinas. Haz doble clic en el último punto para cerrar la forma.
            </p>

            {/* The Map */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={center}
                    zoom={10}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={{ disableDefaultUI: true, zoomControl: true }}
                >
                    {baseLat && baseLng && (
                        <Marker position={{ lat: baseLat, lng: baseLng }} label="🏠" />
                    )}

                    {polygonGreen && (
                        <Polygon
                            paths={polygonGreen}
                            options={{ fillColor: '#22c55e', fillOpacity: 0.3, strokeColor: '#16a34a', strokeWeight: 2, clickable: false }}
                        />
                    )}

                    {polygonYellow && (
                        <Polygon
                            paths={polygonYellow}
                            options={{ fillColor: '#eab308', fillOpacity: 0.3, strokeColor: '#ca8a04', strokeWeight: 2, clickable: false }}
                        />
                    )}

                    {drawingMode && (
                        <DrawingManager
                            onLoad={(manager) => drawingManagerRef.current = manager}
                            onPolygonComplete={onPolygonComplete}
                            drawingMode={drawingMode}
                            options={{
                                drawingControl: false,
                                polygonOptions: {
                                    fillColor: activeColor === 'green' ? '#22c55e' : '#eab308',
                                    fillOpacity: 0.3,
                                    strokeWeight: 2,
                                    strokeColor: activeColor === 'green' ? '#16a34a' : '#ca8a04',
                                    clickable: false,
                                    editable: false,
                                    zIndex: 1
                                }
                            }}
                        />
                    )}
                </GoogleMap>
            </div>
        </div>
    );
}
