import { ALTURA_DE_PLANTA, ambienteDe } from "../discoteca/comun";
import type { PuertaPlano, ZonaPlano } from "../evacuacion";
import { esSalida, paredesInteriores, type Segmento } from "./geometria";

/**
 * El local convertido en una rejilla por la que se puede caminar.
 *
 * ## Por qué una rejilla y no líneas rectas
 *
 * La estimación anterior medía en línea recta de cada zona a la salida más
 * cercana, como si las paredes no existieran. Aquí el local se divide en celdas
 * de medio metro: las de dentro del edificio son transitables, las que pisan una
 * pared no. Y la planta alta solo es suelo donde hay una zona encima de la losa
 * (el hueco de la pista no se puede pisar). Las dos plantas se unen por la
 * escalera, que cuesta más recorrer que el llano.
 *
 * ## El campo de distancias
 *
 * Desde todas las salidas a la vez se calcula cuánto hay que caminar desde cada
 * celda hasta la salida más cercana (Dijkstra con varias fuentes). Con eso, la
 * ruta de evacuación desde cualquier punto es bajar siempre a la celda vecina
 * más cercana a una salida. Si hay un incendio, sus celdas se bloquean y el
 * campo se recalcula: la gente rodea el fuego o busca otra salida.
 */

export const CELDA = 0.5;

/** Cuánto más cuesta un metro de escalera que uno de llano (se baja más despacio y en fila). */
const COSTE_DE_ESCALERA = 1.8;

export type Salida = {
  puerta: PuertaPlano;
  indice: number;
  piso: number;
  celdas: number[];
};

/** Una escalera: celdas de arriba que llevan a celdas de abajo, con su coste. */
export type Escalera = {
  arriba: number[];
  abajo: number[];
  coste: number;
};

export type Rejilla = {
  ancho: number;
  fondo: number;
  nx: number;
  nz: number;
  plantas: number;
  /** Celdas por planta: `nx * nz`. El índice global es `piso * porPlanta + iz * nx + ix`. */
  porPlanta: number;
  transitable: Uint8Array;
  /** Zona a la que pertenece cada celda (índice en `zonas`), o -1. */
  zonaDe: Int16Array;
  salidas: Salida[];
  /** Índice de salida si la celda es de salida, o -1. */
  salidaDe: Int16Array;
  escaleras: Escalera[];
  /** Destino de escalera de una celda de arriba (índice en `escaleras`), o -1. */
  escaleraDe: Int16Array;
  paredes: Segmento[];
  zonas: ZonaPlano[];
};

export type Campo = {
  /** Metros hasta la salida más cercana. `Infinity` si no hay camino. */
  /** En doble precisión: con `Float32Array` el redondeo hacía que Dijkstra se saltara celdas. */
  distancia: Float64Array;
  /** La siguiente celda de la ruta: un índice, -2 si toca bajar por la escalera, -1 si es salida o no hay camino. */
  siguiente: Int32Array;
  /** Qué salida se alcanza desde cada celda, o -1. */
  salidaFinal: Int16Array;
};

export function indice(r: Rejilla, piso: number, ix: number, iz: number): number {
  return piso * r.porPlanta + iz * r.nx + ix;
}

export function celdaEn(r: Rejilla, piso: number, x: number, y: number): number {
  const ix = Math.floor(x / CELDA);
  const iz = Math.floor(y / CELDA);
  if (ix < 0 || iz < 0 || ix >= r.nx || iz >= r.nz || piso < 0 || piso >= r.plantas) return -1;
  return indice(r, piso, ix, iz);
}

export function centroDe(r: Rejilla, celda: number): { piso: number; x: number; y: number } {
  const piso = Math.floor(celda / r.porPlanta);
  const resto = celda - piso * r.porPlanta;
  const iz = Math.floor(resto / r.nx);
  const ix = resto - iz * r.nx;
  return { piso, x: (ix + 0.5) * CELDA, y: (iz + 0.5) * CELDA };
}

function distanciaASegmento(px: number, py: number, s: Segmento): number {
  const dx = s.x1 - s.x0;
  const dy = s.y1 - s.y0;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / l2));
  return Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy));
}

function dentroDeZona(z: ZonaPlano, x: number, y: number, margen = 0): boolean {
  return x >= z.x - margen && x <= z.x + z.ancho + margen && y >= z.y - margen && y <= z.y + z.fondo + margen;
}

export function construirRejilla(
  ancho: number,
  fondo: number,
  zonas: ZonaPlano[],
  puertas: PuertaPlano[],
): Rejilla {
  const nx = Math.max(1, Math.ceil(ancho / CELDA));
  const nz = Math.max(1, Math.ceil(fondo / CELDA));
  const plantas = Math.max(1, ...zonas.map((z) => (z.piso ?? 0) + 1), ...puertas.map((p) => (p.piso ?? 0) + 1));
  const porPlanta = nx * nz;
  const total = porPlanta * plantas;
  const transitable = new Uint8Array(total);
  const zonaDe = new Int16Array(total).fill(-1);
  const paredes = paredesInteriores(zonas, ancho, fondo);

  for (let piso = 0; piso < plantas; piso++) {
    const deLaPlanta = zonas.map((z, i) => ({ z, i })).filter(({ z }) => (z.piso ?? 0) === piso);
    const paredesDeLaPlanta = paredes.filter((s) => s.piso === piso);
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = (ix + 0.5) * CELDA;
        const y = (iz + 0.5) * CELDA;
        const g = piso * porPlanta + iz * nx + ix;
        const zona = deLaPlanta.find(({ z }) => dentroDeZona(z, x, y));
        if (zona) zonaDe[g] = zona.i;
        // En la planta baja se pisa todo el edificio; arriba, solo sobre una losa.
        let libre = piso === 0 ? true : zona !== undefined;
        if (libre && paredesDeLaPlanta.some((s) => distanciaASegmento(x, y, s) < CELDA * 0.55)) libre = false;
        transitable[g] = libre ? 1 : 0;
      }
    }
  }

  // ── Salidas: las celdas transitables junto a cada puerta que es salida ──
  const salidaDe = new Int16Array(total).fill(-1);
  const salidas: Salida[] = [];
  puertas.filter(esSalida).forEach((puerta) => {
    const piso = Math.min(plantas - 1, puerta.piso ?? 0);
    const celdas: number[] = [];
    const radio = Math.max(puerta.ancho / 2, CELDA) + 0.3;
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = (ix + 0.5) * CELDA;
        const y = (iz + 0.5) * CELDA;
        const g = piso * porPlanta + iz * nx + ix;
        if (!transitable[g]) continue;
        // Junto a la puerta: dentro del ancho del hueco y a menos de un metro de la pared.
        if (Math.hypot(x - puerta.x, y - puerta.y) <= radio + 0.6) celdas.push(g);
      }
    }
    if (celdas.length === 0) return;
    const indiceDeSalida = salidas.length;
    celdas.forEach((g) => (salidaDe[g] = indiceDeSalida));
    salidas.push({ puerta, indice: indiceDeSalida, piso, celdas });
  });

  // ── Escaleras: unen el desembarco de arriba con el arranque de abajo ──
  const escaleras: Escalera[] = [];
  const escaleraDe = new Int16Array(total).fill(-1);
  if (plantas > 1) {
    for (const z of zonas) {
      if (ambienteDe(z, zonas) !== "escalera") continue;
      const altas = zonas.filter((o) => (o.piso ?? 0) === (z.piso ?? 0) + 1);
      const largoEnY = z.fondo >= z.ancho;
      const cx = z.x + z.ancho / 2;
      const cy = z.y + z.fondo / 2;
      // El extremo que toca una zona de arriba es el desembarco.
      const arribaAlInicio = largoEnY
        ? altas.some((a) => dentroDeZona(a, cx, z.y - 0.5))
        : altas.some((a) => dentroDeZona(a, z.x - 0.5, cy));
      const pisoAlto = (z.piso ?? 0) + 1;
      const arriba: number[] = [];
      const abajo: number[] = [];
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const x = (ix + 0.5) * CELDA;
          const y = (iz + 0.5) * CELDA;
          const enAncho = largoEnY ? x > z.x && x < z.x + z.ancho : y > z.y && y < z.y + z.fondo;
          if (!enAncho) continue;
          const borde = largoEnY ? (arribaAlInicio ? z.y : z.y + z.fondo) : arribaAlInicio ? z.x : z.x + z.ancho;
          const pie = largoEnY ? (arribaAlInicio ? z.y + z.fondo : z.y) : arribaAlInicio ? z.x + z.ancho : z.x;
          const t = largoEnY ? y : x;
          // Arriba: la franja de un metro de la zona alta junto al desembarco.
          const gArriba = pisoAlto * porPlanta + iz * nx + ix;
          if (transitable[gArriba] && Math.abs(t - borde) <= 1.0) arriba.push(gArriba);
          // Abajo: la franja de un metro al pie de la escalera.
          const gAbajo = (z.piso ?? 0) * porPlanta + iz * nx + ix;
          const dentroDeLaEscalera = largoEnY ? y > z.y && y < z.y + z.fondo : x > z.x && x < z.x + z.ancho;
          if (transitable[gAbajo] && dentroDeLaEscalera && Math.abs(t - pie) <= 1.0) abajo.push(gAbajo);
        }
      }
      if (arriba.length === 0 || abajo.length === 0) continue;
      const recorrido = Math.hypot(largoEnY ? z.fondo : z.ancho, ALTURA_DE_PLANTA);
      const k = escaleras.length;
      arriba.forEach((g) => (escaleraDe[g] = k));
      escaleras.push({ arriba, abajo, coste: recorrido * COSTE_DE_ESCALERA });
    }
  }

  return {
    ancho,
    fondo,
    nx,
    nz,
    plantas,
    porPlanta,
    transitable,
    zonaDe,
    salidas,
    salidaDe,
    escaleras,
    escaleraDe,
    paredes,
    zonas,
  };
}

// ── El campo de distancias ──────────────────────────────────────────

/** Un montículo binario mínimo, para Dijkstra sobre miles de celdas. */
class Monticulo {
  private claves: number[] = [];
  private valores: number[] = [];

  get vacio() {
    return this.claves.length === 0;
  }

  meter(valor: number, clave: number) {
    this.claves.push(clave);
    this.valores.push(valor);
    let i = this.claves.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.claves[p] <= this.claves[i]) break;
      this.cambiar(i, p);
      i = p;
    }
  }

  sacar(): [number, number] {
    const valor = this.valores[0];
    const clave = this.claves[0];
    const ultimaClave = this.claves.pop()!;
    const ultimoValor = this.valores.pop()!;
    if (this.claves.length > 0) {
      this.claves[0] = ultimaClave;
      this.valores[0] = ultimoValor;
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let m = i;
        if (a < this.claves.length && this.claves[a] < this.claves[m]) m = a;
        if (b < this.claves.length && this.claves[b] < this.claves[m]) m = b;
        if (m === i) break;
        this.cambiar(i, m);
        i = m;
      }
    }
    return [valor, clave];
  }

  private cambiar(a: number, b: number) {
    [this.claves[a], this.claves[b]] = [this.claves[b], this.claves[a]];
    [this.valores[a], this.valores[b]] = [this.valores[b], this.valores[a]];
  }
}

const VECINOS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Distancias hasta la salida más cercana desde cada celda.
 *
 * @param bloqueada celdas por las que no se puede pasar (el fuego y el humo)
 * @param salidasCerradas salidas que no se pueden usar (el fuego está en ellas)
 */
export function calcularCampo(r: Rejilla, bloqueada?: Uint8Array, salidasCerradas?: Set<number>): Campo {
  const total = r.porPlanta * r.plantas;
  const distancia = new Float64Array(total).fill(Infinity);
  const siguiente = new Int32Array(total).fill(-1);
  const salidaFinal = new Int16Array(total).fill(-1);
  const monticulo = new Monticulo();
  const libre = (g: number) => r.transitable[g] === 1 && !(bloqueada && bloqueada[g]);

  for (const s of r.salidas) {
    if (salidasCerradas?.has(s.indice)) continue;
    for (const g of s.celdas) {
      if (!libre(g)) continue;
      distancia[g] = 0;
      salidaFinal[g] = s.indice;
      monticulo.meter(g, 0);
    }
  }

  // Las escaleras se recorren al revés: desde el pie se llega al desembarco.
  const porPie = new Map<number, number[]>();
  r.escaleras.forEach((e, k) => e.abajo.forEach((g) => porPie.set(g, [...(porPie.get(g) ?? []), k])));

  while (!monticulo.vacio) {
    const [g, d] = monticulo.sacar();
    if (d > distancia[g]) continue;
    const piso = Math.floor(g / r.porPlanta);
    const resto = g - piso * r.porPlanta;
    const iz = Math.floor(resto / r.nx);
    const ix = resto - iz * r.nx;

    for (const [dx, dz, coste] of VECINOS) {
      const vx = ix + dx;
      const vz = iz + dz;
      if (vx < 0 || vz < 0 || vx >= r.nx || vz >= r.nz) continue;
      const v = piso * r.porPlanta + vz * r.nx + vx;
      if (!libre(v)) continue;
      // Sin atajar esquinas: en diagonal solo si las dos celdas de al lado son libres.
      if (dx !== 0 && dz !== 0) {
        if (!libre(piso * r.porPlanta + iz * r.nx + vx) || !libre(piso * r.porPlanta + vz * r.nx + ix)) continue;
      }
      const nd = d + coste * CELDA;
      if (nd < distancia[v]) {
        distancia[v] = nd;
        siguiente[v] = g;
        salidaFinal[v] = salidaFinal[g];
        monticulo.meter(v, nd);
      }
    }

    // Desde el pie de una escalera se llega a su desembarco, pagando el tramo.
    const deEsteTramo = porPie.get(g);
    if (deEsteTramo) {
      for (const k of deEsteTramo) {
        const e = r.escaleras[k];
        for (const arriba of e.arriba) {
          if (!libre(arriba)) continue;
          const nd = d + e.coste;
          if (nd < distancia[arriba]) {
            distancia[arriba] = nd;
            siguiente[arriba] = -2;
            salidaFinal[arriba] = salidaFinal[g];
            monticulo.meter(arriba, nd);
          }
        }
      }
    }
  }

  return { distancia, siguiente, salidaFinal };
}

/** La celda del pie de escalera más cercana a la salida, para quien baja desde `arriba`. */
export function pieDeEscalera(r: Rejilla, campo: Campo, arriba: number): number {
  const k = r.escaleraDe[arriba];
  if (k < 0) return -1;
  let mejor = -1;
  for (const g of r.escaleras[k].abajo) {
    if (mejor < 0 || campo.distancia[g] < campo.distancia[mejor]) mejor = g;
  }
  return mejor;
}

export type PuntoDeRuta = { piso: number; x: number; y: number };

/**
 * La ruta de evacuación desde un punto: la sucesión de celdas que lleva a la
 * salida más cercana, con el salto de planta por la escalera.
 */
export function rutaDesde(r: Rejilla, campo: Campo, piso: number, x: number, y: number): PuntoDeRuta[] {
  let g = celdaEn(r, piso, x, y);
  if (g < 0 || !Number.isFinite(campo.distancia[g])) {
    // Si el punto cae en una pared o fuera, se busca la celda transitable más cercana.
    g = celdaLibreCercana(r, campo, piso, x, y);
    if (g < 0) return [];
  }
  const ruta: PuntoDeRuta[] = [{ piso, x, y }];
  let pasos = 0;
  while (g >= 0 && pasos++ < 5000) {
    ruta.push(centroDe(r, g));
    const sig = campo.siguiente[g];
    if (sig === -2) {
      g = pieDeEscalera(r, campo, g);
      continue;
    }
    if (sig < 0) break;
    g = sig;
  }
  return simplificar(ruta);
}

export function celdaLibreCercana(r: Rejilla, campo: Campo, piso: number, x: number, y: number): number {
  let mejor = -1;
  let mejorD = Infinity;
  const ix0 = Math.floor(x / CELDA);
  const iz0 = Math.floor(y / CELDA);
  for (let radio = 1; radio < 12 && mejor < 0; radio++) {
    for (let dz = -radio; dz <= radio; dz++) {
      for (let dx = -radio; dx <= radio; dx++) {
        const ix = ix0 + dx;
        const iz = iz0 + dz;
        if (ix < 0 || iz < 0 || ix >= r.nx || iz >= r.nz || piso >= r.plantas) continue;
        const g = indice(r, piso, ix, iz);
        if (!Number.isFinite(campo.distancia[g])) continue;
        const d = Math.hypot(dx, dz);
        if (d < mejorD) {
          mejorD = d;
          mejor = g;
        }
      }
    }
  }
  return mejor;
}

/** Quita los puntos intermedios de los tramos rectos: la ruta se dibuja con menos vértices. */
function simplificar(ruta: PuntoDeRuta[]): PuntoDeRuta[] {
  if (ruta.length < 3) return ruta;
  const salida = [ruta[0]];
  for (let i = 1; i < ruta.length - 1; i++) {
    const a = salida[salida.length - 1];
    const b = ruta[i];
    const c = ruta[i + 1];
    if (a.piso !== b.piso || b.piso !== c.piso) {
      salida.push(b);
      continue;
    }
    const cruz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cruz) > 0.01) salida.push(b);
  }
  salida.push(ruta[ruta.length - 1]);
  return salida;
}

/** La ruta desde el centro de cada zona con gente: lo que se dibuja como rutas de evacuación. */
export function rutasDeZonas(r: Rejilla, campo: Campo): { zona: ZonaPlano; ruta: PuntoDeRuta[]; salida: number }[] {
  return r.zonas
    .filter((z) => z.ancho > 0 && z.fondo > 0 && ambienteDe(z, r.zonas) !== "escalera")
    .map((z) => {
      const ruta = rutaDesde(r, campo, z.piso ?? 0, z.x + z.ancho / 2, z.y + z.fondo / 2);
      const final = ruta.length > 1 ? celdaEn(r, ruta[ruta.length - 1].piso, ruta[ruta.length - 1].x, ruta[ruta.length - 1].y) : -1;
      return { zona: z, ruta, salida: final >= 0 ? campo.salidaFinal[final] : -1 };
    })
    .filter((x) => x.ruta.length > 1);
}
