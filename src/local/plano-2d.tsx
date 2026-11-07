import type { PuertaPlano, ZonaPlano } from "./evacuacion";
import { tonoDeZona } from "./evacuacion";

/**
 * Planta del local, en SVG.
 *
 * Es la vista con la que se trabaja: la 3D sirve para entender el sitio, pero
 * para colocar una zona con precisión hace falta mirar desde arriba y ver las
 * medidas. Es también el formato en el que se dibuja un plano de evacuación.
 *
 * Va en SVG y no en canvas porque cada zona es un elemento del documento: se
 * puede enfocar con el teclado, tiene su etiqueta accesible y el clic funciona
 * sin escribir detección de colisiones.
 */

/** Píxeles por metro. Fija la escala de todo el dibujo. */
const ESCALA = 22;
/** Margen alrededor de la planta, en metros. */
const MARGEN = 2;

export function Plano2D({
  planoAncho,
  planoFondo,
  zonas,
  puertas,
  seleccion,
  onSelectZona,
}: {
  planoAncho: number;
  planoFondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  seleccion?: number | null;
  onSelectZona?: (id: number | null) => void;
  /** Si viene, se dibuja hacia dónde evacúa cada zona. */
}) {
  if (planoAncho <= 0 || planoFondo <= 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-line-strong p-6 text-center">
        <p className="text-sm text-ink-soft">
          Pon el ancho y el fondo de la sala en metros y aquí aparecerá su planta.
        </p>
      </div>
    );
  }

  const ancho = (planoAncho + MARGEN * 2) * ESCALA;
  const alto = (planoFondo + MARGEN * 2) * ESCALA;
  const m = (metros: number) => metros * ESCALA;
  const off = MARGEN * ESCALA;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="h-auto w-full rounded-2xl border border-line bg-ground"
      role="img"
      aria-label={`Planta de ${planoAncho} por ${planoFondo} metros con ${zonas.length} zonas`}
    >
      <defs>
        <pattern id="reticula" width={ESCALA} height={ESCALA} patternUnits="userSpaceOnUse">
          <path
            d={`M ${ESCALA} 0 L 0 0 0 ${ESCALA}`}
            fill="none"
            strokeWidth="1"
            style={{ stroke: "var(--color-line)" }}
          />
        </pattern>
        <marker id="flecha" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" style={{ fill: "var(--color-acento)" }} />
        </marker>
      </defs>

      {/* Retícula de un metro dentro del perímetro. */}
      <rect x={off} y={off} width={m(planoAncho)} height={m(planoFondo)} fill="url(#reticula)" />
      <rect
        x={off}
        y={off}
        width={m(planoAncho)}
        height={m(planoFondo)}
        fill="none"
        strokeWidth="2"
        style={{ stroke: "var(--color-line-strong)" }}
      />

      {/* Cotas: sin ellas el dibujo no dice de qué tamaño es el local. */}
      <text
        x={off + m(planoAncho) / 2}
        y={off - 8}
        fontSize="12"
        textAnchor="middle"
        style={{ fill: "var(--color-muted)" }}
      >
        {planoAncho} m
      </text>
      <text
        x={off - 10}
        y={off + m(planoFondo) / 2}
        fontSize="12"
        style={{ fill: "var(--color-muted)" }}
        textAnchor="middle"
        transform={`rotate(-90 ${off - 10} ${off + m(planoFondo) / 2})`}
      >
        {planoFondo} m
      </text>

      {zonas.map((zona) => {
        if (zona.ancho <= 0 || zona.fondo <= 0) return null;
        const activa = seleccion === zona.id;
        const tono = tonoDeZona(zona);
        return (
          <g
            key={zona.id}
            onClick={() => onSelectZona?.(zona.id)}
            className={onSelectZona ? "cursor-pointer" : undefined}
            tabIndex={onSelectZona ? 0 : undefined}
            role={onSelectZona ? "button" : undefined}
            aria-label={`${zona.nombre}, ${zona.ancho} por ${zona.fondo} metros, aforo ${zona.aforo}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectZona?.(zona.id);
              }
            }}
          >
            <rect
              x={off + m(zona.x)}
              y={off + m(zona.y)}
              width={m(zona.ancho)}
              height={m(zona.fondo)}
              fill={`hsl(${tono} 60% 45% / ${activa ? 0.42 : 0.22})`}
              stroke={`hsl(${tono} 70% ${activa ? 68 : 55}%)`}
              strokeWidth={activa ? 2.5 : 1.5}
            />
            <text
              x={off + m(zona.x + zona.ancho / 2)}
              y={off + m(zona.y + zona.fondo / 2) - 4}
              fontSize="13"
              style={{ fill: "var(--color-ink)" }}
              fontWeight="600"
              textAnchor="middle"
            >
              {zona.nombre}
            </text>
            <text
              x={off + m(zona.x + zona.ancho / 2)}
              y={off + m(zona.y + zona.fondo / 2) + 13}
              fontSize="11"
              style={{ fill: "var(--color-ink-soft)" }}
              textAnchor="middle"
            >
              {zona.aforo > 0 ? `${zona.aforo} pers.` : "sin aforo"} · {zona.ancho}×
              {zona.fondo} m
            </text>
          </g>
        );
      })}


      {puertas
        .filter((p) => p.activo)
        .map((puerta) => {
          // Salidas de emergencia en verde, como su cartel; el resto, en tinta.
          const color = puerta.esSalidaEmergencia ? "var(--verde)" : "var(--color-ink)";
          return (
            <g key={puerta.id}>
              <circle
                cx={off + m(puerta.x)}
                cy={off + m(puerta.y)}
                r={Math.max(6, m(puerta.ancho) / 2)}
                strokeWidth="2"
                style={{ fill: color, stroke: "var(--color-ground)" }}
              />
              <text
                x={off + m(puerta.x)}
                y={off + m(puerta.y) - 14}
                fontSize="11"
                fontWeight="600"
                style={{ fill: color }}
                textAnchor="middle"
              >
                {puerta.esSalidaEmergencia ? "SALIDA" : puerta.nombre}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
