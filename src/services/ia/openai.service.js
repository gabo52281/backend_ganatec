import OpenAI from "openai";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const normalizar = (texto = "") => String(texto).toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const pideAnalisis = (pregunta = "") =>
  /analiz|evalu|compar|profund|detall|informe|reporte|explic|recomend|tendencia|rendimiento|diagnostic|mejorar|resumen general|como va la finca|como esta la finca/
    .test(normalizar(pregunta));


export const generarRespuestaIA = async ({
  pregunta,
  contexto,
  historial = [],
}) => {

  /* =========================================================
   HISTORIAL RECIENTE
========================================================= */

const historialConversacion =
  Array.isArray(historial)
  &&
  historial.length > 0
    ? historial
        .slice(-8)
        .map(
          (mensaje) =>
            `${
              mensaje.tipo === "usuario"
                ? "Usuario"
                : "IA GANATEC"
            }: ${mensaje.contenido}`
        )
        .join("\n")
    : "Sin historial reciente.";

  const limiteInicial = pideAnalisis(pregunta) ? 2800 : 1200;

  const opciones = {

      model:
        process.env.OPENAI_MODEL
        || "gpt-5.6-luna",

      instructions: `
Eres el Copiloto Inteligente de GANATEC,
un sistema de gestión ganadera.

Tu función es ayudar al productor a comprender
su finca, analizar la información registrada
y brindar orientación práctica sobre manejo ganadero.

REGLAS IMPORTANTES:

1. Para afirmar información específica de la finca,
   utiliza únicamente los datos proporcionados
   en el contexto de GANATEC.

2. Nunca inventes animales, pesos, producción,
   movimientos financieros, fechas, potreros,
   tratamientos, gestaciones, alertas ni ningún
   otro dato específico de la finca.

3. Si el contexto no contiene un dato específico
   solicitado sobre la finca, indícalo claramente.

4. Puedes utilizar conocimiento general para
   responder preguntas educativas, explicar
   conceptos y ofrecer recomendaciones ganaderas.

5. Cuando combines datos de GANATEC con conocimiento
   general, distingue claramente entre:
   - información registrada en GANATEC;
   - análisis, estimaciones o recomendaciones.

6. Si realizas una estimación, explica brevemente
   qué factores pueden hacer que el resultado cambie.

7. No presentes recomendaciones generales como
   hechos comprobados de la finca.

8. Puedes analizar tendencias en pesos, producción,
   reproducción, salud, inventario, potreros y demás
   información disponible en el contexto.

9. No realices diagnósticos veterinarios definitivos
   ni prescribas tratamientos como sustituto de un
   profesional. Puedes explicar posibilidades,
   factores de riesgo y recomendar revisión veterinaria.

10. Si existen alertas críticas o altas relacionadas
    con la pregunta, dales prioridad en la respuesta.

11. Si el contexto contiene una restricción de acceso,
    respétala y no intentes inferir la información
    restringida.

12. Nunca afirmes tener acceso directo a la base de
    datos. Trabajas únicamente con el contexto que
    GANATEC te proporciona.

13. Adapta la extensión: responde brevemente preguntas sencillas, pero
    desarrolla análisis, detalles y comparaciones cuando sean necesarios.
    Incluye hallazgos y acciones prácticas, sin inventar información.

14. Responde siempre en español.

15. El historial reciente de la conversación se utiliza
    únicamente para comprender referencias conversacionales
    como "eso", "él", "ella", "¿por qué?", "¿y cuándo?",
    "¿y eso es bueno?" o preguntas que continúan el tema anterior.

16. El historial reciente NO es una fuente autorizada de datos
    de la finca. Los hechos sobre animales, reproducción, salud,
    inventario, finanzas, producción, fechas, tratamientos,
    medicamentos, potreros, lotes y demás registros deben
    confirmarse siempre con el CONTEXTO AUTORIZADO DE GANATEC.

17. Si una respuesta anterior de IA contradice el contexto
    autorizado actual de GANATEC, debes utilizar el contexto
    actual como fuente correcta, corregir la información anterior
    y no repetir el dato equivocado.
`,

     input: `
HISTORIAL RECIENTE DE LA CONVERSACIÓN:

${historialConversacion}


PREGUNTA ACTUAL DEL USUARIO:

${pregunta}


CONTEXTO AUTORIZADO DE GANATEC:

${JSON.stringify(contexto)}
`,

      max_output_tokens: limiteInicial

  };

  let response = await openai.responses.create(opciones);
  const seTrunco = (r) => r.status === "incomplete" &&
    r.incomplete_details?.reason === "max_output_tokens";
  if (seTrunco(response)) {
    response = await openai.responses.create({
      ...opciones,
      max_output_tokens: pideAnalisis(pregunta) ? 4200 : 2400,
    });
  }

  // Registrar solo métricas técnicas; no preguntas ni contenido privado.
  console.info("[GANATEC IA]", {
    estado: response.status,
    causa: response.incomplete_details?.reason ?? null,
    tokens_entrada: response.usage?.input_tokens ?? null,
    tokens_salida: response.usage?.output_tokens ?? null,
    tokens_razonamiento: response.usage?.output_tokens_details?.reasoning_tokens ?? null,
  });

  const texto = (response.output_text || "").trim();
  if (response.status === "completed" && texto) return texto;
  if (seTrunco(response) && texto) {
    return texto + "\n\n(Esta respuesta puede estar incompleta por el límite de salida.)";
  }
  throw new Error("La respuesta de IA no terminó correctamente: " +
    (response.incomplete_details?.reason || response.status));
};