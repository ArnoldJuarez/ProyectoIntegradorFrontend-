/**
 * Simulación de evacuación.
 *
 * Vive aparte del render a propósito: es un cálculo, no un dibujo. Así se puede
 * comprobar con números en la terminal, sin abrir un navegador, y la vista 3D
 * se limita a pintar lo que este módulo devuelve.
 *
 * ── Qué modelo se usa y por qué ────────────────────────────────────────────
 *
 * No es una simulación de multitudes con física. Es el modelo **hidráulico**,
 * que es el que usan los cálculos normativos de evacuación: cada salida deja
 * pasar un caudal máximo de personas por minuto, la gente se reparte entre las
 * salidas y el tiempo total lo marca la que más tarda en vaciar su cola.
 *
 * Tiempo de evacuación = tiempo de recorrido hasta la salida + tiempo de cola.
 *
 * Es deliberadamente conservador y comprensible. Una simulación de partículas
 * daría una animación más vistosa y un número menos defendible: aquí cada cifra
 * se puede rastrear hasta un caudal y una distancia que están en la base de
 * datos, y eso es lo que hace falta para discutir un aforo con Defensa Civil.
 *
 * ── Limitación que hay que decir en la memoria ─────────────────────────────
 *
 * El recorrido se calcula en línea recta desde el centro de cada zona hasta la
 * salida. No hay obstáculos ni pasillos, así que el tiempo real será algo mayor.
 * Modelar el trazado exigiría dibujar la planta completa con sus barreras, y eso
 * solo tiene sentido con el plano real de Ssiomama en la mano.
 */

/** Espejo del enum `TipoZona` de la base. */
export type TipoZona = "PISTA" | "VIP" | "BARRA" | "OTRA";

export type ZonaPlano = {
  id: string;
  nombre: string;
  tipo: TipoZona;
  aforo: number;
  x: number;
  y: number;
  ancho: number;
  fondo: number;
  alto: number;
  tono: number;
};

export type PuertaPlano = {
  id: string;
  nombre: string;
  esSalidaEmergencia: boolean;
  caudalPorMinuto: number;
  activo: boolean;
  x: number;
  y: number;
  ancho: number;
};

/**
 * Velocidad de desplazamiento en una evacuación, en metros por segundo.
 *
 * 1,2 m/s es el valor habitual para adultos en llano y en grupo. En una
 * discoteca a oscuras y con alcohol de por medio, tomarlo por bueno ya es
 * optimista; por eso el resto del modelo no añade más optimismo.
 */
export const VELOCIDAD = 1.2;

/** Caudal que se supone cuando una puerta no lo tiene medido: 50 personas/min por metro de hueco. */
export const CAUDAL_POR_METRO = 50;

export type AsignacionZona = {
  zona: ZonaPlano;
  puerta: PuertaPlano;
  personas: number;
  /** Metros en línea recta del centro de la zona a la puerta. */
  distancia: number;
  /** Segundos que tarda en llegar la primera persona. */
  recorrido: number;
};

export type ResultadoEvacuacion = {
  /** Segundos hasta que sale la última persona. */
  segundos: number;
  personas: number;
  asignaciones: AsignacionZona[];
  porPuerta: {
    puerta: PuertaPlano;
    personas: number;
    caudal: number;
    /** Segundos que tarda esa puerta en vaciar su cola. */
    segundos: number;
  }[];
  avisos: string[];
};

const centro = (z: ZonaPlano) => ({ x: z.x + z.ancho / 2, y: z.y + z.fondo / 2 });

const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Caudal efectivo de una puerta: el medido, o el estimado por su ancho. */
export function caudalDe(puerta: PuertaPlano): number {
  return puerta.caudalPorMinuto > 0
    ? puerta.caudalPorMinuto
    : Math.max(1, Math.round(puerta.ancho * CAUDAL_POR_METRO));
}

/**
 * Calcula el tiempo de evacuación.
 *
 * `ocupacion` es cuánta gente hay en total. Se reparte entre las zonas en
 * proporción a su aforo, porque una discoteca llena no tiene a todo el mundo en
 * la pista: la barra y los reservados también cuentan.
 */
export function simularEvacuacion(
  zonas: ZonaPlano[],
  puertas: PuertaPlano[],
  ocupacion: number,
): ResultadoEvacuacion {
  const avisos: string[] = [];

  // Solo las salidas de emergencia activas cuentan. La puerta de entrada no es
  // una salida a efectos de cálculo salvo que esté marcada como tal.
  const salidas = puertas.filter((p) => p.activo && p.esSalidaEmergencia);

  if (salidas.length === 0) {
    return {
      segundos: Number.POSITIVE_INFINITY,
      personas: ocupacion,
      asignaciones: [],
      porPuerta: [],
      avisos: [
        "No hay ninguna salida de emergencia marcada. Sin salidas no hay evacuación que calcular.",
      ],
    };
  }

  const zonasUtiles = zonas.filter((z) => z.ancho > 0 && z.fondo > 0);
  if (zonasUtiles.length === 0) {
    return {
      segundos: Number.POSITIVE_INFINITY,
      personas: ocupacion,
      asignaciones: [],
      porPuerta: [],
      avisos: ["Ninguna zona tiene medidas en el plano. Dibuja el local antes de simular."],
    };
  }

  const aforoTotal = zonasUtiles.reduce((s, z) => s + Math.max(z.aforo, 1), 0);

  // ---- cada zona va a su salida más cercana ----
  const asignaciones: AsignacionZona[] = zonasUtiles.map((zona) => {
    const c = centro(zona);
    const puerta = salidas.reduce((mejor, actual) =>
      distancia(c, actual) < distancia(c, mejor) ? actual : mejor,
    );
    const d = distancia(c, puerta);
    return {
      zona,
      puerta,
      personas: Math.round((Math.max(zona.aforo, 1) / aforoTotal) * ocupacion),
      distancia: d,
      recorrido: d / VELOCIDAD,
    };
  });

  // ---- cola en cada salida ----
  const porPuerta = salidas.map((puerta) => {
    const suyas = asignaciones.filter((a) => a.puerta.id === puerta.id);
    const personas = suyas.reduce((s, a) => s + a.personas, 0);
    const caudal = caudalDe(puerta);
    // El último en salir ha tenido que llegar (recorrido más largo) y esperar a
    // que pase toda la cola por delante.
    const recorridoMax = suyas.length > 0 ? Math.max(...suyas.map((a) => a.recorrido)) : 0;
    const cola = (personas / caudal) * 60;
    return { puerta, personas, caudal, segundos: recorridoMax + cola };
  });

  const segundos = Math.max(0, ...porPuerta.map((p) => p.segundos));

  // ---- avisos ----
  const sinUsar = porPuerta.filter((p) => p.personas === 0);
  if (sinUsar.length > 0) {
    avisos.push(
      `${sinUsar.length} salida${sinUsar.length > 1 ? "s" : ""} sin asignar: está${sinUsar.length > 1 ? "n" : ""} demasiado lejos de cualquier zona. Revisa su posición en el plano.`,
    );
  }

  const sinCaudal = salidas.filter((p) => p.caudalPorMinuto === 0);
  if (sinCaudal.length > 0) {
    avisos.push(
      `${sinCaudal.length} salida${sinCaudal.length > 1 ? "s" : ""} sin caudal medido: se estima por el ancho del hueco. El dato real viene en el informe de Defensa Civil.`,
    );
  }

  const sinAforo = zonasUtiles.filter((z) => z.aforo === 0);
  if (sinAforo.length > 0) {
    avisos.push(
      `${sinAforo.length} zona${sinAforo.length > 1 ? "s" : ""} sin aforo declarado. Se reparte gente por defecto, pero el cálculo será impreciso.`,
    );
  }

  return { segundos, personas: ocupacion, asignaciones, porPuerta, avisos };
}

/** Formatea segundos como "3 min 12 s", que es como se lee un tiempo de evacuación. */
export function formatearTiempo(segundos: number): string {
  if (!Number.isFinite(segundos)) return "—";
  const min = Math.floor(segundos / 60);
  const seg = Math.round(segundos % 60);
  return min > 0 ? `${min} min ${seg} s` : `${seg} s`;
}

/**
 * Color estable de una zona: el declarado, o el que le toca por tipo.
 *
 * El de respaldo salía antes de sumar los códigos de las letras del nombre. Era
 * estable, sí, pero arbitrario: la pista podía salir azul y la barra violeta, y
 * corregir una tilde en el nombre cambiaba el color de la zona. Ahora el
 * respaldo dice algo — cada tipo de zona tiene el suyo — y solo se cae al hash
 * en las zonas sin tipo, donde de verdad no hay nada mejor que inventar.
 */
const TONO_POR_TIPO: Record<TipoZona, number | null> = {
  PISTA: 320, // magenta: es donde está la gente
  VIP: 250, // violeta
  BARRA: 40, // ámbar, como la luz de una barra
  OTRA: null,
};

export function tonoDeZona(zona: { nombre: string; tipo: TipoZona; tono: number }): number {
  if (zona.tono >= 0) return zona.tono;
  const porTipo = TONO_POR_TIPO[zona.tipo];
  if (porTipo !== null) return porTipo;
  const suma = [...zona.nombre].reduce((total, letra) => total + letra.charCodeAt(0), 0);
  return 200 + (suma % 160); // 200–360: azul, violeta, magenta
}
