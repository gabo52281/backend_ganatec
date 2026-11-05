import {
  detectarAnimalEnPregunta,
  consultarAnimal,
  consultarPesajesAnimal,
  consultarSaludAnimal,
  consultarReproduccionAnimal,
  consultarLecheAnimal,
  consultarProduccionLecheFinca,
  consultarAlertasFinca,
  consultarResumenFinca,
  consultarFinanzasFinca,
  consultarPotrerosLotesFinca,
  consultarSaludReproduccionFinca,
  consultarUbicacionAnimal,
  consultarInventarioFinca,
  consultarAnimalesFinca,
} from "./ganatecTools.service.js";

import {
  sincronizarAlertasFinca,
} from "../alertas.service.js";


/* =========================================================
   NORMALIZAR TEXTO
========================================================= */

const normalizarPregunta = (
  texto = ""
) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim();


/* =========================================================
   DETECTAR MÓDULOS
========================================================= */

const detectarModulosPregunta = (
  pregunta
) => {

  const texto =
    normalizarPregunta(
      pregunta
    );

  const modulos =
    new Set();


  const contiene = (
    palabras
  ) =>
    palabras.some(
      (palabra) =>
        texto.includes(
          palabra
        )
    );


  /* Finanzas */
  if (
    contiene([
      "dinero",
      "finanza",
      "finanzas",
      "ingreso",
      "ingresos",
      "gasto",
      "gastos",
      "balance",
      "venta",
      "ventas",
      "precio",
      "ganancia",
      "ganancias",
      "costo",
      "costos",
      "utilidad",
      "utilidades",
    ])
  ) {

    modulos.add(
      "finanzas"
    );

  }


  /* Producción de leche */
  if (
    contiene([
      "leche",
      "litro",
      "litros",
      "ordeno",
      "ordenos",
      "produccion",
      "lactancia",
    ])
  ) {

    modulos.add(
      "leche"
    );

  }


  /* Potreros, lotes y ubicación */
  if (
    contiene([
      "potrero",
      "potreros",
      "lote",
      "lotes",
      "pasto",
      "pastoreo",
      "ubicacion",
      "ubicado",
      "ubicada",
      "donde esta",
      "donde se encuentra",
      "en que potrero",
      "que potrero",
    ])
  ) {

    modulos.add(
      "potreros_lotes"
    );

  }


  /* Pesajes */
  if (
    contiene([
      "peso",
      "pesa",
      "pesaje",
      "pesajes",
      "kilogramo",
      "kilogramos",
      "kg",
    ])
  ) {

    modulos.add(
      "pesajes"
    );

  }


  /* Salud */
  if (
    contiene([
      "salud",
      "enfermo",
      "enferma",
      "enfermedad",
      "tratamiento",
      "tratamientos",
      "medicamento",
      "medicamentos",
      "dosis",
      "antibiotico",
      "antibioticos",
      "vacuna",
      "vacunas",
      "veterinario",
      "veterinaria",
    ])
  ) {

    modulos.add(
      "salud"
    );

  }


  /* Reproducción */
  if (
    contiene([
      "reproduccion",
      "reproductor",
      "reproductores",
      "reproductora",
      "gestacion",
      "gestante",
      "prenada",
      "prenez",
      "embarazo",
      "parto",
      "partos",
      "cria",
      "crias",
      "inseminacion",
      "servicio reproductivo",
      "monta",
      "semen",
      "toro",
      "semental",
    ])
  ) {

    modulos.add(
      "reproduccion"
    );

  }


  /* Animales */
  if (
    contiene([
      "cuantos animales",
      "cuantas animales",
      "que animales",
      "cuales animales",
      "animales tengo",
      "animales registrados",
      "animal registrado",
      "hembras",
      "machos",
      "raza",
      "razas",
      "ganado",
    ])
  ) {

    modulos.add(
      "animales"
    );

  }


  /* Inventario */
  if (
    contiene([
      "inventario",
      "stock",
      "insumo",
      "insumos",
      "producto",
      "productos",
      "agotado",
      "agotados",
      "existencia",
      "existencias",
      "reponer",
    ])
  ) {

    modulos.add(
      "inventario"
    );

  }


  /* Alertas */
  if (
    contiene([
      "alerta",
      "alertas",
      "urgente",
      "critico",
      "critica",
      "pendiente",
      "prioridad",
    ])
  ) {

    modulos.add(
      "alertas"
    );

  }


  /* Resumen general de la finca */
  const esPreguntaGeneral =
    contiene([
      "como va la finca",
      "como esta la finca",
      "estado de la finca",
      "resumen general",
      "situacion de la finca",
      "como estamos",
      "estado general",
      "rendimiento de mi finca",
      "analiza mi finca",
      "analiza la finca",
      "que debo mejorar en mi finca",
      "como va mi finca",
      "recomendaciones para mi finca",
      "informe de la finca",
    ]);


  if (
    esPreguntaGeneral
  ) {

    return new Set([
      "general",
    ]);

  }


  /* Conocimiento general */
  if (
    modulos.size === 0
  ) {

    return new Set([
      "conocimiento_general",
    ]);

  }


  return modulos;

};


/* =========================================================
   DETECTAR PREGUNTA DE SEGUIMIENTO
========================================================= */

const esPreguntaSeguimientoConversacional = (
  pregunta
) => {

  const texto =
    normalizarPregunta(
      pregunta
    );


  if (
    !texto
  ) {

    return false;

  }


  const comienzaConSeguimiento = [
    "y ",
    "tambien ",
    "ademas ",
    "entonces ",
    "pero ",
    "cuando fue",
    "quien fue",
    "quien es",
    "cual fue",
    "cual es",
    "cuanto ",
    "cuanta ",
    "cuantos ",
    "cuantas ",
    "donde ",
    "como fue",
    "por que ",
  ].some(
    (frase) =>
      texto.startsWith(
        frase
      )
  );


  const contieneReferencia = [
    "ese ",
    "esa ",
    "eso ",
    "este ",
    "esta ",
    "ellos",
    "ellas",
    "el mismo",
    "la misma",
    "se utilizo",
    "le aplicaron",
    "le dieron",
    "recibio",
    "tuvo ",
    "que paso despues",
    "y despues",
    "en que potrero",
    "que potrero",

    "dame mas informacion",
    "mas informacion",
    "dame informacion",
    "dame mas detalles",
    "profundiza",
    "amplia la respuesta",
    "dame un analisis",
    "dame detalles",
    "mas detalles",
    "explicame mas",
    "cuentame mas",
    "hablame de ellos",
    "hablame de ellas",
    "cuales son",
    "quienes son",
    "muestramelos",
    "muestramelas",
  ].some(
    (frase) =>
      texto.includes(
        frase
      )
  );


  return (
    comienzaConSeguimiento
    ||
    contieneReferencia
  );

};


/* =========================================================
   HEREDAR MÓDULO DE LA CONVERSACIÓN
========================================================= */

const resolverModulosConversacion = (
  pregunta,
  historial = []
) => {

  const modulosActuales =
    detectarModulosPregunta(
      pregunta
    );


  /*
    Si la pregunta actual ya identifica
    un módulo, no necesitamos heredar nada.
  */
  if (
    !modulosActuales.has(
      "conocimiento_general"
    )
  ) {

    return {

      modulos:
        modulosActuales,

      heredado:
        false,

    };

  }


  /*
    Una pregunta nueva de conocimiento general
    no debe heredar automáticamente el tema anterior.
  */
  if (
    !esPreguntaSeguimientoConversacional(
      pregunta
    )
  ) {

    return {

      modulos:
        modulosActuales,

      heredado:
        false,

    };

  }


  if (
    !Array.isArray(
      historial
    )
    ||
    historial.length === 0
  ) {

    return {

      modulos:
        modulosActuales,

      heredado:
        false,

    };

  }


  const mensajesUsuario =
    [...historial]
      .reverse()
      .filter(
        (mensaje) =>
          mensaje.tipo ===
            "usuario"
          &&
          mensaje.contenido
      );


  for (
    const mensaje
    of mensajesUsuario
  ) {

    const modulosAnteriores =
      detectarModulosPregunta(
        mensaje.contenido
      );


    const modulosEspecificos =
      new Set(
        [
          ...modulosAnteriores,
        ].filter(
          (modulo) =>
            modulo !==
              "conocimiento_general"
        )
      );


    if (
      modulosEspecificos.size >
      0
    ) {

      return {

        modulos:
          modulosEspecificos,

        heredado:
          true,

      };

    }

  }


  return {

    modulos:
      modulosActuales,

    heredado:
      false,

  };

};


/* =========================================================
   PREGUNTAS RECIENTES DEL USUARIO
========================================================= */

const obtenerPreguntasRecientes = (
  historial = []
) => {

  if (
    !Array.isArray(
      historial
    )
  ) {

    return [];

  }


  return historial
    .filter(
      (mensaje) =>
        mensaje.tipo ===
          "usuario"
        &&
        mensaje.contenido
    )
    .slice(
      -3
    )
    .map(
      (mensaje) =>
        mensaje.contenido
    );

};


/* =========================================================
   CONSTRUIR CONTEXTO PARA UNA PREGUNTA
========================================================= */

export const construirContextoIA = async (
  fincaId,
  pregunta,
  rol,
  historial = [],
) => {

  const esAdministrador =
    rol ===
    "administrador";


  /* Mantener alertas actualizadas */
  await sincronizarAlertasFinca(
    fincaId
  );


  /* =========================================================
     RESOLVER MÓDULO ACTUAL O HEREDADO
  ========================================================= */

  const {
    modulos:
      modulosPregunta,

    heredado:
      moduloHeredado,

  } =
    resolverModulosConversacion(
      pregunta,
      historial
    );


  /* =========================================================
     DETECTAR ANIMAL ACTUAL
  ========================================================= */

  let animalDetectado =
    await detectarAnimalEnPregunta(
      fincaId,
      pregunta
    );


  let animalHeredado =
    false;


  const textoPreguntaActual =
    normalizarPregunta(
      pregunta
    );


  /*
    Si hablamos de varios animales,
    no heredamos un animal individual.
  */
  const esConsultaColectivaAnimales =
    modulosPregunta.has(
      "animales"
    )
    ||
    [
      "animales",
      "machos",
      "hembras",
      "ganado",
      "animales activos",
      "animales vendidos",
      "animales registrados",
    ].some(
      (termino) =>
        textoPreguntaActual.includes(
          termino
        )
    );


  /*
    Recuperar animal anterior solamente
    cuando la pregunta sea una continuación.
  */
  if (
    !animalDetectado
    &&
    !esConsultaColectivaAnimales
    &&
    esPreguntaSeguimientoConversacional(
      pregunta
    )
    &&
    Array.isArray(
      historial
    )
    &&
    historial.length > 0
  ) {

    const mensajesUsuario =
      [...historial]
        .reverse()
        .filter(
          (mensaje) =>
            mensaje.tipo ===
              "usuario"
            &&
            mensaje.contenido
        );


    for (
      const mensaje
      of mensajesUsuario
    ) {

      const animalAnterior =
        await detectarAnimalEnPregunta(
          fincaId,
          mensaje.contenido
        );


      if (
        animalAnterior
      ) {

        animalDetectado =
          animalAnterior;

        animalHeredado =
          true;

        break;

      }

    }

  }


  /* =========================================================
     CONTEXTO RECIENTE
  ========================================================= */

  const preguntasRecientes =
    obtenerPreguntasRecientes(
      historial
    );


  const incluirContextoConversacion =
    (
      animalHeredado
      ||
      moduloHeredado
    )
    &&
    preguntasRecientes.length > 0;


  /* =========================================================
     PREGUNTA SOBRE UN ANIMAL
  ========================================================= */

  if (
    animalDetectado
  ) {

    const animal =
      await consultarAnimal(
        fincaId,
        animalDetectado.id
      );


    const textoPregunta =
      normalizarPregunta(
        pregunta
      );


    const esPreguntaGeneralAnimal =
      modulosPregunta.has(
        "conocimiento_general"
      )
      &&
      (
        textoPregunta.includes(
          "como va"
        )
        ||
        textoPregunta.includes(
          "como esta"
        )
        ||
        textoPregunta.includes(
          "estado de"
        )
      );


    const esGeneral =
      modulosPregunta.has(
        "general"
      )
      ||
      esPreguntaGeneralAnimal
      ||
      (
        animalHeredado
        && modulosPregunta.has("conocimiento_general")
        && esPreguntaSeguimientoConversacional(pregunta)
      );


    const consultarPesajes =
      esGeneral
      ||
      modulosPregunta.has(
        "pesajes"
      );


    const consultarSalud =
      esGeneral
      ||
      modulosPregunta.has(
        "salud"
      );


    const consultarReproduccion =
      esGeneral
      ||
      modulosPregunta.has(
        "reproduccion"
      );


    const consultarLeche =
      esGeneral
      ||
      modulosPregunta.has(
        "leche"
      );


    const consultarUbicacion =
      esGeneral
      ||
      modulosPregunta.has(
        "potreros_lotes"
      );


    const consultarAlertas =
      esGeneral
      ||
      modulosPregunta.has(
        "alertas"
      );


    const [
      pesajes,
      salud,
      reproduccion,
      leche,
      ubicacion,
      alertasFinca,
    ] =
      await Promise.all([

        consultarPesajes
          ? consultarPesajesAnimal(
              fincaId,
              animal.id
            )
          : Promise.resolve(
              []
            ),


        consultarSalud
          ? consultarSaludAnimal(
              fincaId,
              animal.id
            )
          : Promise.resolve(
              []
            ),


        consultarReproduccion
          ? consultarReproduccionAnimal(
              fincaId,
              animal.id
            )
          : Promise.resolve(
              []
            ),


        consultarLeche
          ? consultarLecheAnimal(
              fincaId,
              animal.id
            )
          : Promise.resolve(
              []
            ),


        consultarUbicacion
          ? consultarUbicacionAnimal(
              fincaId,
              animal.id
            )
          : Promise.resolve(
              null
            ),


        consultarAlertas
          ? consultarAlertasFinca(
              fincaId
            )
          : Promise.resolve(
              []
            ),

      ]);


    const alertas =
      alertasFinca.filter(
        (alerta) =>
          alerta.entidad_tipo ===
            "animal"
          &&
          Number(
            alerta.entidad_id
          ) ===
            Number(
              animal.id
            )
      );


    return {

      alcance:
        "animal",

      animal,


      ...(incluirContextoConversacion && {

        contexto_conversacion: {

          preguntas_recientes:
            preguntasRecientes,

        },

      }),


      ...(consultarPesajes && {
        pesajes,
      }),


      ...(consultarSalud && {
        salud,
      }),


      ...(consultarReproduccion && {
        reproduccion,
      }),


      ...(consultarLeche && {
        leche,
      }),


      ...(consultarUbicacion && {
        ubicacion,
      }),


      ...(consultarAlertas && {
        alertas,
      }),

    };

  }


  /* =========================================================
     PREGUNTA GENERAL SOBRE LA FINCA
  ========================================================= */

  const esGeneral =
    modulosPregunta.has(
      "general"
    );


  const consultarResumen =
    esGeneral
    ||
    modulosPregunta.has(
      "animales"
    );


  const consultarAnimales =
    modulosPregunta.has(
      "animales"
    );


  const consultarInventario =
    esGeneral
    ||
    modulosPregunta.has(
      "inventario"
    );


  const consultarLeche =
    esGeneral
    ||
    modulosPregunta.has(
      "leche"
    );


  const consultarFinanzas =
    esAdministrador
    &&
    (
      esGeneral
      ||
      modulosPregunta.has(
        "finanzas"
      )
    );


  const consultarPotreros =
    esGeneral
    ||
    modulosPregunta.has(
      "potreros_lotes"
    );


  const consultarSaludReproduccion =
    esGeneral
    ||
    modulosPregunta.has(
      "salud"
    )
    ||
    modulosPregunta.has(
      "reproduccion"
    );


  const consultarAlertas =
    esGeneral
    ||
    modulosPregunta.has(
      "alertas"
    );


  const [
    resumen,
    animales,
    produccionLeche,
    finanzas,
    potrerosLotes,
    saludReproduccion,
    inventario,
    alertas,
  ] =
    await Promise.all([

      consultarResumen
        ? consultarResumenFinca(
            fincaId
          )
        : Promise.resolve(
            null
          ),


      consultarAnimales
        ? consultarAnimalesFinca(
            fincaId
          )
        : Promise.resolve(
            null
          ),


      consultarLeche
        ? consultarProduccionLecheFinca(
            fincaId
          )
        : Promise.resolve(
            null
          ),


      consultarFinanzas
        ? consultarFinanzasFinca(
            fincaId
          )
        : Promise.resolve(
            null
          ),


      consultarPotreros
        ? consultarPotrerosLotesFinca(
            fincaId
          )
        : Promise.resolve(
            null
          ),


      consultarSaludReproduccion
        ? consultarSaludReproduccionFinca(
            fincaId
          )
        : Promise.resolve(
            null
          ),


      consultarInventario
        ? consultarInventarioFinca(
            fincaId
          )
        : Promise.resolve(
            null
          ),


      consultarAlertas
        ? consultarAlertasFinca(
            fincaId
          )
        : Promise.resolve(
            []
          ),

    ]);


  return {

    alcance:
      "finca",


    ...(incluirContextoConversacion && {

      contexto_conversacion: {

        preguntas_recientes:
          preguntasRecientes,

      },

    }),


    ...(consultarResumen && {
      resumen,
    }),


    ...(consultarAnimales && {
      animales,
    }),


    ...(consultarLeche && {

      produccion_leche:
        produccionLeche,

    }),


    ...(consultarFinanzas && {
      finanzas,
    }),


    ...(consultarPotreros && {

      potreros_lotes:
        potrerosLotes,

    }),


    ...(
      saludReproduccion
      &&
      (
        esGeneral
        ||
        modulosPregunta.has(
          "salud"
        )
      )
      && {

        salud:
          saludReproduccion.salud,

      }
    ),


    ...(
      saludReproduccion
      &&
      (
        esGeneral
        ||
        modulosPregunta.has(
          "reproduccion"
        )
      )
      && {

        reproduccion:
          saludReproduccion.reproduccion,

      }
    ),


    ...(consultarInventario && {
      inventario,
    }),


    ...(consultarAlertas && {
      alertas,
    }),


    ...(
      !esAdministrador
      &&
      modulosPregunta.has(
        "finanzas"
      )
      && {

        restriccion:
          "El rol actual no tiene acceso a información financiera.",

      }
    ),

  };

};