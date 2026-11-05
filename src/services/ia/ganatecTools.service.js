import pool from "../../config/db.js";

// ==========================================
// BUSCAR ANIMAL
// ==========================================

export const consultarAnimal = async (fincaId, termino) => {
  const resultado = await pool.query(
    `
      SELECT
        id,
        identificacion,
        nombre,
        sexo,
        raza,
        fecha_nacimiento,
        estado,
        madre_id,
        padre_id,
        padre_externo

      FROM animales

      WHERE finca_id = $1

        AND (
          LOWER(nombre) =
            LOWER($2)

          OR LOWER(identificacion) =
            LOWER($2)

          OR CAST(id AS TEXT) = $2
        )

      LIMIT 1
    `,
    [fincaId, String(termino).trim()],
  );

  return resultado.rows[0] || null;
};

// ==========================================
// HISTORIAL DE PESO
// ==========================================

export const consultarPesajesAnimal = async (fincaId, animalId) => {
  const resultado = await pool.query(
    `
      SELECT
        p.id,
        p.peso_kg,
        p.fecha_pesaje,

        u.nombre
          AS registrado_por_nombre

      FROM pesajes p

      INNER JOIN animales a
        ON a.id = p.animal_id

      LEFT JOIN usuarios u
        ON u.id = p.registrado_por

      WHERE p.animal_id = $1
        AND a.finca_id = $2

      ORDER BY
        p.fecha_pesaje DESC

      LIMIT 20
    `,
    [animalId, fincaId],
  );

  return resultado.rows;
};

/* =========================================================
   SALUD DEL ANIMAL
========================================================= */

export const consultarSaludAnimal = async (fincaId, animalId) => {
  const resultado = await pool.query(
    `
        SELECT
          es.id,
          es.tipo_evento,
          es.titulo,
          es.descripcion,
          es.gravedad,
          es.estado,
          es.fecha_evento,
          es.fecha_cierre,
          es.motivo_cierre,

          (
            SELECT COUNT(*)::int

            FROM tratamientos t

            WHERE t.evento_salud_id = es.id
          )
            AS total_tratamientos,


          COALESCE(
            (
              SELECT
                json_agg(
                  json_build_object(

                    'id',
                    t.id,

                    'descripcion',
                    t.descripcion,

                    'fecha_inicio',
                    t.fecha_inicio,

                    'fecha_fin',
                    t.fecha_fin,

                    'estado',
                    t.estado,

                    'observacion',
                    t.observacion,

                    'medicamentos',
                    COALESCE(
                      (
                        SELECT
                          json_agg(
                            json_build_object(

                              'id',
                              mt.id,

                              'medicamento',
                              mt.medicamento,

                              'dosis',
                              mt.dosis,

                              'frecuencia',
                              mt.frecuencia,

                              'via_administracion',
                              mt.via_administracion,

                              'duracion_dias',
                              mt.duracion_dias,

                              'observacion',
                              mt.observacion

                            )
                            ORDER BY mt.id
                          )

                        FROM medicamentos_tratamiento mt

                        WHERE
                          mt.tratamiento_id = t.id
                      ),
                      '[]'::json
                    )

                  )
                  ORDER BY
                    t.fecha_inicio DESC NULLS LAST,
                    t.id DESC
                )

              FROM tratamientos t

              WHERE
                t.evento_salud_id = es.id
            ),
            '[]'::json
          )
            AS tratamientos

        FROM eventos_salud es

        INNER JOIN animales a
          ON a.id = es.animal_id

        WHERE es.animal_id = $1
          AND a.finca_id = $2

        ORDER BY
          es.fecha_evento DESC

        LIMIT 20
      `,
    [animalId, fincaId],
  );

  return resultado.rows;
};

/* =========================================================
   REPRODUCCIÓN DEL ANIMAL
========================================================= */

export const consultarReproduccionAnimal = async (fincaId, animalId) => {
  const servicios = await pool.query(
    `
        SELECT
          sr.id,
          sr.tipo_servicio,
          sr.fecha_servicio,

          sr.reproductor_id,
          sr.reproductor_externo,
          sr.codigo_semen,
          sr.responsable,
          sr.observacion,


          CASE

            WHEN sr.reproductor_id IS NOT NULL
              THEN 'registrado'

            WHEN sr.reproductor_externo IS NOT NULL
              THEN 'externo'

            ELSE 'sin_reproductor'

          END
            AS origen_reproductor,


          r.nombre
            AS reproductor_nombre,

          r.identificacion
            AS reproductor_identificacion,

          r.raza
            AS reproductor_raza,


          CASE

            WHEN sr.reproductor_id IS NOT NULL
              THEN json_build_object(

                'tipo',
                'registrado',

                'id',
                r.id,

                'nombre',
                r.nombre,

                'identificacion',
                r.identificacion,

                'raza',
                r.raza

              )

            WHEN sr.reproductor_externo IS NOT NULL
              THEN json_build_object(

                'tipo',
                'externo',

                'nombre',
                sr.reproductor_externo

              )

            ELSE NULL

          END
            AS reproductor,


          g.id
            AS gestacion_id,

          g.estado
            AS estado_gestacion,

          g.fecha_probable_parto,


          (
            SELECT
              json_build_object(

                'id',
                p.id,

                'fecha_parto',
                p.fecha_parto,

                'tipo_parto',
                p.tipo_parto,

                'complicaciones',
                p.complicaciones,

                'observacion',
                p.observacion,

                'crias',
                COALESCE(
                  (
                    SELECT
                      json_agg(
                        json_build_object(

                          'id',
                          cp.id,

                          'sexo',
                          cp.sexo,

                          'estado_nacimiento',
                          cp.estado_nacimiento,

                          'peso_nacimiento_kg',
                          cp.peso_nacimiento_kg,

                          'identificacion_temporal',
                          cp.identificacion_temporal,

                          'animal_id',
                          cp.animal_id,

                          'observacion',
                          cp.observacion

                        )
                        ORDER BY
                          cp.id
                      )

                    FROM crias_parto cp

                    WHERE
                      cp.parto_id = p.id
                  ),
                  '[]'::json
                )

              )

            FROM partos p

            WHERE
              p.gestacion_id = g.id

            ORDER BY
              p.fecha_parto DESC,
              p.id DESC

            LIMIT 1
          )
            AS parto


        FROM servicios_reproductivos sr


        INNER JOIN animales a
          ON a.id = sr.animal_id


        LEFT JOIN animales r
          ON r.id = sr.reproductor_id
          AND r.finca_id = a.finca_id


        LEFT JOIN gestaciones g
          ON g.servicio_reproductivo_id =
             sr.id


        WHERE sr.animal_id = $1
          AND a.finca_id = $2


        ORDER BY
          sr.fecha_servicio DESC,
          sr.id DESC
      `,
    [animalId, fincaId],
  );

  return servicios.rows;
};

// ==========================================
// PRODUCCIÓN DE LECHE
// ==========================================

export const consultarLecheAnimal = async (fincaId, animalId) => {
  const resultado = await pool.query(
    `
      SELECT

        l.id AS lactancia_id,
        l.estado,
        l.fecha_inicio,
        l.fecha_fin,

        COUNT(rl.id)::int
          AS total_ordenios,

        COALESCE(
          SUM(rl.litros),
          0
        )::numeric(12,2)
          AS litros_totales,

        COALESCE(
          AVG(rl.litros),
          0
        )::numeric(12,2)
          AS promedio_por_ordenio

      FROM lactancias l

      INNER JOIN animales a
        ON a.id = l.animal_id

      LEFT JOIN registros_leche rl
        ON rl.lactancia_id = l.id

      WHERE l.animal_id = $1
        AND a.finca_id = $2

      GROUP BY l.id

      ORDER BY
        l.fecha_inicio DESC
    `,
    [animalId, fincaId],
  );

  return resultado.rows;
};

/* =========================================================
   PRODUCCIÓN GENERAL DE LECHE DE LA FINCA
========================================================= */

export const consultarProduccionLecheFinca = async (fincaId) => {
  const resultado = await pool.query(
    `
          WITH fecha_actual AS (

            SELECT
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'America/Bogota'
              )::date
                AS hoy

          ),


          produccion_detallada AS (

            SELECT

              rl.fecha_ordenio::date
                AS fecha,

              SUM(
                rl.litros
              )::numeric(12,2)
                AS litros,

              COUNT(
                rl.id
              )::int
                AS numero_ordenios,

              COUNT(
                DISTINCT l.animal_id
              )::int
                AS vacas_ordenadas

            FROM registros_leche rl

            INNER JOIN lactancias l
              ON l.id = rl.lactancia_id

            INNER JOIN animales a
              ON a.id = l.animal_id

            WHERE a.finca_id = $1

              AND NOT EXISTS (

                SELECT 1

                FROM produccion_leche_diaria pld

                WHERE pld.finca_id = $1

                  AND pld.fecha_produccion =
                      rl.fecha_ordenio::date

              )

            GROUP BY
              rl.fecha_ordenio::date

          ),


          produccion_total AS (

            SELECT

              fecha_produccion::date
                AS fecha,

              litros_totales::numeric(12,2)
                AS litros,

              numero_ordenios::int
                AS numero_ordenios,

              vacas_ordenadas::int
                AS vacas_ordenadas

            FROM produccion_leche_diaria

            WHERE finca_id = $1

          ),


          produccion_unificada AS (

            SELECT *
            FROM produccion_detallada

            UNION ALL

            SELECT *
            FROM produccion_total

          )


          SELECT

            COALESCE(
              SUM(pu.litros)
              FILTER (
                WHERE pu.fecha = fa.hoy
              ),
              0
            )::numeric(12,2)
              AS litros_hoy,


            COALESCE(
              SUM(pu.litros)
              FILTER (
                WHERE pu.fecha >=
                  DATE_TRUNC(
                    'month',
                    fa.hoy
                  )::date

                AND pu.fecha <= fa.hoy
              ),
              0
            )::numeric(12,2)
              AS litros_mes,


            COALESCE(
              SUM(pu.litros)
              FILTER (
                WHERE pu.fecha
                  BETWEEN
                    fa.hoy - 6
                    AND fa.hoy
              ),
              0
            )::numeric(12,2)
              AS ultimos_7_dias,


            COALESCE(
              SUM(pu.litros)
              FILTER (
                WHERE pu.fecha
                  BETWEEN
                    fa.hoy - 13
                    AND fa.hoy - 7
              ),
              0
            )::numeric(12,2)
              AS anteriores_7_dias,


            COALESCE(
              SUM(pu.vacas_ordenadas)
              FILTER (
                WHERE pu.fecha = fa.hoy
              ),
              0
            )::int
              AS vacas_ordenadas_hoy,


            COALESCE(
              SUM(pu.numero_ordenios)
              FILTER (
                WHERE pu.fecha = fa.hoy
              ),
              0
            )::int
              AS numero_ordenios_hoy

          FROM fecha_actual fa

          LEFT JOIN produccion_unificada pu
            ON TRUE

          GROUP BY
            fa.hoy
        `,
    [fincaId],
  );

  return (
    resultado.rows[0] || {
      litros_hoy: 0,
      litros_mes: 0,
      ultimos_7_dias: 0,
      anteriores_7_dias: 0,
      vacas_ordenadas_hoy: 0,
      numero_ordenios_hoy: 0,
    }
  );
};

/* =========================================================
   ANIMALES DE LA FINCA
========================================================= */

export const consultarAnimalesFinca = async (fincaId) => {
  const resultado = await pool.query(
    `
        SELECT
          id,
          identificacion,
          nombre,
          sexo,
          raza,
          estado,
          fecha_nacimiento

        FROM animales

        WHERE finca_id = $1

        ORDER BY
          CASE
            WHEN estado = 'activo'
              THEN 0
            ELSE 1
          END,
          nombre ASC NULLS LAST,
          identificacion ASC

        LIMIT 100
      `,
    [fincaId],
  );

  const animales = resultado.rows;

  const totales = await pool.query(`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado = 'activo')::int AS activos,
      COUNT(*) FILTER (WHERE estado = 'activo' AND sexo = 'hembra')::int AS hembras_activas,
      COUNT(*) FILTER (WHERE estado = 'activo' AND sexo = 'macho')::int AS machos_activos,
      COUNT(*) FILTER (WHERE estado = 'vendido')::int AS vendidos,
      COUNT(*) FILTER (WHERE estado = 'muerto')::int AS muertos,
      COUNT(*) FILTER (WHERE estado = 'trasladado')::int AS trasladados
    FROM animales WHERE finca_id = $1
  `, [fincaId]);

  return {
    resumen: {
      ...totales.rows[0],
      registros_mostrados: animales.length,
      detalle_completo: totales.rows[0].total === animales.length,
    },

    animales: animales.map((animal) => ({
      id: animal.id,

      identificacion: animal.identificacion,

      nombre: animal.nombre,

      sexo: animal.sexo,

      raza: animal.raza,

      estado: animal.estado,

      fecha_nacimiento: animal.fecha_nacimiento,
    })),
  };
};

/* =========================================================
   RESUMEN FINANCIERO DE LA FINCA
========================================================= */

export const consultarFinanzasFinca = async (fincaId) => {
  const [totalesResultado, categoriasResultado] = await Promise.all([
    pool.query(
      `
          WITH fecha_actual AS (

            SELECT
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'America/Bogota'
              )::date
                AS hoy

          )

          SELECT

            COALESCE(
              SUM(mf.monto)
              FILTER (
                WHERE mf.tipo = 'ingreso'
                  AND mf.fecha_movimiento::date >=
                    DATE_TRUNC(
                      'month',
                      fa.hoy
                    )::date
                  AND mf.fecha_movimiento::date <= fa.hoy
              ),
              0
            )::numeric(14,2)
              AS ingresos_mes,


            COALESCE(
              SUM(mf.monto)
              FILTER (
                WHERE mf.tipo = 'gasto'
                  AND mf.fecha_movimiento::date >=
                    DATE_TRUNC(
                      'month',
                      fa.hoy
                    )::date
                  AND mf.fecha_movimiento::date <= fa.hoy
              ),
              0
            )::numeric(14,2)
              AS gastos_mes,


            COALESCE(
              SUM(mf.monto)
              FILTER (
                WHERE mf.tipo = 'ingreso'
                  AND mf.fecha_movimiento::date >=
                    DATE_TRUNC(
                      'year',
                      fa.hoy
                    )::date
                  AND mf.fecha_movimiento::date <= fa.hoy
              ),
              0
            )::numeric(14,2)
              AS ingresos_anio,


            COALESCE(
              SUM(mf.monto)
              FILTER (
                WHERE mf.tipo = 'gasto'
                  AND mf.fecha_movimiento::date >=
                    DATE_TRUNC(
                      'year',
                      fa.hoy
                    )::date
                  AND mf.fecha_movimiento::date <= fa.hoy
              ),
              0
            )::numeric(14,2)
              AS gastos_anio

          FROM fecha_actual fa

          LEFT JOIN movimientos_financieros mf
            ON mf.finca_id = $1

          GROUP BY
            fa.hoy
        `,
      [fincaId],
    ),

    pool.query(
      `
          WITH fecha_actual AS (

            SELECT
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'America/Bogota'
              )::date
                AS hoy

          )

          SELECT

            mf.categoria,

            COUNT(*)::int
              AS movimientos,

            SUM(
              mf.monto
            )::numeric(14,2)
              AS total

          FROM movimientos_financieros mf

          CROSS JOIN fecha_actual fa

          WHERE mf.finca_id = $1

            AND mf.tipo = 'gasto'

            AND mf.fecha_movimiento::date >=
              DATE_TRUNC(
                'month',
                fa.hoy
              )::date

            AND mf.fecha_movimiento::date <=
              fa.hoy

          GROUP BY
            mf.categoria

          ORDER BY
            total DESC

          LIMIT 5
        `,
      [fincaId],
    ),
  ]);

  const totales = totalesResultado.rows[0];

  const ingresosMes = Number(totales?.ingresos_mes || 0);

  const gastosMes = Number(totales?.gastos_mes || 0);

  const ingresosAnio = Number(totales?.ingresos_anio || 0);

  const gastosAnio = Number(totales?.gastos_anio || 0);

  return {
    mes_actual: {
      ingresos: ingresosMes,

      gastos: gastosMes,

      balance: ingresosMes - gastosMes,
    },

    anio_actual: {
      ingresos: ingresosAnio,

      gastos: gastosAnio,

      balance: ingresosAnio - gastosAnio,
    },

    principales_gastos_mes: categoriasResultado.rows.map((item) => ({
      categoria: item.categoria,

      movimientos: item.movimientos,

      total: Number(item.total),
    })),
  };
};

/* =========================================================
   POTREROS Y LOTES DE LA FINCA
========================================================= */

export const consultarPotrerosLotesFinca = async (fincaId) => {
  const [resumenResultado, potrerosResultado, lotesResultado] =
    await Promise.all([
      pool.query(
        `
          SELECT

            COUNT(*)::int
              AS total_potreros,

            COUNT(*)
              FILTER (
                WHERE estado = 'disponible'
              )::int
              AS disponibles,

            COUNT(*)
              FILTER (
                WHERE estado = 'ocupado'
              )::int
              AS ocupados,

            COUNT(*)
              FILTER (
                WHERE estado = 'descanso'
              )::int
              AS descanso,

            COUNT(*)
              FILTER (
                WHERE estado = 'inactivo'
              )::int
              AS inactivos,

            (
              SELECT
                COUNT(*)::int

              FROM lotes

              WHERE finca_id = $1
                AND estado = 'activo'
            )
              AS lotes_activos

          FROM potreros

          WHERE finca_id = $1
        `,
        [fincaId],
      ),

      pool.query(
        `
          SELECT

            p.id,
            p.nombre,
            p.area_hectareas,
            p.tipo_pasto,
            p.capacidad_animales,
            p.estado

          FROM potreros p

          WHERE p.finca_id = $1

          ORDER BY
            p.nombre ASC

          LIMIT 30
        `,
        [fincaId],
      ),

      pool.query(
        `
          SELECT

            l.id,
            l.nombre,
            l.estado,

            COUNT(al.id)
              FILTER (
                WHERE al.fecha_salida IS NULL
              )::int
                AS total_animales,

            p.id
              AS potrero_id,

            p.nombre
              AS potrero_nombre,

            mlp.fecha_ingreso

          FROM lotes l

          LEFT JOIN animales_lotes al
            ON al.lote_id = l.id

          LEFT JOIN movimientos_lotes_potreros mlp
            ON mlp.lote_id = l.id
            AND mlp.fecha_salida IS NULL

          LEFT JOIN potreros p
            ON p.id = mlp.potrero_id

          WHERE l.finca_id = $1
            AND l.estado = 'activo'

          GROUP BY
            l.id,
            l.nombre,
            l.estado,
            p.id,
            p.nombre,
            mlp.fecha_ingreso

          ORDER BY
            l.nombre ASC

          LIMIT 30
        `,
        [fincaId],
      ),
    ]);

  return {
    resumen: resumenResultado.rows[0],

    potreros: potrerosResultado.rows,

    lotes_activos: lotesResultado.rows,
  };
};

/* =========================================================
   UBICACIÓN ACTUAL DEL ANIMAL
========================================================= */

export const consultarUbicacionAnimal = async (fincaId, animalId) => {
  const resultado = await pool.query(
    `
          SELECT

            l.id
              AS lote_id,

            l.nombre
              AS lote_nombre,

            al.fecha_ingreso
              AS fecha_ingreso_lote,

            p.id
              AS potrero_id,

            p.nombre
              AS potrero_nombre,

            p.area_hectareas,
            p.tipo_pasto,
            p.capacidad_animales,
            p.estado
              AS potrero_estado,

            mlp.fecha_ingreso
              AS fecha_ingreso_potrero

          FROM animales_lotes al

          INNER JOIN lotes l
            ON l.id = al.lote_id

          INNER JOIN animales a
            ON a.id = al.animal_id

          LEFT JOIN movimientos_lotes_potreros mlp
            ON mlp.lote_id = l.id
            AND mlp.fecha_salida IS NULL

          LEFT JOIN potreros p
            ON p.id = mlp.potrero_id

          WHERE al.animal_id = $1

            AND a.finca_id = $2

            AND l.finca_id = $2

            AND al.fecha_salida IS NULL

          LIMIT 1
        `,
    [animalId, fincaId],
  );

  return resultado.rows[0] || null;
};

/* =========================================================
   SALUD Y REPRODUCCIÓN GENERAL DE LA FINCA
========================================================= */

export const consultarSaludReproduccionFinca = async (fincaId) => {
  const [
    saludResumenResultado,
    eventosSaludResultado,
    reproduccionResumenResultado,
    gestacionesResultado,
  ] = await Promise.all([
    pool.query(
      `
          SELECT

            (
              SELECT COUNT(*)::int

              FROM eventos_salud es

              INNER JOIN animales a
                ON a.id = es.animal_id

              WHERE a.finca_id = $1
                AND es.estado = 'abierto'
            )
              AS eventos_abiertos,


            (
              SELECT COUNT(*)::int

              FROM eventos_salud es

              INNER JOIN animales a
                ON a.id = es.animal_id

              WHERE a.finca_id = $1
                AND es.estado = 'abierto'
                AND es.gravedad = 'grave'
            )
              AS eventos_graves,


            (
              SELECT COUNT(*)::int

              FROM tratamientos t

              INNER JOIN eventos_salud es
                ON es.id = t.evento_salud_id

              INNER JOIN animales a
                ON a.id = es.animal_id

              WHERE a.finca_id = $1
                AND t.estado = 'activo'
            )
              AS tratamientos_activos
        `,
      [fincaId],
    ),

    pool.query(
      `
          SELECT

            es.id,
            es.titulo,
            es.gravedad,
            es.fecha_evento,

            a.id
              AS animal_id,

            a.identificacion,
            a.nombre

          FROM eventos_salud es

          INNER JOIN animales a
            ON a.id = es.animal_id

          WHERE a.finca_id = $1
            AND es.estado = 'abierto'

          ORDER BY

            CASE es.gravedad

              WHEN 'grave'
                THEN 1

              WHEN 'moderada'
                THEN 2

              ELSE 3

            END,

            es.fecha_evento DESC

          LIMIT 10
        `,
      [fincaId],
    ),

    pool.query(
      `
          WITH fecha_actual AS (

            SELECT
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'America/Bogota'
              )::date
                AS hoy

          )

          SELECT

            COUNT(*)
              FILTER (
                WHERE g.fecha_fin IS NULL
              )::int
                AS gestaciones_activas,


            COUNT(*)
              FILTER (
                WHERE g.fecha_fin IS NULL

                  AND g.fecha_probable_parto::date
                    BETWEEN fa.hoy
                    AND fa.hoy + 7
              )::int
                AS partos_7_dias,


            COUNT(*)
              FILTER (
                WHERE g.fecha_fin IS NULL

                  AND g.fecha_probable_parto::date
                    BETWEEN fa.hoy
                    AND fa.hoy + 30
              )::int
                AS partos_30_dias,


            COUNT(*)
              FILTER (
                WHERE g.fecha_fin IS NULL

                  AND g.fecha_probable_parto::date
                    < fa.hoy
              )::int
                AS gestaciones_vencidas

          FROM gestaciones g

          INNER JOIN servicios_reproductivos sr
            ON sr.id =
               g.servicio_reproductivo_id

          INNER JOIN animales a
            ON a.id = sr.animal_id

          CROSS JOIN fecha_actual fa

          WHERE a.finca_id = $1
        `,
      [fincaId],
    ),

    pool.query(
      `
          WITH fecha_actual AS (

            SELECT
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'America/Bogota'
              )::date
                AS hoy

          )

          SELECT

            g.id
              AS gestacion_id,

            g.fecha_probable_parto,

            a.id
              AS animal_id,

            a.identificacion,
            a.nombre

          FROM gestaciones g

          INNER JOIN servicios_reproductivos sr
            ON sr.id =
               g.servicio_reproductivo_id

          INNER JOIN animales a
            ON a.id = sr.animal_id

          CROSS JOIN fecha_actual fa

          WHERE a.finca_id = $1

            AND g.fecha_fin IS NULL

            AND g.fecha_probable_parto IS NOT NULL

          ORDER BY
            g.fecha_probable_parto ASC

          LIMIT 10
        `,
      [fincaId],
    ),
  ]);

  /* =========================================================
       DETALLE DE TRATAMIENTOS ACTIVOS
    ========================================================= */

  const tratamientosDetalleResultado = await pool.query(
    `
        SELECT
          t.id AS tratamiento_id,
          t.descripcion AS tratamiento,
          t.fecha_inicio,
          t.fecha_fin,
          t.estado,
          t.observacion,

          es.id AS evento_id,
          es.titulo AS motivo,
          es.gravedad,

          a.id AS animal_id,
          a.nombre AS animal,
          a.identificacion,

          -- Medicamentos asociados a cada tratamiento
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'medicamento', mt.medicamento,
                  'dosis', mt.dosis,
                  'frecuencia', mt.frecuencia,
                  'via_administracion', mt.via_administracion,
                  'duracion_dias', mt.duracion_dias,
                  'observacion', mt.observacion
                )
                ORDER BY mt.id
              )
              FROM medicamentos_tratamiento mt
              WHERE mt.tratamiento_id = t.id
            ),
            '[]'::json
          ) AS medicamentos

        FROM tratamientos t

        INNER JOIN eventos_salud es
          ON es.id = t.evento_salud_id

        INNER JOIN animales a
          ON a.id = es.animal_id

        WHERE a.finca_id = $1
          AND t.estado = 'activo'

        ORDER BY
          t.fecha_inicio DESC NULLS LAST,
          t.id DESC

        LIMIT 50
      `,
    [fincaId],
  );

  // Verificar cuántos tratamientos se recuperaron
  console.log("[GANATEC IA] Tratamientos:", {
    total: saludResumenResultado.rows[0]?.tratamientos_activos,
    detalles: tratamientosDetalleResultado.rows.length,
  });

  return {
    salud: {
      resumen: saludResumenResultado.rows[0],

      eventos_abiertos: eventosSaludResultado.rows,

      // Información detallada para el copiloto
      tratamientos_activos_detalle: tratamientosDetalleResultado.rows,

      // Indica si la consulta recuperó todos
      tratamientos_detalle_completo:
        tratamientosDetalleResultado.rows.length ===
        Number(saludResumenResultado.rows[0]?.tratamientos_activos ?? 0),
    },

    reproduccion: {
      resumen: reproduccionResumenResultado.rows[0],

      gestaciones: gestacionesResultado.rows,
    },
  };
};

// ==========================================
// ALERTAS ACTIVAS DE LA FINCA
// ==========================================

export const consultarAlertasFinca = async (fincaId) => {
  const resultado = await pool.query(
    `
      SELECT
        id,
        tipo,
        prioridad,
        titulo,
        mensaje,
        entidad_tipo,
        entidad_id,
        datos,
        fecha_detectada

      FROM alertas

      WHERE finca_id = $1
        AND estado = 'pendiente'

      ORDER BY

        CASE prioridad

          WHEN 'critica'
            THEN 1

          WHEN 'alta'
            THEN 2

          WHEN 'media'
            THEN 3

          ELSE 4

        END,

        fecha_detectada DESC

      LIMIT 20
    `,
    [fincaId],
  );

  return resultado.rows;
};

// ==========================================
// RESUMEN GENERAL DE LA FINCA
// ==========================================

export const consultarResumenFinca = async (fincaId) => {
  const [animales, alertas, inventario] = await Promise.all([
    pool.query(
      `
    SELECT

      COUNT(*)::int
        AS total,


      COUNT(*)
        FILTER (
          WHERE estado = 'activo'
        )::int
        AS activos,


      COUNT(*)
        FILTER (
          WHERE estado = 'vendido'
        )::int
        AS vendidos,


      COUNT(*)
        FILTER (
          WHERE estado = 'muerto'
        )::int
        AS muertos,


      COUNT(*)
        FILTER (
          WHERE estado = 'trasladado'
        )::int
        AS trasladados,


      COUNT(*)
        FILTER (
          WHERE sexo = 'hembra'
        )::int
        AS hembras_total,


      COUNT(*)
        FILTER (
          WHERE sexo = 'macho'
        )::int
        AS machos_total,


      COUNT(*)
        FILTER (
          WHERE estado = 'activo'
            AND sexo = 'hembra'
        )::int
        AS hembras_activas,


      COUNT(*)
        FILTER (
          WHERE estado = 'activo'
            AND sexo = 'macho'
        )::int
        AS machos_activos


    FROM animales

    WHERE finca_id = $1
  `,
      [fincaId],
    ),

    pool.query(
      `
        SELECT
          COUNT(*)::int
            AS pendientes,

          COUNT(*)
            FILTER (
              WHERE prioridad = 'critica'
            )::int
            AS criticas,

          COUNT(*)
            FILTER (
              WHERE prioridad = 'alta'
            )::int
            AS altas

        FROM alertas

        WHERE finca_id = $1
          AND estado = 'pendiente'
      `,
      [fincaId],
    ),

    pool.query(
      `
        WITH stock AS (

          SELECT
            pi.id,
            pi.stock_minimo,

            COALESCE(
              SUM(
                CASE
                  WHEN mi.tipo = 'entrada'
                    THEN mi.cantidad

                  WHEN mi.tipo = 'salida'
                    THEN -mi.cantidad

                  ELSE 0
                END
              ),
              0
            ) AS stock_actual

          FROM productos_inventario pi

          LEFT JOIN movimientos_inventario mi
            ON mi.producto_id = pi.id

          WHERE pi.finca_id = $1
            AND pi.activo = TRUE

          GROUP BY pi.id
        )

        SELECT

          COUNT(*)::int
            AS productos,

          COUNT(*)
            FILTER (
              WHERE stock_actual <= stock_minimo
            )::int
            AS stock_bajo

        FROM stock
      `,
      [fincaId],
    ),
  ]);

  return {
    animales: animales.rows[0],

    alertas: alertas.rows[0],

    inventario: inventario.rows[0],
  };
};

/* =========================================================
   INVENTARIO DE LA FINCA
========================================================= */

export const consultarInventarioFinca = async (fincaId) => {
  const resultado = await pool.query(
    `
        SELECT
          pi.id,
          pi.nombre,
          pi.categoria,
          pi.unidad,
          pi.stock_minimo,

          COALESCE(
            SUM(
              CASE

                WHEN mi.tipo = 'entrada'
                  THEN mi.cantidad

                WHEN mi.tipo = 'salida'
                  THEN -mi.cantidad

                ELSE 0

              END
            ),
            0
          )::numeric(12,2)
            AS stock_actual

        FROM productos_inventario pi

        LEFT JOIN movimientos_inventario mi
          ON mi.producto_id = pi.id

        WHERE pi.finca_id = $1
          AND pi.activo = TRUE

        GROUP BY
          pi.id,
          pi.nombre,
          pi.categoria,
          pi.unidad,
          pi.stock_minimo

        ORDER BY

          CASE
            WHEN COALESCE(
              SUM(
                CASE
                  WHEN mi.tipo = 'entrada'
                    THEN mi.cantidad

                  WHEN mi.tipo = 'salida'
                    THEN -mi.cantidad

                  ELSE 0
                END
              ),
              0
            ) <= pi.stock_minimo
              THEN 0

            ELSE 1
          END,

          pi.nombre ASC

        LIMIT 50
      `,
    [fincaId],
  );

  const productos = resultado.rows.map((producto) => {
    const stockActual = Number(producto.stock_actual || 0);

    const stockMinimo = Number(producto.stock_minimo || 0);

    let estadoStock = "normal";

    if (stockActual <= 0) {
      estadoStock = "agotado";
    } else if (stockActual <= stockMinimo) {
      estadoStock = "bajo";
    }

    return {
      id: producto.id,

      nombre: producto.nombre,

      categoria: producto.categoria,

      unidad: producto.unidad,

      stock_actual: stockActual,

      stock_minimo: stockMinimo,

      estado_stock: estadoStock,
    };
  });

  const totales = await pool.query(`
    WITH existencias AS (
      SELECT pi.id, pi.stock_minimo,
        COALESCE(SUM(CASE WHEN mi.tipo = 'entrada' THEN mi.cantidad
          WHEN mi.tipo = 'salida' THEN -mi.cantidad ELSE 0 END), 0) AS stock_actual
      FROM productos_inventario pi
      LEFT JOIN movimientos_inventario mi ON mi.producto_id = pi.id
      WHERE pi.finca_id = $1 AND pi.activo = TRUE
      GROUP BY pi.id, pi.stock_minimo
    )
    SELECT COUNT(*)::int AS productos_activos,
      COUNT(*) FILTER (WHERE stock_actual > 0 AND stock_actual <= stock_minimo)::int AS stock_bajo,
      COUNT(*) FILTER (WHERE stock_actual <= 0)::int AS agotados
    FROM existencias
  `, [fincaId]);

  return {
    resumen: {
      ...totales.rows[0],
      registros_mostrados: productos.length,
      detalle_completo: totales.rows[0].productos_activos === productos.length,
    },

    productos,
  };
};

// ==========================================
// BUSCAR ANIMAL MENCIONADO EN UNA PREGUNTA
// ==========================================

export const detectarAnimalEnPregunta = async (fincaId, pregunta) => {
  const resultado = await pool.query(
    `
      SELECT
        id,
        identificacion,
        nombre

      FROM animales

      WHERE finca_id = $1
    `,
    [fincaId],
  );

  const texto = pregunta.toLowerCase().trim();

  // Primero intenta encontrar el nombre.
  const porNombre = resultado.rows.find(
    (animal) => animal.nombre && texto.includes(animal.nombre.toLowerCase()),
  );

  if (porNombre) {
    return porNombre;
  }

  // Luego intenta identificación.
  const porIdentificacion = resultado.rows.find(
    (animal) =>
      animal.identificacion &&
      texto.includes(animal.identificacion.toLowerCase()),
  );

  return porIdentificacion || null;
};
