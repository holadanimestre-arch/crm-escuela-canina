-- Migration to add coverage area fields for adiestradores
ALTER TABLE profiles
ADD COLUMN base_address text,
ADD COLUMN base_lat numeric,
ADD COLUMN base_lng numeric,
ADD COLUMN green_radius_km numeric DEFAULT 15,
ADD COLUMN yellow_radius_km numeric DEFAULT 30;

-- Drop down to update Clients
-- ALTER TABLE clients ADD COLUMN address_lat numeric, ADD COLUMN address_lng numeric;
-- Adding lat/lng to clients to make things easier, though only the address might be enough.
ALTER TABLE clients
ADD COLUMN location_lat numeric,
ADD COLUMN location_lng numeric;
