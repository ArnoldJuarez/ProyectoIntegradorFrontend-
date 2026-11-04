import type { PuertaPlano, ZonaPlano } from "../evacuacion";

/**
 * Lo que comparten todas las piezas de la discoteca en 3D.
 *
 * ## Coordenadas
 *
 * El plano tiene el origen en una esquina, con `x` hacia la derecha e `y` hacia
 * la calle (la fachada está en `y = planoFondo`). Three.js lo tiene en el centro
 * y con `y` hacia arriba. Así que: `x` del plano → `x` de la escena, `y` del
 * plano → `z` de la escena, y la altura es la planta por {@link ALTURA_DE_PLANTA}.
 */

/** Del suelo de una planta al suelo de la siguiente, en metros. */
export const ALTURA_DE_PLANTA = 4.5;

/** El grosor de la losa entre plantas. */
export const LOSA = 0.3;

/** Hasta dónde llega el edificio: dos plantas. */
export const ALTO_DEL_EDIFICIO = ALTURA_DE_PLANTA * 2;

export type Centro = { x: number; z: number };

/** Una zona situada en la escena. */
export type Caja = {
  /** Centro en la escena. */
  cx: number;
  cz: number;
  /** Medidas en planta. */
  w: number;
  d: number;
  /** Altura del suelo de su planta. */
  y0: number;
  /** Altura libre de la zona desde su suelo. */
  h: number;
  /** Bordes en la escena. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
};

export function caja(zona: ZonaPlano, centro: Centro): Caja {
  const x0 = zona.x - centro.x;
  const z0 = zona.y - centro.z;
  return {
    cx: x0 + zona.ancho / 2,
    cz: z0 + zona.fondo / 2,
    w: zona.ancho,
    d: zona.fondo,
    y0: (zona.piso ?? 0) * ALTURA_DE_PLANTA,
    h: Math.max(zona.alto, 2.6),
    x0,
    x1: x0 + zona.ancho,
    z0,
    z1: z0 + zona.fondo,
  };
}

export function situarPuerta(puerta: PuertaPlano, centro: Centro) {
  return { x: puerta.x - centro.x, z: puerta.y - centro.z, y0: (puerta.piso ?? 0) * ALTURA_DE_PLANTA };
}

/**
 * Qué ambiente se monta en una zona.
 *
 * Sale del tipo y, para afinar, del nombre: el tipo dice «es una barra», el
 * nombre dice si es la barra de siempre, la coctelería o la del VIP. Una zona
 * que no encaja en nada se dibuja como sala genérica, nunca vacía.
 */
export type Ambiente =
  | "escenario"
  | "pista"
  | "cueva"
  | "boxes"
  | "lounge"
  | "barra"
  | "barra-vip"
  | "cocteleria"
  | "vestibulo"
  | "banos"
  | "escalera"
  | "terraza"
  | "balcon"
  | "generico";

export function ambienteDe(zona: ZonaPlano, todas: ZonaPlano[]): Ambiente {
  const n = zona.nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (/escenario|cabina|\bdj\b/.test(n)) return "escenario";
  if (/escaler/.test(n)) return "escalera";
  if (/terraza|patio|azotea|rooftop/.test(n)) return "terraza";
  if (/balcon|mirador|mezzan|altillo/.test(n)) return "balcon";
  if (/bano|aseo|sshh|servicios higien/.test(n)) return "banos";
  if (/vestibul|entrada|recepcion|guardarropa|hall/.test(n)) return "vestibulo";

  if (zona.tipo === "PISTA") {
    if (/cueva|urbana|latina|sala 2|segunda/.test(n)) return "cueva";
    // Si hay varias pistas, la más grande es la principal y el resto, salas aparte.
    const mayor = todas
      .filter((z) => z.tipo === "PISTA")
      .reduce((a, b) => (a.ancho * a.fondo >= b.ancho * b.fondo ? a : b));
    return mayor.id === zona.id ? "pista" : "cueva";
  }
  if (zona.tipo === "BARRA") {
    if (/coctel|cocktail|speak/.test(n)) return "cocteleria";
    if (/vip/.test(n)) return "barra-vip";
    return "barra";
  }
  if (zona.tipo === "VIP") return (zona.piso ?? 0) > 0 || /lounge/.test(n) ? "lounge" : "boxes";
  return "generico";
}

/** El color de luz que define cada ambiente. */
export const LUZ_DE: Record<Ambiente, string> = {
  escenario: "#ff3d9a",
  pista: "#ff3d9a",
  cueva: "#ff4a1c",
  boxes: "#a374ff",
  lounge: "#b28cff",
  barra: "#ffb347",
  "barra-vip": "#ffd27a",
  cocteleria: "#ff9a3c",
  vestibulo: "#7fd6ff",
  banos: "#9fe6ff",
  escalera: "#ff3d9a",
  terraza: "#ffcf8a",
  balcon: "#c58bff",
  generico: "#a374ff",
};

/** Paleta de materiales: concreto oscuro y neón, la identidad de la casa. */
export const COLOR = {
  noche: "#05030a",
  concreto: "#17141c",
  concretoClaro: "#221e29",
  pared: "#1a1620",
  techo: "#0b0910",
  metal: "#4a4652",
  metalOscuro: "#24212b",
  madera: "#3a2618",
  maderaClara: "#6b4a2f",
  terciopelo: "#3b1250",
  cuero: "#120f16",
  dorado: "#c9a14a",
  ladrillo: "#4a1f17",
  cesped: "#1d3a24",
  asfalto: "#0e0e12",
  magenta: "#ff3d9a",
  violeta: "#a374ff",
  cian: "#22d3ee",
};

/** Un generador aleatorio con semilla: la gente y los detalles salen siempre en el mismo sitio. */
export function aleatorio(semilla: string) {
  let h = 1779033703 ^ semilla.length;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ¿Este punto de la planta cae dentro de la zona? */
export function dentro(c: Caja, x: number, z: number, margen = 0): boolean {
  return x >= c.x0 + margen && x <= c.x1 - margen && z >= c.z0 + margen && z <= c.z1 - margen;
}
