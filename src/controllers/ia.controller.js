import {
  consultarAnimal,
  consultarPesajesAnimal,
  consultarSaludAnimal,
  consultarReproduccionAnimal,
  consultarLecheAnimal,
  consultarAlertasFinca,
  consultarResumenFinca,
} from "../services/ia/ganatecTools.service.js";

import { sincronizarAlertasFinca } from "../services/alertas.service.js";

import { construirContextoIA } from "../services/ia/contextoIA.service.js";

import { generarRespuestaIA } from "../services/ia/openai.service.js";

// ==========================================
// CONTEXTO COMPLETO DE UN ANIMAL
// ==========================================

export const contextoAnimalIA = async (req, res) => {
  const fincaId = req.usuario.finca_id;

  const termino = req.params.termino?.trim();

  if (!termino) {
    return res.status(400).json({
      ok: false,
      message: "Debe indicar el animal que desea consultar",
    });
  }

  try {
    // Actualizar alertas antes de construir contexto.
    await sincronizarAlertasFinca(fincaId);

    // Buscar animal dentro de la finca del usuario.
    const animal = await consultarAnimal(fincaId, termino);

    if (!animal) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró el animal en esta finca",
      });
    }

    // Consultas independientes en paralelo.
    const [pesajes, salud, reproduccion, leche, alertasFinca] =
      await Promise.all([
        consultarPesajesAnimal(fincaId, animal.id),

        consultarSaludAnimal(fincaId, animal.id),

        consultarReproduccionAnimal(fincaId, animal.id),

        consultarLecheAnimal(fincaId, animal.id),

        consultarAlertasFinca(fincaId),
      ]);

    // Solo alertas relacionadas con este animal.
    const alertasAnimal = alertasFinca.filter(
      (alerta) =>
        alerta.entidad_tipo === "animal" &&
        Number(alerta.entidad_id) === Number(animal.id),
    );

    // Último pesaje.
    const ultimoPesaje = pesajes.length > 0 ? pesajes[0] : null;

    // Eventos de salud todavía abiertos.
    const saludActiva = salud.filter((evento) => evento.estado === "abierto");

    // Gestación actualmente activa.
    const gestacionActiva =
      reproduccion.find((item) => item.estado_gestacion === "activa") || null;

    // Lactancia actualmente activa.
    const lactanciaActiva =
      leche.find((item) => item.estado === "activa") || null;

    return res.status(200).json({
      ok: true,

      contexto_tipo: "animal",

      animal,

      resumen: {
        ultimo_peso_kg: ultimoPesaje ? Number(ultimoPesaje.peso_kg) : null,

        eventos_salud_abiertos: saludActiva.length,

        tiene_gestacion_activa: Boolean(gestacionActiva),

        tiene_lactancia_activa: Boolean(lactanciaActiva),

        alertas_pendientes: alertasAnimal.length,
      },

      pesajes,

      salud,

      reproduccion,

      leche,

      alertas: alertasAnimal,
    });
  } catch (error) {
    console.error("ERROR CONTEXTO IA ANIMAL:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al construir el contexto del animal",
    });
  }
};

// ==========================================
// CONTEXTO GENERAL DE LA FINCA
// ==========================================

export const contextoFincaIA = async (req, res) => {
  const fincaId = req.usuario.finca_id;

  if (!fincaId) {
    return res.status(400).json({
      ok: false,
      message: "El usuario no tiene una finca asociada",
    });
  }

  try {
    // Mantener alertas actualizadas.
    await sincronizarAlertasFinca(fincaId);

    const [resumen, alertas] = await Promise.all([
      consultarResumenFinca(fincaId),

      consultarAlertasFinca(fincaId),
    ]);

    const criticas = alertas.filter((alerta) => alerta.prioridad === "critica");

    const altas = alertas.filter((alerta) => alerta.prioridad === "alta");

    const medias = alertas.filter((alerta) => alerta.prioridad === "media");

    let estadoGeneral = "estable";

    if (criticas.length > 0) {
      estadoGeneral = "requiere_atencion";
    } else if (altas.length > 0) {
      estadoGeneral = "atencion";
    } else if (medias.length > 0) {
      estadoGeneral = "seguimiento";
    }

    return res.status(200).json({
      ok: true,

      contexto_tipo: "finca",

      estado_general: estadoGeneral,

      resumen,

      alertas: {
        total: alertas.length,

        criticas: criticas.length,

        altas: altas.length,

        medias: medias.length,

        items: alertas,
      },
    });
  } catch (error) {
    console.error("ERROR CONTEXTO IA FINCA:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al construir el contexto de la finca",
    });
  }
};

// ==========================================
// PREGUNTAR AL COPILOTO GANATEC
// ==========================================

export const preguntarIA = async (req, res) => {
  const fincaId = req.usuario.finca_id;

  const usuarioId = req.usuario.id;

  const rol = req.usuario.rol;

  const { pregunta, historial = [] } = req.body;

  if (!pregunta || !pregunta.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Debe escribir una pregunta",
    });
  }

  if (pregunta.trim().length > 500) {
    return res.status(400).json({
      ok: false,
      message: "La pregunta es demasiado extensa",
    });
  }

  /* =========================================================
   HISTORIAL RECIENTE DE LA CONVERSACIÓN
========================================================= */

  const historialSeguro = Array.isArray(historial)
    ? historial
        .filter(
          (mensaje) =>
            mensaje &&
            ["usuario", "ia"].includes(mensaje.tipo) &&
            typeof mensaje.contenido === "string",
        )
        .slice(-8)
        .map((mensaje) => ({
          tipo: mensaje.tipo,

          contenido: mensaje.contenido.trim().slice(0, 1000),
        }))
    : [];

  try {
    // ======================================
    // 1. CONTEXTO SEGURO
    // ======================================

    const contexto = await construirContextoIA(
      fincaId,
      pregunta.trim(),
      rol,
      historialSeguro,
    );

    
    // ======================================
    // 2. MODELO DE IA
    // ======================================

    const respuesta =
  await generarRespuestaIA({

    pregunta:
      pregunta.trim(),

    contexto,

    historial:
      historialSeguro

  });

    return res.status(200).json({
      ok: true,

      pregunta: pregunta.trim(),

      alcance: contexto.alcance,

      respuesta,

      metadata: {
        usuario_id: usuarioId,

        finca_id: fincaId,

        modelo: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      },
    });
  } catch (error) {
    console.error("ERROR COPILOTO IA:", error);

    // Error de autenticación de OpenAI
    if (error.status === 401) {
      return res.status(500).json({
        ok: false,
        message: "La configuración del servicio de IA no es válida",
      });
    }

    // Límite o cuota
    if (error.status === 429) {
      return res.status(503).json({
        ok: false,
        message: "El servicio de IA está temporalmente limitado",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "No fue posible generar la respuesta del asistente",
    });
  }
};
