import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NocheCelebrada } from "../api";
import { horaDeSala, soles } from "../api";

/**
 * Las últimas noches, en dos gráficas.
 *
 * Dos y no una con dos ejes: asistentes y soles no comparten escala, y un
 * gráfico de doble eje hace que la comparación dependa de dónde se puso cada
 * eje. Cada una con su eje y su pregunta.
 *
 * Paleta validada con el script de la skill de visualización para la superficie
 * oscura (`#161020`): magenta para taquilla, violeta para barra. La asistencia
 * es una sola serie y va en magenta, sin leyenda: el título ya dice qué es.
 */

const MAGENTA = "#f2368f";
const VIOLETA = "#9366f2";
const SUPERFICIE = "#161020";
const REJILLA = "rgb(255 255 255 / 0.07)";
const TEXTO_EJE = "#81778f";

type Fila = {
  slug: string;
  etiqueta: string;
  titulo: string;
  asistentes: number;
  taquilla: number;
  barra: number;
};

function filas(noches: NocheCelebrada[]): Fila[] {
  return noches.map((n) => ({
    slug: n.slug,
    etiqueta: horaDeSala(n.empiezaA, { day: "numeric", month: "short" }).replace(".", ""),
    titulo: n.titulo,
    asistentes: n.asistentes,
    taquilla: n.taquillaCentimos / 100,
    barra: n.barraCentimos / 100,
  }));
}

const compacto = new Intl.NumberFormat("es-PE", { notation: "compact", maximumFractionDigits: 1 });

/** El cuadro del tooltip, con los tokens del panel. */
function Cuadro({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Fila; dataKey: string; value: number; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  const conIngresos = payload.some((p) => p.dataKey === "taquilla");
  return (
    <div className="grafica__tooltip">
      <p className="grafica__tooltip-titulo">{f.titulo}</p>
      <p className="grafica__tooltip-fecha">{f.etiqueta}</p>
      {conIngresos ? (
        <>
          <p>
            <i style={{ background: MAGENTA }} />
            Taquilla <b>{soles(Math.round(f.taquilla * 100))}</b>
          </p>
          <p>
            <i style={{ background: VIOLETA }} />
            Barra <b>{soles(Math.round(f.barra * 100))}</b>
          </p>
          <p className="grafica__tooltip-total">
            Total <b>{soles(Math.round((f.taquilla + f.barra) * 100))}</b>
          </p>
        </>
      ) : (
        <p>
          <b>{f.asistentes}</b> personas entraron
        </p>
      )}
    </div>
  );
}

const ejeX = {
  dataKey: "etiqueta",
  tickLine: false,
  axisLine: { stroke: REJILLA },
  tick: { fill: TEXTO_EJE, fontSize: 11 },
  interval: "preserveStartEnd" as const,
  minTickGap: 8,
};

const ejeY = {
  tickLine: false,
  axisLine: false,
  tick: { fill: TEXTO_EJE, fontSize: 11 },
  width: 44,
};

export function GraficasDeNoches({ noches }: { noches: NocheCelebrada[] }) {
  if (noches.length === 0) return null;
  const datos = filas(noches);
  const media = Math.round(datos.reduce((s, d) => s + d.asistentes, 0) / datos.length);

  return (
    <div className="graficas">
      <figure className="grafica">
        <figcaption className="grafica__cabecera">
          <h3 className="grafica__titulo">Asistencia por noche</h3>
          <span className="sutil">media de {media} personas · últimas {datos.length} noches</span>
        </figcaption>
        <div className="grafica__lienzo" role="img" aria-label="Personas que entraron en cada una de las últimas noches">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={REJILLA} />
              <XAxis {...ejeX} />
              <YAxis {...ejeY} allowDecimals={false} />
              <Tooltip content={<Cuadro />} cursor={{ fill: "rgb(255 255 255 / 0.04)" }} isAnimationActive={false} />
              <Bar dataKey="asistentes" fill={MAGENTA} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <TablaDeNoches datos={datos} />
      </figure>

      <figure className="grafica">
        <figcaption className="grafica__cabecera">
          <h3 className="grafica__titulo">Ingresos por noche</h3>
          <span className="grafica__leyenda">
            <span>
              <i style={{ background: MAGENTA }} />
              Taquilla
            </span>
            <span>
              <i style={{ background: VIOLETA }} />
              Barra
            </span>
          </span>
        </figcaption>
        <div className="grafica__lienzo" role="img" aria-label="Ingresos de taquilla y de barra en cada una de las últimas noches">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={REJILLA} />
              <XAxis {...ejeX} />
              <YAxis {...ejeY} tickFormatter={(v: number) => `S/ ${compacto.format(v)}`} width={58} />
              <Tooltip content={<Cuadro />} cursor={{ fill: "rgb(255 255 255 / 0.04)" }} isAnimationActive={false} />
              {/* El trazo del color de la superficie es el hueco de 2 px entre tramos apilados. */}
              <Bar dataKey="taquilla" stackId="i" fill={MAGENTA} stroke={SUPERFICIE} strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
              <Bar dataKey="barra" stackId="i" fill={VIOLETA} stroke={SUPERFICIE} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}

/** Lo mismo en tabla, para quien no ve la gráfica o quiere la cifra exacta. */
function TablaDeNoches({ datos }: { datos: Fila[] }) {
  return (
    <details className="grafica__tabla">
      <summary>Ver como tabla</summary>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Noche</th>
              <th className="num">Entraron</th>
              <th className="num">Taquilla</th>
              <th className="num">Barra</th>
            </tr>
          </thead>
          <tbody>
            {[...datos].reverse().map((d) => (
              <tr key={d.slug}>
                <td>
                  {d.titulo} <span className="sutil">· {d.etiqueta}</span>
                </td>
                <td className="num">{d.asistentes}</td>
                <td className="num">{soles(Math.round(d.taquilla * 100))}</td>
                <td className="num">{soles(Math.round(d.barra * 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
