-- Migration: Replace radius-based coverage with polygon-based coverage
-- The old green_radius_km / yellow_radius_km columns are kept for now (non-destructive)
-- New columns store the drawn polygon paths as JSONB arrays of {lat, lng} objects

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS coverage_polygon_green  jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS coverage_polygon_yellow jsonb DEFAULT NULL;
