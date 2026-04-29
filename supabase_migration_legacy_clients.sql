-- ============================================================================
-- Migración de clientes del CRM antiguo → CRM nuevo
-- ============================================================================
-- Importa 49 clientes activos con sus sesiones y pagos.
-- Excluídos: Sevilla (4) y Navalmoral (5) — se harán manualmente.
--
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase → SQL Editor
--   2. Si falla en la validación inicial (ciudad/adiestrador no encontrado),
--      corregir el nombre en la BD o en este script y reintentar.
--   3. Es atómico: si algo falla, no se importa nada.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- VALIDACIÓN PREVIA: comprobar que todas las ciudades y adiestradores existen
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_missing text;
    v_duplicate text;
BEGIN
    -- Ciudades
    SELECT string_agg(name, ', ') INTO v_missing
    FROM (VALUES
        ('Salamanca'), ('Gijón'), ('Cáceres'), ('Madrid'),
        ('A Coruña'), ('Málaga'), ('Las Palmas'), ('Granollers'),
        ('Barcelona'), ('Donosti')
    ) AS c(name)
    WHERE NOT EXISTS (SELECT 1 FROM cities WHERE cities.name = c.name);

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Ciudades no encontradas en BD: %', v_missing;
    END IF;

    -- Adiestradores
    SELECT string_agg(name, ', ') INTO v_missing
    FROM (VALUES
        ('Rober Almohalla'), ('Ana'), ('Javier'), ('Gonzalo'),
        ('Victoria'), ('Jesús'), ('Victor'), ('Xenia'),
        ('Judith'), ('Beñat')
    ) AS t(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE full_name = t.name AND role = 'adiestrador'
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Adiestradores no encontrados en BD: %', v_missing;
    END IF;

    -- Nombres de adiestrador duplicados (excepto Jesús, que se resuelve por ciudad)
    SELECT string_agg(full_name, ', ') INTO v_duplicate
    FROM (
        SELECT full_name FROM profiles
        WHERE role = 'adiestrador'
          AND full_name IN (
              'Rober Almohalla', 'Ana', 'Javier', 'Gonzalo',
              'Victoria', 'Victor', 'Xenia', 'Judith', 'Beñat'
          )
        GROUP BY full_name
        HAVING COUNT(*) > 1
    ) d;

    IF v_duplicate IS NOT NULL THEN
        RAISE EXCEPTION 'Nombres de adiestrador duplicados (revisar): %', v_duplicate;
    END IF;

    -- Verificar que existe un Jesús asignado a Málaga (vía adiestrador_cities)
    IF NOT EXISTS (
        SELECT 1
        FROM profiles p
        JOIN adiestrador_cities ac ON ac.profile_id = p.id
        JOIN cities c ON c.id = ac.city_id
        WHERE p.full_name = 'Jesús'
          AND p.role = 'adiestrador'
          AND c.name = 'Málaga'
    ) THEN
        RAISE EXCEPTION 'No se encuentra un adiestrador "Jesús" asignado a la ciudad Málaga';
    END IF;
END $$;

-- ============================================================================
-- IMPORTACIÓN DE CLIENTES
-- ============================================================================
DO $$
DECLARE
    v_client_id uuid;
    v_city_salamanca uuid;
    v_city_gijon uuid;
    v_city_caceres uuid;
    v_city_madrid uuid;
    v_city_coruna uuid;
    v_city_malaga uuid;
    v_city_canarias uuid;
    v_city_granollers uuid;
    v_city_barcelona uuid;
    v_city_donosti uuid;
    v_t_rober uuid;
    v_t_ana uuid;
    v_t_javier uuid;
    v_t_gonzalo uuid;
    v_t_victoria uuid;
    v_t_jesus uuid;
    v_t_victor uuid;
    v_t_xenia uuid;
    v_t_judith uuid;
    v_t_benat uuid;
BEGIN
    -- Resolver IDs de ciudades
    SELECT id INTO v_city_salamanca  FROM cities WHERE name = 'Salamanca';
    SELECT id INTO v_city_gijon      FROM cities WHERE name = 'Gijón';
    SELECT id INTO v_city_caceres    FROM cities WHERE name = 'Cáceres';
    SELECT id INTO v_city_madrid     FROM cities WHERE name = 'Madrid';
    SELECT id INTO v_city_coruna     FROM cities WHERE name = 'A Coruña';
    SELECT id INTO v_city_malaga     FROM cities WHERE name = 'Málaga';
    SELECT id INTO v_city_canarias   FROM cities WHERE name = 'Las Palmas';
    SELECT id INTO v_city_granollers FROM cities WHERE name = 'Granollers';
    SELECT id INTO v_city_barcelona  FROM cities WHERE name = 'Barcelona';
    SELECT id INTO v_city_donosti    FROM cities WHERE name = 'Donosti';

    -- Resolver IDs de adiestradores
    SELECT id INTO v_t_rober    FROM profiles WHERE full_name = 'Rober Almohalla' AND role = 'adiestrador';
    SELECT id INTO v_t_ana      FROM profiles WHERE full_name = 'Ana'             AND role = 'adiestrador';
    SELECT id INTO v_t_javier   FROM profiles WHERE full_name = 'Javier'          AND role = 'adiestrador';
    SELECT id INTO v_t_gonzalo  FROM profiles WHERE full_name = 'Gonzalo'         AND role = 'adiestrador';
    SELECT id INTO v_t_victoria FROM profiles WHERE full_name = 'Victoria'        AND role = 'adiestrador';
    -- Jesús: hay dos con este nombre (Málaga y Navalmoral). Resolvemos por ciudad.
    SELECT p.id INTO v_t_jesus
    FROM profiles p
    JOIN adiestrador_cities ac ON ac.profile_id = p.id
    JOIN cities c ON c.id = ac.city_id
    WHERE p.full_name = 'Jesús' AND p.role = 'adiestrador' AND c.name = 'Málaga'
    LIMIT 1;
    SELECT id INTO v_t_victor   FROM profiles WHERE full_name = 'Victor'          AND role = 'adiestrador';
    SELECT id INTO v_t_xenia    FROM profiles WHERE full_name = 'Xenia'           AND role = 'adiestrador';
    SELECT id INTO v_t_judith   FROM profiles WHERE full_name = 'Judith'          AND role = 'adiestrador';
    SELECT id INTO v_t_benat    FROM profiles WHERE full_name = 'Beñat'           AND role = 'adiestrador';

    -- ========================================================================
    -- SALAMANCA — Rober Almohalla (8 clientes)
    -- ========================================================================

    -- 1. Antonio Porras Fernandez
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Antonio Porras Fernandez', '635657544', 'antoniooiea@lowi.es', 'C/Ecuador,16 37003', v_city_salamanca, 'mestizo grande', '3 años', 'activo', v_t_rober)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-03', true, v_t_rober),
        (v_client_id, 2, '2026-03-11', true, v_t_rober),
        (v_client_id, 3, '2026-03-23', true, v_t_rober),
        (v_client_id, 4, '2026-04-09', true, v_t_rober),
        (v_client_id, 5, '2026-04-16', true, v_t_rober),
        (v_client_id, 6, '2026-04-25', true, v_t_rober);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-01-29', 'transferencia'),
        (v_client_id, 2, 240, true, '2026-04-15', 'transferencia');

    -- 2. Alicia Sanchez Sanchez (solo valoración)
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Alicia Sanchez Sanchez', '667420329', 'alysansan1972@gmail.com', 'C/Miguel de Cervantes,22', v_city_salamanca, 'mestizo', 'cachorro', 'evaluado', v_t_rober, 'Solo valoración')
    RETURNING id INTO v_client_id;

    -- 3. Mª Teresa Gayon Aspa
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Mª Teresa Gayon Aspa', '600846701', 'maitegayonaspa@gmail.com', 'C/Alameda,2 1º C', v_city_salamanca, 'Bichon Maltes', 'cachorro', 'activo', v_t_rober)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-15', true, v_t_rober);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-15', 'efectivo');

    -- 4. Ana Beatriz Curto Martin
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Ana Beatriz Curto Martin', '645515632', 'anacurtom@hotmail.com', 'C/San Roque,11 1º A Carbajosa 37188', v_city_salamanca, 'Bichon Maltes', 'cachorro', 'activo', v_t_rober)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-02', true, v_t_rober),
        (v_client_id, 2, '2026-04-07', true, v_t_rober);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-21', 'efectivo');

    -- 5. Fatima Rey Magro
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Fatima Rey Magro', '622198916', '020.fatima.rey@gmail.com', 'C/Licenciados,20 4º A 37007', v_city_salamanca, 'Braco de Weimar', '1 año', 'activo', v_t_rober)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-01', true, v_t_rober);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 60, true, '2026-02-01', 'efectivo');

    -- 6. Ainhoa Verdejo Sanchez (8 sesiones = finalizado; 2 bloques prepagados)
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Ainhoa Verdejo Sanchez', '649168298', 'ainhoaverdejosanchez@gmail.com', 'AVDA/Alcalde Beltrán de Heredia,13 2 1º B 37008', v_city_salamanca, 'mestizo', '1 año', 'finalizado', v_t_rober, '2 bloques prepagados en P1 (480€)')
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2025-12-19', true, v_t_rober),
        (v_client_id, 2, '2026-01-02', true, v_t_rober),
        (v_client_id, 3, '2026-01-17', true, v_t_rober),
        (v_client_id, 4, '2026-01-27', true, v_t_rober),
        (v_client_id, 5, '2026-02-24', true, v_t_rober),
        (v_client_id, 6, '2026-03-05', true, v_t_rober),
        (v_client_id, 7, '2026-03-20', true, v_t_rober),
        (v_client_id, 8, '2026-03-30', true, v_t_rober);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 480, true, '2025-12-19', 'efectivo');

    -- 7. Jose Luis Marcos Melero
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Jose Luis Marcos Melero', '625094360', 'decolores53@gmail.com', 'C/Estrella,39 2º B', v_city_salamanca, 'Bichon Maltes', '2 años', 'activo', v_t_rober)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-03-09', true, v_t_rober),
        (v_client_id, 2, '2026-03-16', true, v_t_rober),
        (v_client_id, 3, '2026-03-26', true, v_t_rober);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-03-09', 'efectivo');

    -- 8. Angel Hernandez Roja
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Angel Hernandez Roja', '698905539', 'angelhernandez6248@gmail.com', 'C/Sumastra,1 escalera 1 2ºB 37003', v_city_salamanca, 'bullying', '4 años', 'activo', v_t_rober)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-03-03', true, v_t_rober),
        (v_client_id, 2, '2026-03-09', true, v_t_rober),
        (v_client_id, 3, '2026-03-16', true, v_t_rober),
        (v_client_id, 4, '2026-03-25', true, v_t_rober);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-03-02', 'transferencia');

    -- ========================================================================
    -- GIJÓN — Ana (2 clientes)
    -- ========================================================================

    -- 9. Lucia Campos Rodriguez
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Lucia Campos Rodriguez', '629772924', 'lucia.rdguez1973@gmai.com', 'C/Rio Abajo 10, Collado Siero 33518', v_city_gijon, 'mastizo grande', '2 años', 'evaluado', v_t_ana)
    RETURNING id INTO v_client_id;

    -- 10. Andrea Rodriguez Montoña
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Andrea Rodriguez Montoña', '615786079', 'andrea.rodriguezmontona@gmail.com', 'C/Ana Garrar,18 9º D 37210', v_city_gijon, 'mestizo', 'cachorro', 'activo', v_t_ana, 'Presupuesto de 10 sesiones')
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-17', true, v_t_ana),
        (v_client_id, 2, '2026-04-22', true, v_t_ana);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 300, true, '2026-04-15', 'transferencia');

    -- ========================================================================
    -- CÁCERES — Javier (7 clientes)
    -- ========================================================================

    -- 11. Marina (faltan los datos)
    INSERT INTO clients (name, phone, city_id, status, adiestrador_id, observations)
    VALUES ('Marina', '634234149', v_city_caceres, 'evaluado', v_t_javier, 'Faltan los datos completos')
    RETURNING id INTO v_client_id;

    -- 12. Pilar Hernandez Fernandea
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Pilar Hernandez Fernandea', '630052150', 'hdezpiar@gmail.com', 'Urbanización Miral Rio', v_city_caceres, 'teckel', '1 año', 'activo', v_t_javier)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-03-12', true, v_t_javier),
        (v_client_id, 2, '2026-03-20', true, v_t_javier),
        (v_client_id, 3, '2026-03-28', true, v_t_javier);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-03-12', 'efectivo');

    -- 13. Leonor Rodrígo Falcon
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Leonor Rodrígo Falcon', '608397790', 'lrodrigofalcon@gmail.com', 'C/Castúos,12 Esparralejo', v_city_caceres, 'doberman', '2 años', 'activo', v_t_javier)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-03-12', true, v_t_javier),
        (v_client_id, 2, '2026-03-15', true, v_t_javier),
        (v_client_id, 3, '2026-03-20', true, v_t_javier),
        (v_client_id, 4, '2026-03-26', true, v_t_javier),
        (v_client_id, 5, '2026-04-02', true, v_t_javier),
        (v_client_id, 6, '2026-04-12', true, v_t_javier);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-02-03', 'efectivo'),
        (v_client_id, 2, 240, true, '2026-04-03', 'efectivo');

    -- 14. Patricia Ruiz Tapia
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Patricia Ruiz Tapia', '650900189', 'pat.ruiz82@hotmail.com', 'C/G Parcela 161 A Polígono Ganadero', v_city_caceres, 'Breton', '1 año', 'activo', v_t_javier)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-01-08', true, v_t_javier),
        (v_client_id, 2, '2026-02-05', true, v_t_javier),
        (v_client_id, 3, '2026-03-10', true, v_t_javier),
        (v_client_id, 4, '2026-03-20', true, v_t_javier),
        (v_client_id, 5, '2026-03-25', true, v_t_javier),
        (v_client_id, 6, '2026-03-01', true, v_t_javier),
        (v_client_id, 7, '2026-04-15', true, v_t_javier);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-01-08', 'transferencia'),
        (v_client_id, 2, 240, true, '2026-03-20', 'transferencia');

    -- 15. Patricia Fernandez Quintana
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Patricia Fernandez Quintana', '697264453', 'patiportu@gmail.com', 'C/Luis Chamizo,11 Portal 5 21 Derech Malpartida', v_city_caceres, 'Bichon maltes', '1 año', 'activo', v_t_javier)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-01-08', true, v_t_javier),
        (v_client_id, 2, '2026-02-05', true, v_t_javier),
        (v_client_id, 3, '2026-03-10', true, v_t_javier),
        (v_client_id, 4, '2026-03-20', true, v_t_javier),
        (v_client_id, 5, '2026-03-25', true, v_t_javier),
        (v_client_id, 6, '2026-03-01', true, v_t_javier),
        (v_client_id, 7, '2026-04-29', true, v_t_javier);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-01-03', 'efectivo'),
        (v_client_id, 2, 240, true, '2026-03-15', 'efectivo');

    -- 16. Angela Florencio Cardenal
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Angela Florencio Cardenal', '617252200', 'anglea-sc@hotmail.com', 'C/Isaac Alberniz,33', v_city_caceres, 'mestizo', '3 años', 'activo', v_t_javier)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-23', true, v_t_javier),
        (v_client_id, 2, '2026-04-07', true, v_t_javier),
        (v_client_id, 3, '2026-03-10', true, v_t_javier);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-02-20', 'transferencia');

    -- 17. Daniel Villa Velasco
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Daniel Villa Velasco', '695113314', 'Danielvillavelasco12@gmail.com', 'Barriada las Eras D 1 Casar de Cáceres', v_city_caceres, 'mesetizo de mali', '4 años', 'activo', v_t_javier)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-03-20', true, v_t_javier),
        (v_client_id, 2, '2026-04-12', true, v_t_javier);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-12', 'efectivo');

    -- ========================================================================
    -- MADRID — Gonzalo (6 clientes)
    -- ========================================================================

    -- 18. Elena Rodriguez Monntoña
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Elena Rodriguez Monntoña', '696783007', 'elenaromo86@gmail.com', 'C/Camino de Cuba,17 portal 8 1º', v_city_madrid, 'Mestizo', '2 años', 'activo', v_t_gonzalo)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-16', true, v_t_gonzalo),
        (v_client_id, 2, '2026-04-24', true, v_t_gonzalo);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-14', 'transferencia');

    -- 19. Mihaela Gongotea
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Mihaela Gongotea', '642925166', 'gogonteamihaela003@gmail.com', 'C/Circunvalación,2 Escalera izquierda 9º B', v_city_madrid, 'Mestizo', '3 años', 'evaluado', v_t_gonzalo)
    RETURNING id INTO v_client_id;

    -- 20. Andreina Garcia Fermin
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Andreina Garcia Fermin', '667202678', 'andreinagarcia2911@gmail.com', 'C/Carlos IV,15 6º A 28037', v_city_madrid, 'Pastor aleman', '2 años', 'activo', v_t_gonzalo)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-23', true, v_t_gonzalo),
        (v_client_id, 2, '2026-03-02', true, v_t_gonzalo),
        (v_client_id, 3, '2026-03-12', true, v_t_gonzalo),
        (v_client_id, 4, '2026-03-18', true, v_t_gonzalo);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-02-21', 'transferencia');

    -- 21. Inmaculada Hernandez Gallego
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Inmaculada Hernandez Gallego', '679383528', 'inmamadrid.h@gmail.com', 'C/Orquidia,8 5º E 28933', v_city_madrid, 'mestizo', 'cachorro', 'activo', v_t_gonzalo)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-28', true, v_t_gonzalo),
        (v_client_id, 2, '2026-03-08', true, v_t_gonzalo),
        (v_client_id, 3, '2026-03-14', true, v_t_gonzalo),
        (v_client_id, 4, '2026-04-11', true, v_t_gonzalo);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-03-27', 'transferencia');

    -- 22. Gustavo Suárez Alonso
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Gustavo Suárez Alonso', '650032425', 'gussuarez90@gmail.com', 'C/Pilar Valdés.1º A 28521', v_city_madrid, 'teckel', '1 año', 'activo', v_t_gonzalo, 'Paga la valoración con el 1º bloque (280€ = 240 + 40)')
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-28', true, v_t_gonzalo),
        (v_client_id, 2, '2026-02-08', true, v_t_gonzalo),
        (v_client_id, 3, '2026-03-14', true, v_t_gonzalo),
        (v_client_id, 4, '2026-04-11', true, v_t_gonzalo);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 280, true, '2026-02-27', 'transferencia');

    -- 23. Ana Belen Blanes Santana
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Ana Belen Blanes Santana', '692819044', 'anabelbs244@gmail.com', 'C/Mayor 52 Es derecha 1º A 28801', v_city_madrid, 'mestizo', '2 años', 'evaluado', v_t_gonzalo)
    RETURNING id INTO v_client_id;

    -- ========================================================================
    -- A CORUÑA — Victoria (5 clientes)
    -- ========================================================================

    -- 24. Ana Ruiz Tasende
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Ana Ruiz Tasende', '650476994', 'ajyanezruiz@gmail.com', 'Lugar Sada Darriba 38 bloque 2', v_city_coruna, 'Pastor Aleman', 'cachorro', 'evaluado', v_t_victoria)
    RETURNING id INTO v_client_id;

    -- 25. Cesar Santos Rega
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Cesar Santos Rega', '653243195', 'locaio@hotmail.com', 'C/Rúa a Viña 3 5º B Ofimatico', v_city_coruna, 'caniche', 'cachorro', 'activo', v_t_victoria)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-06', true, v_t_victoria),
        (v_client_id, 2, '2026-02-18', true, v_t_victoria),
        (v_client_id, 3, '2026-03-20', true, v_t_victoria);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-02-05', 'transferencia');

    -- 26. Vanesa Cañas Garcia
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Vanesa Cañas Garcia', '669810923', 'vanessacg1979@gmail.com', 'AVDA/De Arteixo,97 2º Derecha', v_city_coruna, 'mestizo mediano', '2 años', 'evaluado', v_t_victoria)
    RETURNING id INTO v_client_id;

    -- 27. Alejandra Santos Lara
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Alejandra Santos Lara', '620736627', 'a1santoslara@gmail.com', 'C/Cuesta de la Tapia,9 o Temple', v_city_coruna, 'mestizo pequeño', '3 años', 'evaluado', v_t_victoria)
    RETURNING id INTO v_client_id;

    -- 28. Eva Fernandez Vazquez
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, status, adiestrador_id)
    VALUES ('Eva Fernandez Vazquez', '636208192', 'vzquezveira@gmail.com', 'Travesia de Veiraz,36 15140', v_city_coruna, 'mestizo mediano', 'activo', v_t_victoria)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-12', true, v_t_victoria);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-10', 'transferencia');

    -- ========================================================================
    -- MÁLAGA — Jesús (3 clientes)
    -- ========================================================================

    -- 29. Stiven Jorge Esteban
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Stiven Jorge Esteban', '636713287', 'stivenmartinpuyol@gmail.com', 'C/Bauhinias de Baviera,10 Calera de Velez', v_city_malaga, 'Pastor Belga', '2 años', 'activo', v_t_jesus)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-12', true, v_t_jesus),
        (v_client_id, 2, '2026-04-22', true, v_t_jesus);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-10', 'transferencia');

    -- 30. José Fernandez Sanchez
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('José Fernandez Sanchez', '617093718', 'jsspepe01@hotmail.com', 'C/Vazquez Claver,14 2º A 29003', v_city_malaga, 'american stanford', '4 años', 'evaluado', v_t_jesus)
    RETURNING id INTO v_client_id;

    -- 31. Delia Peña Naranjo
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Delia Peña Naranjo', '606037800', 'delianurse80@gmail.com', 'Plaza la Solidaridd,7 portal 8 8º A 28002', v_city_malaga, 'Pastor Belga', 'cachorro', 'evaluado', v_t_jesus)
    RETURNING id INTO v_client_id;

    -- ========================================================================
    -- LAS PALMAS — Victor (2 clientes)
    -- ========================================================================

    -- 32. Esther Garcia Guerrero
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Esther Garcia Guerrero', '617574117', 'esgague@gmail.com', 'AVDA/Pintor Celo Mozón,39 portal 2 2º C', v_city_canarias, 'teckel', 'cachorro', 'activo', v_t_victor, 'Pendiente de facturar 2º bloque')
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-10', true, v_t_victor),
        (v_client_id, 2, '2026-03-04', true, v_t_victor),
        (v_client_id, 3, '2026-03-25', true, v_t_victor),
        (v_client_id, 4, '2026-03-28', true, v_t_victor),
        (v_client_id, 5, '2026-04-04', true, v_t_victor),
        (v_client_id, 6, '2026-03-29', true, v_t_victor);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-02-10', 'transferencia'),
        (v_client_id, 2, 240, true, '2026-04-25', 'transferencia');

    -- 33. Eva Baraja Zardaña
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Eva Baraja Zardaña', '636123491', 'eva_barsal@hotmail.com', 'C/Pintor Pepe Damso,17 2º C 37018', v_city_canarias, 'mestizo pequeño', '1 año', 'activo', v_t_victor, 'Pendiente de facturar 2º bloque')
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-02-10', true, v_t_victor),
        (v_client_id, 2, '2026-03-05', true, v_t_victor),
        (v_client_id, 3, '2026-03-22', true, v_t_victor),
        (v_client_id, 4, '2026-03-29', true, v_t_victor),
        (v_client_id, 5, '2026-04-06', true, v_t_victor),
        (v_client_id, 6, '2026-04-15', true, v_t_victor);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-10', 'transferencia'),
        (v_client_id, 2, 240, true, '2026-04-25', 'transferencia');

    -- ========================================================================
    -- GRANOLLERS — Xenia (8 clientes)
    -- ========================================================================

    -- 34. Carlos Aguilera Martin
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Carlos Aguilera Martin', '665165334', '85aguilera85@gmail.com', 'Plaza la Cens,12 08317 Orrus', v_city_granollers, 'mestizo mediano', '1 año', 'activo', v_t_xenia)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-25', true, v_t_xenia);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-23', 'transferencia');

    -- 35. David Zamora Frances
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('David Zamora Frances', '630982438', 'cocinillas39@gmail.com', 'C/Dioni Girona,26 08107', v_city_granollers, 'mestizo pequeño', 'cachorro', 'activo', v_t_xenia)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-09', true, v_t_xenia),
        (v_client_id, 2, '2026-04-16', true, v_t_xenia),
        (v_client_id, 3, '2026-04-23', true, v_t_xenia);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-23', 'transferencia');

    -- 36. Silvia Hernandez Vives
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Silvia Hernandez Vives', '616762920', 'heris@hotmail.com', 'AVDA/Antonio Gaudi,19 Mollet del Vallés', v_city_granollers, 'teckel', 'cachorro', 'activo', v_t_xenia)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-03-30', true, v_t_xenia),
        (v_client_id, 2, '2026-04-10', true, v_t_xenia),
        (v_client_id, 3, '2026-04-15', true, v_t_xenia),
        (v_client_id, 4, '2026-04-29', true, v_t_xenia);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-03-28', 'transferencia');

    -- 37. Alba Buitrago
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Alba Buitrago', '665551539', 'viladomat57@gmail.com', 'AVADA/Cel Parc,1 Copisteria', v_city_granollers, 'mestizo', '1 año', 'evaluado', v_t_xenia)
    RETURNING id INTO v_client_id;

    -- 38. Lucia Chuca Moran
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Lucia Chuca Moran', '698491926', 'luciachuca74@gmail.com', 'C/Tarragona,2 bajo', v_city_granollers, 'mestizo', '2 años', 'activo', v_t_xenia)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-02', true, v_t_xenia),
        (v_client_id, 2, '2026-04-09', true, v_t_xenia),
        (v_client_id, 3, '2026-04-23', true, v_t_xenia);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-08', 'transferencia');

    -- 39. Yolanda Bermejo Frias
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Yolanda Bermejo Frias', '699561340', 'yolandadaief@gmail.com', 'C/Monserrat,19 3B 08160', v_city_granollers, 'mestizo', '2 años', 'activo', v_t_xenia)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-21', true, v_t_xenia);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-20', 'transferencia');

    -- 40. Maite Corral
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Maite Corral', '679705123', 'tereco_72@gmail.com', 'C/Tisner,24 Vilanova del Vallés', v_city_granollers, 'Bichon Maltes', 'cachorro', 'activo', v_t_xenia)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-28', true, v_t_xenia),
        (v_client_id, 2, '2026-04-11', true, v_t_xenia);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 300, true, '2026-04-27', 'transferencia');

    -- 41. Pedro Garcia Cabrera
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Pedro Garcia Cabrera', '605070019', 'pgcspc@gmail.com', 'C/San Autoni,123 08150 Paret del Vallés', v_city_granollers, 'pastor aleman', '3 años', 'evaluado', v_t_xenia)
    RETURNING id INTO v_client_id;

    -- ========================================================================
    -- BARCELONA — Judith (4 clientes)
    -- ========================================================================

    -- 42. Paqui Garcia Palanco
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Paqui Garcia Palanco', '667035005', 'Bluechr@hotmail.com', 'C/Valencia,75 3º 3º 08303', v_city_barcelona, 'teckel', '2 años', 'activo', v_t_judith)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-07', true, v_t_judith),
        (v_client_id, 2, '2026-04-15', true, v_t_judith),
        (v_client_id, 3, '2026-04-23', true, v_t_judith);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-06', 'transferencia');

    -- 43. Monserrat Motero Rodriguez (pago adelantado sin sesiones)
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Monserrat Motero Rodriguez', '600241425', 'bcnmonsesol@gmail.com', 'C/Vesuvi,13 piso 1º B 08016', v_city_barcelona, 'mestizo', '3 años', 'evaluado', v_t_judith, '4 sesiones paga 2 y 2')
    RETURNING id INTO v_client_id;
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 120, true, '2026-04-22', 'transferencia');

    -- 44. Carlos Salcedo
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Carlos Salcedo', '661840822', 'karls28@gmail.com', 'C/Paseo Zona Franca,157 3-1', v_city_barcelona, 'Pastor Aleman', 'cachorro', 'evaluado', v_t_judith)
    RETURNING id INTO v_client_id;

    -- 45. Ihor Herman (corregida ciudad "Barcelon" → Barcelona)
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Ihor Herman', '674593143', 'ihorherman68@gmail.com', 'C/Espronceda, 363 Entreplanta 1º 08027', v_city_barcelona, 'Pastor Aleman', '2 años', 'evaluado', v_t_judith)
    RETURNING id INTO v_client_id;

    -- ========================================================================
    -- DONOSTI — Beñat (4 clientes)
    -- ========================================================================

    -- 46. Andrea Romero
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Andrea Romero', '671497174', 'andiuetxi@gmail.com', 'C/Porcelanas Bidasoa,2 3º E', v_city_donosti, 'pastor tervure', '2 años', 'activo', v_t_benat)
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-10', true, v_t_benat),
        (v_client_id, 2, '2026-04-21', true, v_t_benat);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 240, true, '2026-04-08', 'transferencia');

    -- 47. Ainhoa Perez Garrido
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id, observations)
    VALUES ('Ainhoa Perez Garrido', '691763391', 'ainhoaperezgarrido@gmail.com', 'C/Usandizaga,95 derecha 20002', v_city_donosti, 'teckel', 'cachorro', 'activo', v_t_benat, 'Contrato de 6 sesiones')
    RETURNING id INTO v_client_id;
    INSERT INTO sessions (client_id, session_number, date, completed, adiestrador_id) VALUES
        (v_client_id, 1, '2026-04-20', true, v_t_benat),
        (v_client_id, 2, '2026-04-27', true, v_t_benat);
    INSERT INTO payments (client_id, payment_number, amount, received, received_at, method) VALUES
        (v_client_id, 1, 180, true, '2026-04-18', 'transferencia');

    -- 48. Maria Rodriguez Martinez
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Maria Rodriguez Martinez', '697194086', 'rodriguezmaria@gmail.com', 'C/Lartzal Etxaida,12 8º C 20180', v_city_donosti, 'mestizo', '3 años', 'evaluado', v_t_benat)
    RETURNING id INTO v_client_id;

    -- 49. Begoña Nieto Caldelero
    INSERT INTO clients (name, phone, email, address, city_id, dog_breed, dog_age, status, adiestrador_id)
    VALUES ('Begoña Nieto Caldelero', '622700393', 'nayranikole@gmail.com', 'Plaza Juan Bole,2 1º 20304', v_city_donosti, 'mestizo', '2 años', 'evaluado', v_t_benat)
    RETURNING id INTO v_client_id;

    RAISE NOTICE 'Importación completada: 49 clientes importados correctamente';
END $$;

COMMIT;
