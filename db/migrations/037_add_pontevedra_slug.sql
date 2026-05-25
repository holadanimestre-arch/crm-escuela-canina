-- Assign slug to Pontevedra so the lead-intake edge function can match
-- leads arriving from the /pontevedra landing page
UPDATE cities SET slug = 'pontevedra' WHERE name = 'Pontevedra' AND slug IS NULL;
