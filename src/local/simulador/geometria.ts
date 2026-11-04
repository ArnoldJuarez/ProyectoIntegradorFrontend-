import { ambienteDe } from "../discoteca/comun";
import type { PuertaPlano, ZonaPlano } from "../evacuacion";

/**
 * La geometría que comparten el simulador, el plano y el 3D.
 *
 * Todo en coordenadas del plano: metros, origen en la esquina, `y` hacia la
 * calle. Lo que aquí es una pared es exactamente lo que el 3D dibuja como pared:
 * si no fuera así, la simulación mandaría a la gente a través de un muro que se
 * ve en pantalla.
 */

export type Segmento = { x0: number; y0: number; x1: number; y1: number; piso: number };

/** Ancho del hueco de entrada de una sala cerrada (el mismo que dibuja el 3D). */
export const HUECO_DE_SALA = 2.6;

/** Las salas que van cerradas con paredes: La Cueva, la coctelería, los baños. */
const CERRADAS = new Set(["cueva", "cocteleria", "banos"]);

type Lado = "n" | "s" | "o" | "e";

/**
 * Las paredes interiores de las salas cerradas, con su hueco de entrada.
 *
 * La entrada va en el lado que mira al centro del edificio, y los lados que
 * coinciden con la fachada no llevan pared propia (ya está el muro exterior).
 * Es la misma regla de `ParedesDeSala` en el 3D.
 */
export function paredesInteriores(zonas: ZonaPlano[], ancho: number, fondo: number): Segmento[] {
  // Un lado a menos de 1,2 m de la fachada se apoya en ella: no lleva pared
  // propia (si no, quedaría un pasillo de un metro tapando la salida).
  const tol = 1.2;
  const cx = ancho / 2;
  const cy = fondo / 2;
  const salida: Segmento[] = [];

  for (const z of zonas) {
    if (!CERRADAS.has(ambienteDe(z, zonas))) continue;
    const piso = z.piso ?? 0;
    const x0 = z.x;
    const x1 = z.x + z.ancho;
    const y0 = z.y;
    const y1 = z.y + z.fondo;

    const exteriores = new Set<Lado>();
    if (Math.abs(y0) < tol) exteriores.add("n");
    if (Math.abs(y1 - fondo) < tol) exteriores.add("s");
    if (Math.abs(x0) < tol) exteriores.add("o");
    if (Math.abs(x1 - ancho) < tol) exteriores.add("e");

    const lados: { lado: Lado; d: number }[] = [
      { lado: "n" as const, d: Math.abs(y0 - cy) },
      { lado: "s" as const, d: Math.abs(y1 - cy) },
      { lado: "o" as const, d: Math.abs(x0 - cx) },
      { lado: "e" as const, d: Math.abs(x1 - cx) },
    ].filter((l) => !exteriores.has(l.lado));
    if (lados.length === 0) continue;
    const entrada = lados.reduce((a, b) => (a.d < b.d ? a : b)).lado;

    const pared = (lado: Lado, a: [number, number], b: [number, number]) => {
      if (exteriores.has(lado)) return;
      if (lado !== entrada) {
        salida.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], piso });
        return;
      }
      // Dos tramos con el hueco en el centro.
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / largo;
      const uy = (b[1] - a[1]) / largo;
      const h = HUECO_DE_SALA / 2;
      salida.push({ x0: a[0], y0: a[1], x1: mx - ux * h, y1: my - uy * h, piso });
      salida.push({ x0: mx + ux * h, y0: my + uy * h, x1: b[0], y1: b[1], piso });
    };

    pared("n", [x0, y0], [x1, y0]);
    pared("s", [x0, y1], [x1, y1]);
    pared("o", [x0, y0], [x0, y1]);
    pared("e", [x1, y0], [x1, y1]);
  }
  return salida;
}

/**
 * Qué puertas cuentan como salida en una evacuación.
 *
 * Las de emergencia, y además cualquier puerta con caudal declarado: la puerta
 * principal es la primera por la que sale la gente, aunque no lleve el cartel
 * verde. Una puerta sin caudal y sin marcar como salida (la de servicio) no
 * cuenta: puede estar cerrada con llave.
 */
export function esSalida(p: PuertaPlano): boolean {
  return p.activo && (p.esSalidaEmergencia || p.caudalPorMinuto > 0);
}

/** Personas por minuto que deja pasar una puerta: la medida, o 50 por metro de ancho. */
export function caudalDeSalida(p: PuertaPlano): number {
  return p.caudalPorMinuto > 0 ? p.caudalPorMinuto : Math.max(20, Math.round(p.ancho * 50));
}

/** Nombre de una planta para la gente. */
export function nombreDePlanta(piso: number): string {
  return piso === 0 ? "Planta baja" : piso === 1 ? "Planta alta" : `Planta ${piso}`;
}
