import { useEffect, useLayoutEffect, useRef } from "react";
import type { ElementoPlano, PuertaPlano, ZonaPlano } from "../evacuacion";
import { tonoDeZona } from "../evacuacion";
import { esSalida, nombreDePlanta } from "./geometria";
import { Estado, type Simulacion } from "./motor";
import { CELDA, centroDe, type Campo, type PuntoDeRuta, type Rejilla } from "./rejilla";

/**
 * El mapa de evacuación: las plantas vistas desde arriba, con todo lo que pide
 * un plano de evacuación y, si hay simulación, la gente moviéndose.
 *
 * Es un `<canvas>` y no un SVG porque se repinta sesenta veces por segundo con
 * cientos de personas: con SVG serían cientos de nodos del DOM moviéndose.
 *
 * Se lee igual que el cartel colgado junto a la puerta: salidas en verde, rutas
 * con flechas, extintores en rojo, zonas seguras y el punto de reunión en la
 * calle.
 */

export type Plano = {
  ancho: number;
  fondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  elementos: ElementoPlano[];
};

type Props = {
  plano: Plano;
  rejilla: Rejilla;
  campo: Campo;
  simulacion?: Simulacion | null;
  /** Las rutas de evacuación de cada zona. */
  rutas?: PuntoDeRuta[][];
  /** Flechas de flujo por todo el suelo. */
  flechas?: boolean;
  /** Dónde está quien mira y su ruta, para «¿dónde estás?». */
  posicion?: { piso: number; x: number; y: number } | null;
  rutaPropia?: PuntoDeRuta[];
  /** Un incendio aún sin simular, para ver dónde se va a colocar. */
  incendioPrevio?: { piso: number; x: number; y: number; radio: number } | null;
  alPulsar?: (piso: number, x: number, y: number) => void;
  /** Qué plantas se dibujan. Por defecto, todas. */
  plantas?: number[];
  ayuda?: string;
};

const VERDE = "#3ee6a0";
const VERDE_OSCURO = "#0f5a3d";
const ROJO = "#ff4d5e";
const AMBAR = "#ffbe55";
const MAGENTA = "#ff3d9a";
const TINTA = "#f2eff7";
const SUAVE = "#8d8499";
const FONDO = "#0b0710";
const CALLE = "#15121b";

const MARGEN = 1.6;

type Panel = { piso: number; ox: number; oy: number; escala: number; alto: number };

export function MapaDeEvacuacion(props: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const ultimas = useRef(props);
  const paneles = useRef<Panel[]>([]);

  useLayoutEffect(() => {
    ultimas.current = props;
  });

  useEffect(() => {
    let cuadro = 0;
    const pintar = () => {
      dibujar(lienzo.current, contenedor.current, ultimas.current, paneles);
      cuadro = requestAnimationFrame(pintar);
    };
    cuadro = requestAnimationFrame(pintar);
    return () => cancelAnimationFrame(cuadro);
  }, []);

  function pulsar(e: React.PointerEvent<HTMLCanvasElement>) {
    const alPulsar = ultimas.current.alPulsar;
    if (!alPulsar || !lienzo.current) return;
    const caja = lienzo.current.getBoundingClientRect();
    const px = e.clientX - caja.left;
    const py = e.clientY - caja.top;
    for (const p of paneles.current) {
      const x = (px - p.ox) / p.escala - MARGEN;
      const y = (py - p.oy) / p.escala - MARGEN;
      const { ancho, fondo } = ultimas.current.plano;
      if (x >= 0 && y >= 0 && x <= ancho && y <= fondo) {
        alPulsar(p.piso, x, y);
        return;
      }
    }
  }

  return (
    <div ref={contenedor} className="mapa-evacuacion" style={{ position: "relative", width: "100%" }}>
      <canvas
        ref={lienzo}
        onPointerDown={pulsar}
        style={{ display: "block", width: "100%", cursor: props.alPulsar ? "crosshair" : "default", touchAction: "manipulation" }}
        role="img"
        aria-label="Mapa de evacuación del local con salidas, rutas y elementos de seguridad"
      />
      {props.ayuda && (
        <p style={{ position: "absolute", left: 8, bottom: 6, margin: 0, fontSize: 12, color: SUAVE, pointerEvents: "none" }}>
          {props.ayuda}
        </p>
      )}
    </div>
  );
}

// ── El dibujo ───────────────────────────────────────────────────────

function dibujar(
  lienzo: HTMLCanvasElement | null,
  contenedor: HTMLDivElement | null,
  p: Props,
  paneles: React.MutableRefObject<Panel[]>,
) {
  if (!lienzo || !contenedor) return;
  const { plano, rejilla } = p;
  const plantas = p.plantas ?? Array.from({ length: rejilla.plantas }, (_, i) => i);
  const ancho = contenedor.clientWidth;
  if (ancho === 0) return;

  // Lo que asoma fuera del edificio (el punto de reunión en la calle) amplía el dibujo.
  const extraY = Math.max(0, ...plano.elementos.filter((e) => e.y > plano.fondo).map((e) => e.y - plano.fondo + 1.5));
  const anchoM = plano.ancho + MARGEN * 2;
  const altoM = plano.fondo + extraY + MARGEN * 2 + 1.2;

  // Lado a lado si caben con una escala legible; si no, una debajo de otra.
  const enFila = plantas.length > 1 && ancho / plantas.length / anchoM >= 9;
  const columnas = enFila ? plantas.length : 1;
  const escala = Math.min((ancho - (columnas - 1) * 12) / columnas / anchoM, 26);
  const altoPanel = altoM * escala;
  const altoTotal = enFila ? altoPanel : altoPanel * plantas.length + (plantas.length - 1) * 12;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (lienzo.width !== Math.round(ancho * dpr) || lienzo.height !== Math.round(altoTotal * dpr)) {
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(altoTotal * dpr);
    lienzo.style.height = `${altoTotal}px`;
  }
  const ctx = lienzo.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, altoTotal);

  paneles.current = plantas.map((piso, i) => {
    const ox = enFila ? i * (anchoM * escala + 12) : 0;
    const oy = enFila ? 0 : i * (altoPanel + 12);
    return { piso, ox, oy, escala, alto: altoPanel };
  });

  for (const panel of paneles.current) dibujarPlanta(ctx, panel, p, altoM);
}

function dibujarPlanta(ctx: CanvasRenderingContext2D, panel: Panel, p: Props, altoM: number) {
  const { plano, rejilla, campo, simulacion } = p;
  const { piso, ox, oy, escala: e } = panel;
  const X = (x: number) => ox + (x + MARGEN) * e;
  const Y = (y: number) => oy + (y + MARGEN) * e;
  const t = performance.now() / 1000;

  // Fondo del panel y la calle (bajo la fachada, solo en la planta baja).
  ctx.fillStyle = FONDO;
  roundRect(ctx, ox, oy, (plano.ancho + MARGEN * 2) * e, altoM * e, 10);
  ctx.fill();
  if (piso === 0) {
    ctx.fillStyle = CALLE;
    ctx.fillRect(ox, Y(plano.fondo), (plano.ancho + MARGEN * 2) * e, (altoM - plano.fondo - MARGEN) * e);
    ctx.fillStyle = SUAVE;
    ctx.font = `600 ${Math.max(9, e * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("CALLE", X(plano.ancho) - 4, Y(plano.fondo) + e * 1.1);
  }

  // Título de la planta.
  ctx.fillStyle = TINTA;
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.max(11, e * 0.7)}px Inter, system-ui, sans-serif`;
  ctx.fillText(nombreDePlanta(piso).toUpperCase(), ox + 8, oy + Math.max(14, e * 0.95));

  // Zonas de esta planta.
  ctx.textAlign = "center";
  for (const z of plano.zonas) {
    if ((z.piso ?? 0) !== piso || z.ancho <= 0 || z.fondo <= 0) continue;
    const tono = tonoDeZona(z);
    ctx.fillStyle = `hsl(${tono} 55% 40% / 0.2)`;
    ctx.strokeStyle = `hsl(${tono} 65% 58% / 0.65)`;
    ctx.lineWidth = 1;
    ctx.fillRect(X(z.x), Y(z.y), z.ancho * e, z.fondo * e);
    ctx.strokeRect(X(z.x), Y(z.y), z.ancho * e, z.fondo * e);
    ctx.fillStyle = "rgba(242,239,247,0.75)";
    ctx.font = `600 ${Math.max(8, Math.min(e * 0.5, 13))}px Inter, system-ui, sans-serif`;
    ctx.fillText(z.nombre, X(z.x + z.ancho / 2), Y(z.y + z.fondo / 2), z.ancho * e - 4);
  }

  // En la planta alta, el hueco sobre la pista: lo que no es suelo.
  if (piso > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let iz = 0; iz < rejilla.nz; iz++) {
      for (let ix = 0; ix < rejilla.nx; ix++) {
        const g = piso * rejilla.porPlanta + iz * rejilla.nx + ix;
        if (!rejilla.transitable[g]) ctx.fillRect(X(ix * CELDA), Y(iz * CELDA), CELDA * e + 0.5, CELDA * e + 0.5);
      }
    }
  }

  // Muro exterior y paredes interiores.
  ctx.strokeStyle = "#bdb5c9";
  ctx.lineWidth = Math.max(2, e * 0.18);
  ctx.strokeRect(X(0), Y(0), plano.ancho * e, plano.fondo * e);
  ctx.lineWidth = Math.max(1.5, e * 0.12);
  for (const s of rejilla.paredes) {
    if (s.piso !== piso) continue;
    ctx.beginPath();
    ctx.moveTo(X(s.x0), Y(s.y0));
    ctx.lineTo(X(s.x1), Y(s.y1));
    ctx.stroke();
  }

  // Flechas de flujo: hacia dónde se camina desde cada punto.
  if (p.flechas) {
    ctx.strokeStyle = "rgba(62,230,160,0.28)";
    ctx.lineWidth = 1;
    const paso = 4; // cada 2 m
    for (let iz = 2; iz < rejilla.nz; iz += paso) {
      for (let ix = 2; ix < rejilla.nx; ix += paso) {
        const g = piso * rejilla.porPlanta + iz * rejilla.nx + ix;
        const sig = campo.siguiente[g];
        if (!rejilla.transitable[g] || sig < 0) continue;
        const a = centroDe(rejilla, g);
        const b = centroDe(rejilla, sig);
        flecha(ctx, X(a.x), Y(a.y), X(a.x + (b.x - a.x) * 1.6), Y(a.y + (b.y - a.y) * 1.6), e * 0.25);
      }
    }
  }

  // Rutas de evacuación de cada zona.
  if (p.rutas) {
    ctx.setLineDash([e * 0.5, e * 0.3]);
    ctx.lineDashOffset = -t * e * 1.2;
    for (const ruta of p.rutas) dibujarRuta(ctx, ruta, piso, X, Y, VERDE, Math.max(1.5, e * 0.12), 0.85);
    ctx.setLineDash([]);
  }

  // La escalera: dónde se baja.
  for (const esc of rejilla.escaleras) {
    const celdas = piso > 0 ? esc.arriba.filter((g) => Math.floor(g / rejilla.porPlanta) === piso) : esc.abajo;
    if (celdas.length === 0) continue;
    const c = celdas.map((g) => centroDe(rejilla, g));
    const x = c.reduce((s, q) => s + q.x, 0) / c.length;
    const y = c.reduce((s, q) => s + q.y, 0) / c.length;
    ctx.fillStyle = "rgba(163,116,255,0.9)";
    ctx.font = `700 ${Math.max(8, e * 0.45)}px Inter, system-ui, sans-serif`;
    ctx.fillText(piso > 0 ? "▼ ESCALERA" : "▲ ESCALERA", X(x), Y(y));
  }

  // Salidas.
  for (const puerta of plano.puertas) {
    if ((puerta.piso ?? 0) !== piso || !puerta.activo) continue;
    const salida = esSalida(puerta);
    const indice = rejilla.salidas.findIndex((s) => s.puerta.id === puerta.id);
    const perdida = simulacion && indice >= 0 && simulacion.porSalida[indice]?.perdida;
    const w = Math.max(puerta.ancho * e, e * 0.9);
    ctx.fillStyle = !salida ? "#6b6475" : perdida ? ROJO : VERDE;
    ctx.fillRect(X(puerta.x) - w / 2, Y(puerta.y) - e * 0.3, w, e * 0.6);
    if (salida) {
      ctx.fillStyle = perdida ? ROJO : VERDE;
      ctx.font = `800 ${Math.max(8, e * 0.48)}px Inter, system-ui, sans-serif`;
      const etiqueta = perdida ? "✕ BLOQUEADA" : puerta.piso ? "SALIDA ⇣" : "SALIDA";
      const dentro = puerta.y < 1 ? 1.1 : puerta.y > plano.fondo - 1 ? -0.8 : 0;
      const lado = puerta.x < 1 ? 2.2 : puerta.x > plano.ancho - 1 ? -2.2 : 0;
      ctx.fillText(etiqueta, X(puerta.x + lado), Y(puerta.y + dentro) + (dentro === 0 ? -e * 0.6 : 0));
    }
  }

  // Elementos de seguridad.
  for (const el of plano.elementos) {
    if ((el.piso ?? 0) !== piso) continue;
    dibujarElemento(ctx, el, X(el.x), Y(el.y), e);
  }

  // El incendio: foco con resplandor y el radio que bloquea.
  const fuego = simulacion?.incendio ?? null;
  const radio = simulacion?.incendio ? simulacion.radioDelFuego : p.incendioPrevio?.radio ?? 0;
  const foco = fuego ?? p.incendioPrevio ?? null;
  if (foco && foco.piso === piso) {
    const parpadeo = 1 + Math.sin(t * 9) * 0.05;
    const r = radio * e * parpadeo;
    const g = ctx.createRadialGradient(X(foco.x), Y(foco.y), 0, X(foco.x), Y(foco.y), r * 1.6);
    g.addColorStop(0, "rgba(255,210,90,0.95)");
    g.addColorStop(0.35, "rgba(255,90,40,0.75)");
    g.addColorStop(0.7, "rgba(160,30,30,0.35)");
    g.addColorStop(1, "rgba(80,60,70,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X(foco.x), Y(foco.y), r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,77,94,0.9)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(X(foco.x), Y(foco.y), radio * e, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = TINTA;
    ctx.font = `800 ${Math.max(9, e * 0.5)}px Inter, system-ui, sans-serif`;
    ctx.fillText("🔥 INCENDIO", X(foco.x), Y(foco.y) - radio * e - 6);
  }

  // La gente.
  if (simulacion) {
    const rPersona = Math.max(1.6, e * 0.2);
    for (const persona of simulacion.personas) {
      if (persona.piso !== piso || persona.estado === Estado.Fuera) continue;
      ctx.fillStyle =
        persona.estado === Estado.Atrapada
          ? ROJO
          : persona.estado === Estado.EnCola
            ? AMBAR
            : persona.estado === Estado.EnEscalera
              ? "#a374ff"
              : persona.estado === Estado.Esperando
                ? "#d9d3e3"
                : "#7fe7ff";
      ctx.beginPath();
      ctx.arc(X(persona.x), Y(persona.y), rPersona, 0, Math.PI * 2);
      ctx.fill();
      if (persona.afectada) {
        ctx.strokeStyle = ROJO;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // ¿Dónde estás? y su ruta.
  if (p.rutaPropia && p.rutaPropia.length > 1) {
    ctx.setLineDash([]);
    dibujarRuta(ctx, p.rutaPropia, piso, X, Y, MAGENTA, Math.max(3, e * 0.22), 1, true);
  }
  if (p.posicion && p.posicion.piso === piso) {
    const x = X(p.posicion.x);
    const y = Y(p.posicion.y);
    const pulso = (t * 1.4) % 1;
    ctx.strokeStyle = `rgba(255,61,154,${1 - pulso})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, e * (0.4 + pulso * 1.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = MAGENTA;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(4, e * 0.32), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TINTA;
    ctx.font = `800 ${Math.max(9, e * 0.5)}px Inter, system-ui, sans-serif`;
    ctx.fillText("ESTÁS AQUÍ", x, y - e * 0.8);
  }
}

function dibujarRuta(
  ctx: CanvasRenderingContext2D,
  ruta: PuntoDeRuta[],
  piso: number,
  X: (x: number) => number,
  Y: (y: number) => number,
  color: string,
  grosor: number,
  opacidad: number,
  conFlecha = false,
) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacidad;
  ctx.lineWidth = grosor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let abierto = false;
  ctx.beginPath();
  let ultimo: PuntoDeRuta | null = null;
  let penultimo: PuntoDeRuta | null = null;
  for (const q of ruta) {
    if (q.piso !== piso) {
      abierto = false;
      continue;
    }
    if (!abierto) {
      ctx.moveTo(X(q.x), Y(q.y));
      abierto = true;
    } else ctx.lineTo(X(q.x), Y(q.y));
    penultimo = ultimo;
    ultimo = q;
  }
  ctx.stroke();
  if (conFlecha && ultimo && penultimo) {
    flecha(ctx, X(penultimo.x), Y(penultimo.y), X(ultimo.x), Y(ultimo.y), grosor * 2.6);
  }
  ctx.globalAlpha = 1;
}

function flecha(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, punta: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - punta * Math.cos(a - 0.5), y1 - punta * Math.sin(a - 0.5));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - punta * Math.cos(a + 0.5), y1 - punta * Math.sin(a + 0.5));
  ctx.stroke();
}

function dibujarElemento(ctx: CanvasRenderingContext2D, el: ElementoPlano, x: number, y: number, e: number) {
  const r = Math.max(5, e * 0.36);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  switch (el.tipo) {
    case "EXTINTOR":
      ctx.fillStyle = ROJO;
      roundRect(ctx, x - r * 0.6, y - r, r * 1.2, r * 2, r * 0.4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${r * 0.95}px Inter, system-ui, sans-serif`;
      ctx.fillText("E", x, y + 1);
      break;
    case "BOTIQUIN":
      ctx.fillStyle = VERDE_OSCURO;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - r * 0.18, y - r * 0.65, r * 0.36, r * 1.3);
      ctx.fillRect(x - r * 0.65, y - r * 0.18, r * 1.3, r * 0.36);
      break;
    case "LUZ_EMERGENCIA":
      ctx.fillStyle = "#fff7c2";
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.8);
      ctx.lineTo(x + r * 0.8, y);
      ctx.lineTo(x, y + r * 0.8);
      ctx.lineTo(x - r * 0.8, y);
      ctx.closePath();
      ctx.fill();
      break;
    case "ALARMA":
      ctx.fillStyle = ROJO;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${r * 0.9}px Inter, system-ui, sans-serif`;
      ctx.fillText("A", x, y + 1);
      break;
    case "ZONA_SEGURA":
      ctx.fillStyle = VERDE;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#04140d";
      ctx.font = `900 ${r * 0.75}px Inter, system-ui, sans-serif`;
      ctx.fillText("ZS", x, y + 1);
      break;
    case "PUNTO_REUNION": {
      const R = r * 2.2;
      ctx.fillStyle = VERDE;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#04140d";
      ctx.lineWidth = Math.max(1.5, R * 0.12);
      // Cuatro flechas hacia el centro: el símbolo del punto de reunión.
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        flecha(ctx, x + Math.cos(a) * R * 0.85, y + Math.sin(a) * R * 0.85, x + Math.cos(a) * R * 0.3, y + Math.sin(a) * R * 0.3, R * 0.28);
      }
      ctx.fillStyle = VERDE;
      ctx.font = `800 ${Math.max(9, e * 0.5)}px Inter, system-ui, sans-serif`;
      ctx.fillText("PUNTO DE REUNIÓN", x, y + R + Math.max(8, e * 0.5));
      break;
    }
  }
  ctx.textBaseline = "alphabetic";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
