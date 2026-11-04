import type { ElementoPlano } from "../evacuacion";
import { ambienteDe } from "../discoteca/comun";
import { nombreDePlanta } from "./geometria";
import type { Simulacion } from "./motor";
import { CELDA, centroDe, type Campo, type Rejilla } from "./rejilla";

/**
 * La revisión de lo que pide un plan de evacuación.
 *
 * ## Es referencial
 *
 * Los criterios salen del Reglamento Nacional de Edificaciones (norma A.130,
 * «Requisitos de seguridad») y de la NTP 350.043-1 para extintores, en sus
 * valores más usados. Sirven para detectar problemas antes de la inspección, no
 * para aprobarla: quien certifica es la inspección técnica de seguridad (ITSE)
 * con la norma vigente en la mano, y ahí pueden pesar cosas que este plano no
 * sabe (materiales, rociadores, iluminación real, señalética instalada).
 */

export type Veredicto = "cumple" | "no_cumple" | "revisar";

export type Comprobacion = {
  titulo: string;
  veredicto: Veredicto;
  detalle: string;
  referencia: string;
};

/** Distancia máxima de recorrido hasta una salida, sin rociadores (A.130). */
export const RECORRIDO_MAXIMO = 45;
/** Ancho de salida por persona evacuada (A.130). */
const ANCHO_POR_PERSONA = 0.005;
/** Ancho mínimo libre de una puerta de evacuación. */
const ANCHO_MINIMO_PUERTA = 1.0;
/** Distancia máxima hasta un extintor (NTP 350.043-1, riesgo moderado). */
const DISTANCIA_A_EXTINTOR = 20;

export function revisar(
  rejilla: Rejilla,
  campo: Campo,
  elementos: ElementoPlano[],
  simulacion: Simulacion | null,
  objetivoSegundos: number,
): Comprobacion[] {
  const lista: Comprobacion[] = [];
  const zonasConGente = rejilla.zonas.filter((z) => z.aforo > 0);

  // ── 1. Recorrido máximo ─────────────────────────────────────────
  let maximo = 0;
  let celdaPeor = -1;
  for (let g = 0; g < campo.distancia.length; g++) {
    if (rejilla.zonaDe[g] < 0 || !rejilla.transitable[g]) continue;
    const d = campo.distancia[g];
    if (Number.isFinite(d) && d > maximo) {
      maximo = d;
      celdaPeor = g;
    }
  }
  const peor = celdaPeor >= 0 ? rejilla.zonas[rejilla.zonaDe[celdaPeor]] : null;
  lista.push({
    titulo: "Distancia de recorrido hasta una salida",
    veredicto: maximo <= RECORRIDO_MAXIMO ? "cumple" : "no_cumple",
    detalle: `El punto más alejado está a ${maximo.toFixed(1)} m caminando${peor ? ` (en ${peor.nombre})` : ""}; el máximo es ${RECORRIDO_MAXIMO} m sin rociadores.`,
    referencia: "RNE A.130 · recorrido de evacuación",
  });

  // ── 2. Zonas sin camino ─────────────────────────────────────────
  let aisladas = 0;
  for (let g = 0; g < campo.distancia.length; g++) {
    if (rejilla.zonaDe[g] >= 0 && rejilla.transitable[g] && !Number.isFinite(campo.distancia[g])) aisladas++;
  }
  lista.push({
    titulo: "Todas las zonas tienen camino a una salida",
    veredicto: aisladas === 0 ? "cumple" : "no_cumple",
    detalle:
      aisladas === 0
        ? "Desde cualquier punto con público se llega a alguna salida."
        : `${Math.round(aisladas * CELDA * CELDA)} m² sin camino a ninguna salida.`,
    referencia: "RNE A.130 · medios de evacuación",
  });

  // ── 3. Dos salidas por planta ───────────────────────────────────
  for (let piso = 0; piso < rejilla.plantas; piso++) {
    const conGente = zonasConGente.some((z) => (z.piso ?? 0) === piso);
    if (!conGente) continue;
    const propias = rejilla.salidas.filter((s) => s.piso === piso).length;
    const escaleras = piso > 0 ? rejilla.escaleras.length : 0;
    const alternativas = propias + escaleras;
    lista.push({
      titulo: `Salidas alternativas · ${nombreDePlanta(piso)}`,
      veredicto: alternativas >= 2 ? "cumple" : "no_cumple",
      detalle:
        piso === 0
          ? `${propias} salidas al exterior.`
          : `${propias} escaleras de emergencia propias${escaleras ? ` y ${escaleras} escalera interior` : ""}.`,
      referencia: "RNE A.130 · número de salidas",
    });
  }

  // ── 4. Ancho de cada salida ─────────────────────────────────────
  if (simulacion) {
    for (const s of simulacion.porSalida) {
      const salida = rejilla.salidas[s.indice];
      const necesario = Math.max(ANCHO_MINIMO_PUERTA, s.personas * ANCHO_POR_PERSONA);
      lista.push({
        titulo: `Ancho de «${s.nombre}»`,
        veredicto: salida.puerta.ancho + 1e-6 >= necesario ? "cumple" : "no_cumple",
        detalle: `Mide ${salida.puerta.ancho.toFixed(2)} m y por ella salen ${s.personas} personas: hacen falta ${necesario.toFixed(2)} m (${ANCHO_POR_PERSONA} m por persona, mínimo ${ANCHO_MINIMO_PUERTA.toFixed(2)} m).`,
        referencia: "RNE A.130 · cálculo de ancho de salidas",
      });
    }
  }

  // ── 5. Tiempo de evacuación ─────────────────────────────────────
  if (simulacion?.terminada) {
    const t = simulacion.tiempoTotal ?? Infinity;
    lista.push({
      titulo: "Tiempo de evacuación",
      veredicto: simulacion.atrapadas > 0 ? "no_cumple" : t <= objetivoSegundos ? "cumple" : "revisar",
      detalle:
        simulacion.atrapadas > 0
          ? `${simulacion.atrapadas} personas no consiguieron salir.`
          : `Salieron todos en ${Math.round(t)} s; el objetivo fijado es ${objetivoSegundos} s.`,
      referencia: "Objetivo de diseño del plan (configurable)",
    });
  }

  // ── 6. Extintores ───────────────────────────────────────────────
  const extintores = elementos.filter((e) => e.tipo === "EXTINTOR");
  let cubiertas = 0;
  let total = 0;
  for (let g = 0; g < campo.distancia.length; g++) {
    if (rejilla.zonaDe[g] < 0 || !rejilla.transitable[g]) continue;
    total++;
    const c = centroDe(rejilla, g);
    if (extintores.some((e) => (e.piso ?? 0) === c.piso && Math.hypot(e.x - c.x, e.y - c.y) <= DISTANCIA_A_EXTINTOR)) cubiertas++;
  }
  const cobertura = total === 0 ? 0 : Math.round((cubiertas / total) * 100);
  lista.push({
    titulo: "Extintores al alcance",
    veredicto: extintores.length === 0 ? "no_cumple" : cobertura >= 100 ? "cumple" : cobertura >= 90 ? "revisar" : "no_cumple",
    detalle: `${extintores.length} extintores; el ${cobertura} % del local tiene uno a ${DISTANCIA_A_EXTINTOR} m o menos.`,
    referencia: "NTP 350.043-1 · distribución de extintores",
  });

  // ── 7. Luces de emergencia en las salidas ───────────────────────
  const luces = elementos.filter((e) => e.tipo === "LUZ_EMERGENCIA");
  const sinLuz = rejilla.salidas.filter(
    (s) => !luces.some((l) => (l.piso ?? 0) === s.piso && Math.hypot(l.x - s.puerta.x, l.y - s.puerta.y) <= 3),
  );
  lista.push({
    titulo: "Luz de emergencia en cada salida",
    veredicto: sinLuz.length === 0 ? "cumple" : "no_cumple",
    detalle:
      sinLuz.length === 0
        ? `Las ${rejilla.salidas.length} salidas tienen una luz de emergencia a 3 m o menos.`
        : `Sin luz de emergencia cerca: ${sinLuz.map((s) => s.puerta.nombre).join(", ")}.`,
    referencia: "RNE A.130 · iluminación de emergencia",
  });

  // ── 8. Punto de reunión ─────────────────────────────────────────
  const reunion = elementos.filter((e) => e.tipo === "PUNTO_REUNION");
  const fuera = reunion.filter((e) => e.x < 0 || e.y < 0 || e.x > rejilla.ancho || e.y > rejilla.fondo);
  lista.push({
    titulo: "Punto de reunión exterior",
    veredicto: fuera.length > 0 ? "cumple" : "no_cumple",
    detalle:
      fuera.length > 0
        ? `${fuera.map((e) => e.nombre).join(" · ")}.`
        : reunion.length > 0
          ? "Hay un punto de reunión, pero está dentro del edificio: tiene que estar fuera, a distancia de la fachada."
          : "No hay ningún punto de reunión marcado.",
    referencia: "Plan de seguridad · zonas de reunión",
  });

  // ── 9. Zonas seguras en sismo ───────────────────────────────────
  const seguras = elementos.filter((e) => e.tipo === "ZONA_SEGURA");
  const sinZonaSegura = zonasConGente.filter(
    (z) =>
      ambienteDe(z, rejilla.zonas) !== "escalera" &&
      !seguras.some(
        (s) =>
          (s.piso ?? 0) === (z.piso ?? 0) &&
          s.x >= z.x - 5 &&
          s.x <= z.x + z.ancho + 5 &&
          s.y >= z.y - 5 &&
          s.y <= z.y + z.fondo + 5,
      ),
  );
  lista.push({
    titulo: "Zonas seguras en caso de sismo",
    veredicto: seguras.length === 0 ? "no_cumple" : sinZonaSegura.length === 0 ? "cumple" : "revisar",
    detalle:
      sinZonaSegura.length === 0
        ? `${seguras.length} zonas seguras señalizadas; todas las zonas con público tienen una cerca.`
        : `Sin zona segura cerca: ${sinZonaSegura.map((z) => z.nombre).join(", ")}.`,
    referencia: "INDECI · señalización de zonas seguras",
  });

  // ── 10. Botiquín y alarma ───────────────────────────────────────
  const botiquines = elementos.filter((e) => e.tipo === "BOTIQUIN").length;
  const alarmas = elementos.filter((e) => e.tipo === "ALARMA").length;
  lista.push({
    titulo: "Botiquín y pulsadores de alarma",
    veredicto: botiquines > 0 && alarmas > 0 ? "cumple" : "no_cumple",
    detalle: `${botiquines} botiquines y ${alarmas} pulsadores de alarma.`,
    referencia: "Plan de seguridad · primeros auxilios y alarma",
  });

  return lista;
}

export function resumenDe(lista: Comprobacion[]): { cumple: number; noCumple: number; revisar: number } {
  return {
    cumple: lista.filter((c) => c.veredicto === "cumple").length,
    noCumple: lista.filter((c) => c.veredicto === "no_cumple").length,
    revisar: lista.filter((c) => c.veredicto === "revisar").length,
  };
}
