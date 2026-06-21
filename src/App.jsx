-- ============================================================
-- GP3 · Carga de resultados CAV · 3a Fecha (San Nicolas) · tanda Carrera
-- Tabla: app_state (key='gp3-acred-db-v5', columna value jsonb)
-- Matchea contra los pilotos REALES del blob: campeonato CAV + categoria + dorsal.
-- El #21 SBK Experto (dorsal duplicado) se resuelve por NOMBRE (despues del guion).
-- Reemplaza solo los resultados cav-3/Carrera de los pilotos que matchean.
-- Idempotente: re-ejecutar reemplaza, no duplica. Al final muestra la grilla de control.
-- ============================================================

-- Normalizador (equivalente a normKey de la app: minúsculas, sin acentos, solo a-z0-9)
CREATE OR REPLACE FUNCTION gp3_norm(t text) RETURNS text AS $$
  SELECT regexp_replace(
           translate(lower(coalesce(t,'')),
             'áéíóúüñàèìòùâêîôûäëïöÿç','aeiouunaeiouaeiouaeioync'),
           '[^a-z0-9]','','g');
$$ LANGUAGE sql IMMUTABLE;

DROP TABLE IF EXISTS _stg_carrera;
CREATE TEMP TABLE _stg_carrera(cat text, dorsal text, nombre text, pos int, puntos numeric, motivo text, modo text);
INSERT INTO _stg_carrera(cat,dorsal,nombre,pos,puntos,motivo,modo) VALUES
  ('Gp3 Cup Amateur','11','Santiago Zinno',2,12,NULL,'dorsal'),
  ('Gp3 Cup Amateur','18','Rafael Mossetto',4,8,NULL,'dorsal'),
  ('Gp3 Cup Amateur','69','Jose Ignacio Sartor',3,10,NULL,'dorsal'),
  ('Gp3 Cup Amateur','87','Javier Alvarez',0,0,'No se presentó','dorsal'),
  ('Gp3 Cup Amateur','99','Lucas Brizuela',5,6,NULL,'dorsal'),
  ('Gp3 Cup Amateur','111','Augusto Caviglia',1,15,NULL,'dorsal'),
  ('Gp3 Cup Promocional','37','Manuel Barrionuevo',3,10,NULL,'dorsal'),
  ('Gp3 Cup Promocional','72','Mayte Fernandez',2,12,NULL,'dorsal'),
  ('Gp3 Cup Promocional','95','Gaspar Gonzalez',1,15,NULL,'dorsal'),
  ('Gp3 Cup Experto','13','Ariel Gavarini',3,10,NULL,'dorsal'),
  ('Gp3 Cup Experto','24','Fabricio Avalos',7,4,NULL,'dorsal'),
  ('Gp3 Cup Experto','26','Cristobal Agurto',5,6,NULL,'dorsal'),
  ('Gp3 Cup Experto','29','Mariano Villalobos',2,12,NULL,'dorsal'),
  ('Gp3 Cup Experto','47','Virginia Guidetti',8,3,NULL,'dorsal'),
  ('Gp3 Cup Experto','49','Federico Marquez',6,5,NULL,'dorsal'),
  ('Gp3 Cup Experto','86','Jose Maria Plaja Maidana',1,15,NULL,'dorsal'),
  ('Gp3 Cup Experto','129','Lucas Jaramillo',9,2,NULL,'dorsal'),
  ('Gp3 Cup Experto','888','Ayrton Naveira',4,8,NULL,'dorsal'),
  ('SBK Promocional','16','Mauro Finco',7,4,NULL,'dorsal'),
  ('SBK Promocional','22','Sebastian Pablo',1,15,NULL,'dorsal'),
  ('SBK Promocional','33','Ignacio Bourse',2,12,NULL,'dorsal'),
  ('SBK Promocional','57','Ives Rosso',4,8,NULL,'dorsal'),
  ('SBK Promocional','77','Mateo Racca',3,10,NULL,'dorsal'),
  ('SBK Promocional','94','Miguel Rubiolo',6,5,NULL,'dorsal'),
  ('SBK Promocional','124','Tomas Calvan',5,6,NULL,'dorsal'),
  ('Sportbike 7','33','Ignacio Lemos Becerro',1,15,NULL,'dorsal'),
  ('Sportbike 7','121','Gaston Martinez',0,0,'No tomó la partida','dorsal'),
  ('SBK Senior','3','Walter Rebolledo',6,5,NULL,'dorsal'),
  ('SBK Senior','12','Alexis Varlan',4,8,NULL,'dorsal'),
  ('SBK Senior','13','Jorge Gauna',5,6,NULL,'dorsal'),
  ('SBK Senior','19','Pedro Arrebola',3,10,NULL,'dorsal'),
  ('SBK Senior','27','Pablo Gamberini',0,0,'No se presentó','dorsal'),
  ('SBK Senior','53','Gerardo Crisafulli',1,15,NULL,'dorsal'),
  ('SBK Senior','98','Alejandro Bonello',2,12,NULL,'dorsal'),
  ('SBK Experto','9','Javier De Buono',0,0,'No se presentó','dorsal'),
  ('SBK Experto','17','Francisco Velez',1,15,NULL,'dorsal'),
  ('SBK Experto','21','Gaston Rosato',3,10,NULL,'nombre'),
  ('SBK Experto','22','Felipe Gini',2,12,NULL,'dorsal'),
  ('SBK Experto','85','Alejandro Dalbon',5,6,NULL,'dorsal'),
  ('SBK Experto','21','Guillermo Chamorro',4,8,NULL,'nombre'),
  ('SBK Experto','128','Cristian Albiñana',6,5,NULL,'dorsal'),
  ('SBK Pro','11','Claudio Lopez',4,8,NULL,'dorsal'),
  ('SBK Pro','26','Maximiliano Fontecilla',6,5,NULL,'dorsal'),
  ('SBK Pro','28','Mateo Bongiovanni',5,6,NULL,'dorsal'),
  ('SBK Pro','33','Alberto Auad Cavallotti',0,0,'No se presentó','dorsal'),
  ('SBK Pro','47','Vicente Kruger',3,10,NULL,'dorsal'),
  ('SBK Pro','52','Juan Solorza',1,15,NULL,'dorsal'),
  ('SBK Pro','73','Tomas Cassano',0,0,'No tomó la partida','dorsal'),
  ('SBK Pro','123','Maximiliano Rocha',2,12,NULL,'dorsal');

DROP TABLE IF EXISTS _match_carrera;
CREATE TEMP TABLE _match_carrera AS
WITH pil AS (
  SELECT p->>'id' AS id, p->>'dorsal' AS dorsal, p->>'campeonato' AS campeonato,
         p->>'categoria' AS categoria, gp3_norm(p->>'categoria') AS catk,
         gp3_norm(coalesce(p->>'nombres','')||coalesce(p->>'apellidos','')) AS namek
  FROM app_state s, jsonb_array_elements(s.value->'pilotos') p
  WHERE s.key='gp3-acred-db-v5' AND (p->>'campeonato') LIKE 'CAV%'
)
SELECT s.*, pl.id AS piloto_id, pl.campeonato AS pil_camp, pl.categoria AS pil_cat
FROM _stg_carrera s
LEFT JOIN LATERAL (
  SELECT id, campeonato, categoria FROM pil p
  WHERE p.catk = gp3_norm(s.cat)
    AND (
      (s.modo='dorsal' AND p.dorsal = s.dorsal)
      OR (s.modo='nombre' AND (p.namek = gp3_norm(s.nombre)
            OR p.namek LIKE gp3_norm(s.nombre)||'%'
            OR gp3_norm(s.nombre) LIKE p.namek||'%'))
    )
  LIMIT 1
) pl ON true;

UPDATE app_state a
SET value = jsonb_set(a.value, '{resultados}', (
      SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM (
        SELECT r FROM jsonb_array_elements(a.value->'resultados') r
        WHERE NOT (
          r->>'fechaId'='cav-3' AND r->>'tanda'='Carrera'
          AND r->>'pilotoId' IN (SELECT piloto_id FROM _match_carrera WHERE piloto_id IS NOT NULL)
        )
        UNION ALL
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'id','r-cav-3-carrera-'||m.piloto_id,
          'pilotoId',m.piloto_id,
          'campeonato',m.pil_camp,
          'categoria',m.pil_cat,
          'fechaId','cav-3',
          'tanda','Carrera',
          'pos',m.pos,
          'puntos',m.puntos,
          'motivo',m.motivo
        ))
        FROM _match_carrera m WHERE m.piloto_id IS NOT NULL
      ) z(r)
    ), true),
    updated_at = now()
WHERE a.key='gp3-acred-db-v5';

-- Control: matcheados y SIN coincidencia (revisar los matcheado=false)
SELECT (piloto_id IS NOT NULL) AS matcheado, modo, cat AS categoria, dorsal, nombre,
       pos, puntos, motivo, piloto_id
FROM _match_carrera
ORDER BY matcheado ASC, cat, pos;
