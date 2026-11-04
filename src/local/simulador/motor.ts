import { aleatorio } from "../discoteca/comun";
import { caudalDeSalida } from "./geometria";
import {
  CELDA,
  calcularCampo,
  celdaEn,
  centroDe,
  pieDeEscalera,
  type Campo,
  type Rejilla,
} from "./rejilla";

/**
 * La simulación de una evacuación, persona a persona.
 *
 * ## Qué modela
 *
 * - **Recorrido real**: cada persona sigue el campo de distancias de la rejilla,
 *   es decir, rodea paredes y baja por la escalera.
 * - **Densidad**: se camina más despacio entre mucha gente. La velocidad cae con
 *   las personas por metro cuadrado de la celda (relación de Weidmann, la que se
 *   usa en ingeniería de evacuación), de 1,34 m/s en vacío hasta casi parar.
 * - **Escalera**: se baja a 0,6 m/s y su tramo cuesta lo que mide en pendiente.
 * - **Colas en las puertas**: cada salida deja pasar las personas por minuto de
 *   su caudal. Es lo que suele mandar en el tiempo total: el cuello de botella.
 * - **Incendio** (opcional): un foco que crece. Sus celdas se bloquean, la
 *   salida que queda dentro se pierde y el resto de la gente se reorganiza.
 *
 * ## Qué no modela
 *
 * El tiempo de reacción (lo que tarda alguien en darse cuenta y echar a andar)
 * se aplica como un retraso aleatorio al empezar, no como comportamiento. No hay
 * pánico, ni gente que vuelve a por algo, ni empujones. Es una estimación de
 * ingeniería para comparar escenarios, no un sustituto del simulacro real.
 */

export const VELOCIDAD_LIBRE = 1.34;
const VELOCIDAD_EN_ESCALERA = 0.6;
const PASO = 0.2;
/** Tope de tiempo simulado: más de 15 minutos es que algo no tiene salida. */
const TIEMPO_MAXIMO = 900;

export type Incendio = {
  piso: number;
  x: number;
  y: number;
  /** Radio inicial en metros. */
  radio: number;
  /** Cuánto crece por segundo hasta su tope. */
  crece: number;
  radioMaximo: number;
};

export type Opciones = {
  personas: number;
  incendio?: Incendio | null;
  /** Retraso máximo de reacción en segundos (cada persona tarda entre 0 y esto en salir). */
  reaccion?: number;
  semilla?: string;
};

/** En qué está cada persona. Constantes y no `enum`: el proyecto compila con `erasableSyntaxOnly`. */
export const Estado = {
  Esperando: 0,
  Caminando: 1,
  EnEscalera: 2,
  EnCola: 3,
  Fuera: 4,
  Atrapada: 5,
} as const;
export type Estado = (typeof Estado)[keyof typeof Estado];

export type Persona = {
  x: number;
  y: number;
  piso: number;
  estado: Estado;
  /** Segundos de reacción que le quedan, o de escalera. */
  espera: number;
  salida: number;
  /** Lo que tenía que caminar al empezar: el recorrido de evacuación de su sitio. */
  recorridoInicial: number;
  /** Si el fuego la alcanzó en algún momento. */
  afectada: boolean;
};

export type ResultadoDeSalida = {
  indice: number;
  nombre: string;
  piso: number;
  personas: number;
  caudal: number;
  ultimaEn: number | null;
  /** Si el fuego la inutilizó. */
  perdida: boolean;
};

export type Muestra = { t: number; fuera: number; dentro: number; plantaAlta: number };

export class Simulacion {
  readonly rejilla: Rejilla;
  readonly personas: Persona[] = [];
  campo: Campo;
  tiempo = 0;
  terminada = false;
  readonly muestras: Muestra[] = [];
  /** Cuándo quedó vacía la planta alta, o nulo si sigue habiendo gente. */
  plantaAltaVaciaEn: number | null = null;
  readonly incendio: Incendio | null;
  radioDelFuego = 0;

  private readonly colas: number[][];
  private readonly fichas: number[];
  private readonly contadores: { personas: number; ultimaEn: number | null }[];
  private salidasPerdidas = new Set<number>();
  private radioDelCampo = -1;
  private ocupacion: Uint16Array;
  private siguienteMuestra = 0;

  constructor(rejilla: Rejilla, opciones: Opciones) {
    this.rejilla = rejilla;
    this.incendio = opciones.incendio ?? null;
    this.radioDelFuego = this.incendio?.radio ?? 0;
    this.campo = this.recalcular();
    this.colas = rejilla.salidas.map(() => []);
    this.fichas = rejilla.salidas.map(() => 0);
    this.contadores = rejilla.salidas.map(() => ({ personas: 0, ultimaEn: null }));
    this.ocupacion = new Uint16Array(rejilla.porPlanta * rejilla.plantas);
    this.repartir(opciones.personas, opciones.reaccion ?? 30, opciones.semilla ?? "evacuacion");
    this.muestrear();
  }

  // ── Arranque ──────────────────────────────────────────────────

  /**
   * Reparte a la gente por las zonas en proporción a su aforo, en celdas
   * transitables al azar (siempre las mismas con la misma semilla).
   */
  private repartir(total: number, reaccion: number, semilla: string) {
    const r = this.rejilla;
    const azar = aleatorio(semilla);
    const conAforo = r.zonas.map((z, i) => ({ z, i })).filter(({ z }) => z.aforo > 0);
    const base = conAforo.length > 0 ? conAforo : r.zonas.map((z, i) => ({ z, i })).filter(({ z }) => z.ancho * z.fondo > 0);
    const pesoTotal = base.reduce((s, { z }) => s + (z.aforo > 0 ? z.aforo : z.ancho * z.fondo), 0);
    if (pesoTotal === 0) return;

    // Celdas transitables de cada zona.
    const celdasDe = new Map<number, number[]>();
    for (let g = 0; g < r.zonaDe.length; g++) {
      const zi = r.zonaDe[g];
      if (zi >= 0 && r.transitable[g]) celdasDe.set(zi, [...(celdasDe.get(zi) ?? []), g]);
    }

    let repartidas = 0;
    base.forEach(({ z, i }, k) => {
      const celdas = celdasDe.get(i) ?? [];
      if (celdas.length === 0) return;
      const peso = z.aforo > 0 ? z.aforo : z.ancho * z.fondo;
      const cuantas = k === base.length - 1 ? total - repartidas : Math.round((peso / pesoTotal) * total);
      for (let n = 0; n < cuantas; n++) {
        const g = celdas[Math.floor(azar() * celdas.length)];
        const c = centroDe(r, g);
        const x = c.x + (azar() - 0.5) * CELDA * 0.8;
        const y = c.y + (azar() - 0.5) * CELDA * 0.8;
        this.personas.push({
          x,
          y,
          piso: c.piso,
          estado: Estado.Esperando,
          espera: azar() * reaccion,
          salida: -1,
          recorridoInicial: this.campo.distancia[g],
          afectada: false,
        });
      }
      repartidas += cuantas;
    });
  }

  // ── El fuego ──────────────────────────────────────────────────

  /** Recalcula el campo con las celdas que alcanza el fuego bloqueadas. */
  private recalcular(): Campo {
    const r = this.rejilla;
    if (!this.incendio) return calcularCampo(r);
    const f = this.incendio;
    const bloqueada = new Uint8Array(r.porPlanta * r.plantas);
    const radio = this.radioDelFuego;
    const ix0 = Math.floor((f.x - radio) / CELDA);
    const ix1 = Math.ceil((f.x + radio) / CELDA);
    const iz0 = Math.floor((f.y - radio) / CELDA);
    const iz1 = Math.ceil((f.y + radio) / CELDA);
    for (let iz = Math.max(0, iz0); iz <= Math.min(r.nz - 1, iz1); iz++) {
      for (let ix = Math.max(0, ix0); ix <= Math.min(r.nx - 1, ix1); ix++) {
        const x = (ix + 0.5) * CELDA;
        const y = (iz + 0.5) * CELDA;
        if (Math.hypot(x - f.x, y - f.y) <= radio) bloqueada[f.piso * r.porPlanta + iz * r.nx + ix] = 1;
      }
    }
    // Una salida con más de la mitad de sus celdas bajo el fuego se da por perdida.
    for (const s of r.salidas) {
      const tomadas = s.celdas.filter((g) => bloqueada[g]).length;
      if (tomadas > s.celdas.length / 2) this.salidasPerdidas.add(s.indice);
    }
    this.radioDelCampo = radio;
    return calcularCampo(r, bloqueada, this.salidasPerdidas);
  }

  private enElFuego(p: Persona): boolean {
    const f = this.incendio;
    return !!f && p.piso === f.piso && Math.hypot(p.x - f.x, p.y - f.y) <= this.radioDelFuego + 0.5;
  }

  // ── Un paso ───────────────────────────────────────────────────

  /** Avanza la simulación `segundos` de tiempo simulado. */
  avanzar(segundos: number) {
    let quedan = segundos;
    while (quedan > 0 && !this.terminada) {
      const dt = Math.min(PASO, quedan);
      this.paso(dt);
      quedan -= dt;
    }
  }

  private paso(dt: number) {
    const r = this.rejilla;
    this.tiempo += dt;

    if (this.incendio) {
      this.radioDelFuego = Math.min(this.incendio.radioMaximo, this.radioDelFuego + this.incendio.crece * dt);
      if (this.radioDelFuego - this.radioDelCampo >= 0.5) this.campo = this.recalcular();
    }

    // Cuánta gente hay en cada celda, para la velocidad.
    this.ocupacion.fill(0);
    for (const p of this.personas) {
      if (p.estado !== Estado.Caminando && p.estado !== Estado.EnCola && p.estado !== Estado.Esperando) continue;
      const g = celdaEn(r, p.piso, p.x, p.y);
      if (g >= 0 && this.ocupacion[g] < 65535) this.ocupacion[g]++;
    }

    for (let k = 0; k < this.personas.length; k++) {
      const p = this.personas[k];
      if (p.estado === Estado.Fuera || p.estado === Estado.Atrapada || p.estado === Estado.EnCola) continue;
      if (this.enElFuego(p)) p.afectada = true;

      if (p.estado === Estado.Esperando) {
        p.espera -= dt;
        // Quien ve el fuego cerca no espera.
        if (p.espera <= 0 || p.afectada) p.estado = Estado.Caminando;
        continue;
      }

      if (p.estado === Estado.EnEscalera) {
        p.espera -= dt;
        if (p.espera <= 0) p.estado = Estado.Caminando;
        continue;
      }

      const g = celdaEn(r, p.piso, p.x, p.y);
      if (g < 0) {
        p.estado = Estado.Atrapada;
        continue;
      }
      if (!Number.isFinite(this.campo.distancia[g])) {
        // Sin camino ahora mismo (el fuego cortó el paso): se queda, quizá se abra otro.
        if (this.tiempo > TIEMPO_MAXIMO - 1) p.estado = Estado.Atrapada;
        continue;
      }

      const salida = r.salidaDe[g];
      if (salida >= 0 && !this.salidasPerdidas.has(salida)) {
        p.estado = Estado.EnCola;
        p.salida = salida;
        this.colas[salida].push(k);
        continue;
      }

      const sig = this.campo.siguiente[g];
      if (sig === -2) {
        // Bajar la escalera: aparece al pie tras recorrerla.
        const pie = pieDeEscalera(r, this.campo, g);
        if (pie < 0) continue;
        const k = r.escaleraDe[g];
        const destino = centroDe(r, pie);
        p.x = destino.x;
        p.y = destino.y;
        p.piso = destino.piso;
        p.estado = Estado.EnEscalera;
        p.espera = r.escaleras[k].coste / 1.8 / VELOCIDAD_EN_ESCALERA;
        continue;
      }
      if (sig < 0) continue;

      // Weidmann: la velocidad cae con la densidad de la celda (personas/m²).
      const densidad = this.ocupacion[g] / (CELDA * CELDA);
      const v = densidad <= 0.6 ? VELOCIDAD_LIBRE : Math.max(0.12, VELOCIDAD_LIBRE * (1 - Math.exp(-1.913 * (1 / densidad - 1 / 5.4))));
      const destino = centroDe(r, sig);
      const dx = destino.x - p.x;
      const dy = destino.y - p.y;
      const d = Math.hypot(dx, dy);
      const avance = Math.min(d, v * dt);
      if (d > 0) {
        p.x += (dx / d) * avance;
        p.y += (dy / d) * avance;
      }
    }

    // Las puertas dejan pasar a su ritmo.
    r.salidas.forEach((s, i) => {
      if (this.salidasPerdidas.has(i)) {
        // La cola de una salida perdida vuelve a buscar otra.
        for (const k of this.colas[i]) this.personas[k].estado = Estado.Caminando;
        this.colas[i] = [];
        return;
      }
      this.fichas[i] += (caudalDeSalida(s.puerta) / 60) * dt;
      while (this.fichas[i] >= 1 && this.colas[i].length > 0) {
        this.fichas[i] -= 1;
        const k = this.colas[i].shift()!;
        this.personas[k].estado = Estado.Fuera;
        this.contadores[i].personas++;
        this.contadores[i].ultimaEn = this.tiempo;
      }
      if (this.colas[i].length === 0) this.fichas[i] = Math.min(this.fichas[i], 1);
    });

    if (this.plantaAltaVaciaEn === null && r.plantas > 1) {
      const arriba = this.personas.some((p) => p.piso > 0 && p.estado !== Estado.Fuera && p.estado !== Estado.EnEscalera);
      if (!arriba) this.plantaAltaVaciaEn = this.tiempo;
    }

    if (this.tiempo >= this.siguienteMuestra) this.muestrear();

    const pendientes = this.personas.some((p) => p.estado !== Estado.Fuera && p.estado !== Estado.Atrapada);
    if (!pendientes || this.tiempo >= TIEMPO_MAXIMO) {
      if (this.tiempo >= TIEMPO_MAXIMO) {
        for (const p of this.personas) if (p.estado !== Estado.Fuera) p.estado = Estado.Atrapada;
      }
      this.terminada = true;
      this.muestrear();
    }
  }

  private muestrear() {
    const fuera = this.personas.filter((p) => p.estado === Estado.Fuera).length;
    this.muestras.push({
      t: Math.round(this.tiempo),
      fuera,
      dentro: this.personas.length - fuera,
      plantaAlta: this.personas.filter((p) => p.piso > 0 && p.estado !== Estado.Fuera).length,
    });
    this.siguienteMuestra = Math.floor(this.tiempo) + 1;
  }

  // ── Resultados ────────────────────────────────────────────────

  get fuera() {
    return this.personas.reduce((n, p) => n + (p.estado === Estado.Fuera ? 1 : 0), 0);
  }

  get atrapadas() {
    return this.personas.reduce((n, p) => n + (p.estado === Estado.Atrapada ? 1 : 0), 0);
  }

  get afectadas() {
    return this.personas.reduce((n, p) => n + (p.afectada ? 1 : 0), 0);
  }

  /** El tiempo en que salió el último: el tiempo de evacuación. */
  get tiempoTotal(): number | null {
    if (!this.terminada) return null;
    const ultimos = this.contadores.map((c) => c.ultimaEn ?? 0);
    return ultimos.length === 0 ? null : Math.max(...ultimos);
  }

  get porSalida(): ResultadoDeSalida[] {
    return this.rejilla.salidas.map((s, i) => ({
      indice: i,
      nombre: s.puerta.nombre,
      piso: s.piso,
      personas: this.contadores[i].personas,
      caudal: caudalDeSalida(s.puerta),
      ultimaEn: this.contadores[i].ultimaEn,
      perdida: this.salidasPerdidas.has(i),
    }));
  }

  /** El recorrido más largo que tuvo que hacer alguien, en metros. */
  get recorridoMaximo(): number {
    return this.personas.reduce((m, p) => (Number.isFinite(p.recorridoInicial) ? Math.max(m, p.recorridoInicial) : m), 0);
  }
}

/** Una evacuación entera de golpe, sin animar: para los números. */
export function simularHastaElFinal(rejilla: Rejilla, opciones: Opciones): Simulacion {
  const s = new Simulacion(rejilla, opciones);
  while (!s.terminada) s.avanzar(5);
  return s;
}

export function formatearSegundos(s: number): string {
  if (!Number.isFinite(s)) return "—";
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const r = total % 60;
  return m > 0 ? `${m} min ${r.toString().padStart(2, "0")} s` : `${r} s`;
}
