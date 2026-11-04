import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_ESTADO_DE_RESERVA,
  NOMBRE_DE_INCIDENCIA,
  NOMBRE_DE_PAGO,
  apuntarIncidencia,
  aHoraDeSala,
  deHoraDeSala,
  estadoVisible,
  guardarNotasDeCierre,
  horaDeSala,
  lanzarAgente,
  quitarIncidencia,
  soles,
  verExpediente,
  verExpedienteComoTexto,
  type ExpedienteDeNoche,
  type MetodoDePago,
  type TipoDeIncidencia,
} from "../api";
import { useCarga } from "../datos";
import "./expediente.css";

/**
 * Cómo fue la noche: todo lo que pasó en un evento, en una sola pantalla.
 *
 * Antes había que abrir pedidos, puerta, caja, promotores y gastos por separado
 * y sumar de cabeza. Aquí llega cruzado y por pestañas, de lo general (el
 * resumen) a lo concreto (cada caja, cada producto, cada promotor).
 *
 * Es el mismo expediente que recibe la IA para escribir el informe de cierre:
 * el botón «Ver lo que lee la IA» enseña el texto exacto.
 */

type Pestana = "resumen" | "asistencia" | "taquilla" | "barra" | "promotores" | "reservas" | "costes" | "incidencias";

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "asistencia", texto: "Asistencia" },
  { id: "taquilla", texto: "Taquilla" },
  { id: "barra", texto: "Barra" },
  { id: "promotores", texto: "Promotores" },
  { id: "reservas", texto: "Reservas y público" },
  { id: "costes", texto: "Costes" },
  { id: "incidencias", texto: "Incidencias" },
];

const MAGENTA = "#f2368f";
const VIOLETA = "#9366f2";
const REJILLA = "rgb(255 255 255 / 0.07)";
const TEXTO_EJE = "#81778f";

const NUMERO = new Intl.NumberFormat("es-PE");

function metodo(m: string): string {
  return NOMBRE_DE_PAGO[m as MetodoDePago] ?? (m === "SIN_DATO" ? "Sin dato" : m);
}

function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** «+12 %» en verde o «−8 %» en rojo. Sin dato, nada. */
function Variacion({ valor }: { valor: number | null }) {
  if (valor === null) return null;
  if (valor === 0) return <span className="sutil">igual que la media</span>;
  return (
    <span className={valor > 0 ? "variacion--sube" : "variacion--baja"}>
      {valor > 0 ? "+" : "−"}
      {Math.abs(valor)} % vs. media
    </span>
  );
}

/** Una barra de proporción dentro de una celda. */
function Barrita({ parte, total, violeta = false }: { parte: number; total: number; violeta?: boolean }) {
  return (
    <span
      className={violeta ? "barrita barrita--violeta" : "barrita"}
      style={{ width: `${Math.max(2, pct(parte, total))}%` }}
      aria-hidden
    />
  );
}

/** Una gráfica de barras por hora. Pequeña: es apoyo de la tabla, no protagonista. */
function PorHora({
  datos,
  clave,
  color,
  dinero = false,
  etiqueta,
}: {
  datos: { hora: string; valor: number }[];
  clave: string;
  color: string;
  dinero?: boolean;
  etiqueta: string;
}) {
  if (datos.length === 0) return <p className="sutil">Sin datos por hora.</p>;
  return (
    <div className="grafica__lienzo" role="img" aria-label={etiqueta}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={datos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={REJILLA} />
          <XAxis dataKey="hora" tick={{ fill: TEXTO_EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: TEXTO_EJE, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={dinero ? 64 : 40}
            tickFormatter={(v: number) => (dinero ? `S/ ${NUMERO.format(Math.round(v / 100))}` : NUMERO.format(v))}
          />
          <Tooltip
            cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
            isAnimationActive={false}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="grafica__tooltip">
                  <p className="grafica__tooltip-titulo">{payload[0].payload.hora}</p>
                  <p>
                    <b>
                      {dinero
                        ? soles(payload[0].payload.valor as number)
                        : `${NUMERO.format(payload[0].payload.valor as number)} personas`}
                    </b>
                  </p>
                </div>
              ) : null
            }
          />
          <Bar dataKey={clave} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Expediente() {
  const { slug = "" } = useParams();
  const navegar = useNavigate();
  const [version, setVersion] = useState(0);
  const carga = useCarga(() => verExpediente(slug), [slug, version]);
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [textoIa, setTextoIa] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

  if (carga.fase === "cargando") return <p className="aviso">Juntando todo lo de la noche…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="el expediente de la noche" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const x = carga.datos;
  const n = x.noche;
  const estado = estadoVisible(n.estado, n.empiezaA);
  const recargar = () => setVersion((v) => v + 1);

  async function pedirInforme() {
    setPidiendo(true);
    try {
      const r = await lanzarAgente("reporter", slug);
      toast.success(r.mensaje, {
        action: { label: "Ver propuesta", onClick: () => navegar("/panel/propuestas") },
      });
    } catch (e) {
      toast.error(e instanceof ErrorDeApi ? e.message : "No se pudo pedir el informe.");
    } finally {
      setPidiendo(false);
    }
  }

  async function alternarTextoIa() {
    if (textoIa !== null) {
      setTextoIa(null);
      return;
    }
    try {
      setTextoIa(await verExpedienteComoTexto(slug));
    } catch (e) {
      toast.error(e instanceof ErrorDeApi ? e.message : "No se pudo cargar el texto.");
    }
  }

  return (
    <section>
      <p className="migas">
        <Link to="/panel/noches" className="enlace">
          ← Noches celebradas
        </Link>
        {" · "}
        <Link to={`/panel/eventos/${n.slug}`} className="enlace">
          Ficha de la noche
        </Link>
      </p>

      <header className="cabecera">
        <div>
          <h2>{n.titulo}</h2>
          <p className="sutil">
            {n.diaDeLaSemana} · {horaDeSala(n.empiezaA, { dateStyle: "long" })} · {n.sala}, aforo {n.aforo}
            {n.cartel.length > 0 && ` · ${n.cartel.join(", ")}`}
          </p>
        </div>
        <div className="cabecera__acciones">
          <span className={estado.clase}>{estado.texto}</span>
          {n.pasada && (
            <button type="button" className="boton" onClick={() => void pedirInforme()} disabled={pidiendo}>
              {pidiendo ? "La IA está escribiendo…" : "Pedir informe a la IA"}
            </button>
          )}
          <button type="button" className="boton-fantasma" onClick={() => void alternarTextoIa()}>
            {textoIa === null ? "Ver lo que lee la IA" : "Ocultar texto de la IA"}
          </button>
        </div>
      </header>

      {textoIa !== null && <pre className="texto-ia">{textoIa}</pre>}

      {x.avisos.length > 0 && (
        <ul className="avisos">
          {x.avisos.map((a, i) => (
            <li key={i} className={`aviso-noche--${a.tono}`}>
              {a.texto}
            </li>
          ))}
        </ul>
      )}

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{NUMERO.format(x.asistencia.dentro)}</p>
          <p className="tarjeta__pie">
            Personas dentro{x.asistencia.ocupacionPct !== null && ` · ${x.asistencia.ocupacionPct} % del aforo`}
            <br />
            <Variacion valor={x.comparativa.dentroVsMediaPct} />
          </p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(x.taquilla.brutoCentimos)}</p>
          <p className="tarjeta__pie">
            Taquilla · {NUMERO.format(x.taquilla.entradasVendidas)} entradas
            <br />
            <Variacion valor={x.comparativa.taquillaVsMediaPct} />
          </p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(x.barra.totalCentimos)}</p>
          <p className="tarjeta__pie">
            Barra · {NUMERO.format(x.barra.tickets)} tickets
            <br />
            <Variacion valor={x.comparativa.barraVsMediaPct} />
          </p>
        </div>
        <div className={`tarjeta ${x.resultado.resultadoCentimos < 0 ? "tarjeta--alerta" : ""}`}>
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(x.resultado.resultadoCentimos)}</p>
          <p className="tarjeta__pie">
            Resultado{x.resultado.margenPct !== null && ` · ${x.resultado.margenPct} % de margen`}
          </p>
        </div>
      </div>

      <div className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={pestana === p.id ? "pestana pestana--activa" : "pestana"}
            onClick={() => setPestana(p.id)}
          >
            {p.texto}
            {p.id === "incidencias" && x.incidencias.length > 0 && ` (${x.incidencias.length})`}
          </button>
        ))}
      </div>

      {pestana === "resumen" && <Resumen x={x} />}
      {pestana === "asistencia" && <Asistencia x={x} />}
      {pestana === "taquilla" && <Taquilla x={x} />}
      {pestana === "barra" && <BarraDeLaNoche x={x} />}
      {pestana === "promotores" && <Promotores x={x} />}
      {pestana === "reservas" && <ReservasYPublico x={x} />}
      {pestana === "costes" && <Costes x={x} />}
      {pestana === "incidencias" && <Incidencias x={x} alCambiar={recargar} />}
    </section>
  );
}

// ── Pestañas ─────────────────────────────────────────────────────

function Resumen({ x }: { x: ExpedienteDeNoche }) {
  const c = x.comparativa;
  return (
    <div className="dos-columnas">
      <div className="apartado">
        <h3 className="subtitulo">Las cifras de la noche</h3>
        <dl className="fichas">
          <div>
            <dt>Entraron con entrada</dt>
            <dd>
              {NUMERO.format(x.asistencia.entraronConEntrada)} de {NUMERO.format(x.asistencia.entradasEmitidas)}
            </dd>
          </div>
          <div>
            <dt>Por lista de invitados</dt>
            <dd>
              {x.asistencia.invitadosEntraron} de {x.asistencia.invitadosApuntados}
            </dd>
          </div>
          <div>
            <dt>Hora pico</dt>
            <dd>{x.asistencia.pico ? `${x.asistencia.pico.hora} (${x.asistencia.pico.personas})` : "—"}</dd>
          </div>
          <div>
            <dt>Gasto en barra por persona</dt>
            <dd className="precio">
              {x.barra.gastoPorPersonaCentimos === null ? "—" : soles(x.barra.gastoPorPersonaCentimos)}
            </dd>
          </div>
          <div>
            <dt>Ingresos</dt>
            <dd className="precio">{soles(x.resultado.ingresosCentimos)}</dd>
          </div>
          <div>
            <dt>Costes</dt>
            <dd className="precio">{soles(x.resultado.costesCentimos)}</dd>
          </div>
          <div>
            <dt>Compradores nuevos</dt>
            <dd>
              {x.publico.nuevos} de {x.publico.compradores}
            </dd>
          </div>
          <div>
            <dt>Reservas</dt>
            <dd>
              {x.reservas.sentadas} sentadas de {x.reservas.total}
            </dd>
          </div>
        </dl>
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Frente a noches parecidas</h3>
        {c.noches === 0 ? (
          <p className="sutil">No hay noches anteriores del mismo día con las que comparar.</p>
        ) : (
          <>
            <p className="sutil">Media de {c.criterio}.</p>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th></th>
                    <th className="num">Esta noche</th>
                    <th className="num">Media</th>
                    <th className="num">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Personas dentro</td>
                    <td className="num">{NUMERO.format(x.asistencia.dentro)}</td>
                    <td className="num">{NUMERO.format(c.mediaDentro)}</td>
                    <td className="num">
                      <Variacion valor={c.dentroVsMediaPct} />
                    </td>
                  </tr>
                  <tr>
                    <td>Taquilla</td>
                    <td className="num">{soles(x.taquilla.brutoCentimos)}</td>
                    <td className="num">{soles(c.mediaTaquillaCentimos)}</td>
                    <td className="num">
                      <Variacion valor={c.taquillaVsMediaPct} />
                    </td>
                  </tr>
                  <tr>
                    <td>Barra</td>
                    <td className="num">{soles(x.barra.totalCentimos)}</td>
                    <td className="num">{soles(c.mediaBarraCentimos)}</td>
                    <td className="num">
                      <Variacion valor={c.barraVsMediaPct} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <details className="grafica__tabla">
              <summary>Ver las noches de referencia</summary>
              <ul>
                {c.referencias.map((r) => (
                  <li key={r.slug}>
                    <Link to={`/panel/eventos/${r.slug}/noche`} className="enlace">
                      {r.titulo}
                    </Link>{" "}
                    <span className="sutil">
                      · {horaDeSala(r.empiezaA, { dateStyle: "medium" })} · {r.dentro} personas ·{" "}
                      {soles(r.taquillaCentimos + r.barraCentimos)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        {x.notasDeCierre && (
          <>
            <h3 className="subtitulo">Notas de cierre</h3>
            <p className="descripcion">{x.notasDeCierre}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Asistencia({ x }: { x: ExpedienteDeNoche }) {
  const a = x.asistencia;
  return (
    <>
      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{NUMERO.format(a.entradasEmitidas)}</p>
          <p className="tarjeta__pie">Entradas emitidas</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{NUMERO.format(a.entraronConEntrada)}</p>
          <p className="tarjeta__pie">Pasaron por la puerta con entrada</p>
        </div>
        <div className={`tarjeta ${a.noVinieronPct !== null && a.noVinieronPct >= 20 ? "tarjeta--alerta" : ""}`}>
          <p className="tarjeta__cifra">{x.noche.pasada ? NUMERO.format(a.noVinieron) : "—"}</p>
          <p className="tarjeta__pie">
            Compraron y no vinieron{a.noVinieronPct !== null && ` · ${a.noVinieronPct} %`}
          </p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">
            {a.invitadosEntraron}
            <span className="sutil"> / {a.invitadosApuntados}</span>
          </p>
          <p className="tarjeta__pie">Invitados de lista que entraron</p>
        </div>
      </div>

      <figure className="grafica">
        <figcaption className="grafica__cabecera">
          <h3 className="grafica__titulo">Entrada de gente por hora</h3>
          {a.primeraEntrada && a.ultimaEntrada && (
            <span className="grafica__leyenda">
              Primera {horaDeSala(a.primeraEntrada, { timeStyle: "short" })} · última{" "}
              {horaDeSala(a.ultimaEntrada, { timeStyle: "short" })}
            </span>
          )}
        </figcaption>
        <PorHora
          datos={a.porHora.map((h) => ({ hora: h.hora, valor: h.personas }))}
          clave="valor"
          color={MAGENTA}
          etiqueta="Personas que entraron en cada hora de la noche"
        />
      </figure>

      {a.porPuerta.length > 0 && (
        <div className="apartado">
          <h3 className="subtitulo">Por puerta</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Puerta</th>
                  <th className="num">Personas</th>
                </tr>
              </thead>
              <tbody>
                {a.porPuerta.map((p) => (
                  <tr key={p.puerta}>
                    <td>
                      {p.puerta}
                      <Barrita parte={p.personas} total={a.entraronConEntrada} />
                    </td>
                    <td className="num">{NUMERO.format(p.personas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Taquilla({ x }: { x: ExpedienteDeNoche }) {
  const t = x.taquilla;
  return (
    <>
      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(t.brutoCentimos)}</p>
          <p className="tarjeta__pie">
            Cobrado · {soles(t.gestionCentimos)} de gastos de gestión
          </p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{NUMERO.format(t.pedidosPagados)}</p>
          <p className="tarjeta__pie">Pedidos pagados · ticket medio {soles(t.ticketMedioCentimos)}</p>
        </div>
        <div className={`tarjeta ${t.pendientes > 0 ? "tarjeta--alerta" : ""}`}>
          <p className="tarjeta__cifra">{t.pendientes}</p>
          <p className="tarjeta__pie">Pendientes de pago</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{t.devueltos + t.cancelados}</p>
          <p className="tarjeta__pie">
            Cancelados o devueltos{t.devueltoCentimos > 0 && ` · ${soles(t.devueltoCentimos)} devueltos`}
          </p>
        </div>
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Por tipo de entrada</h3>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Tipo</th>
                <th className="num">Precio</th>
                <th className="num">Vendidas</th>
                <th className="num">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {t.porTipo.map((p) => (
                <tr key={p.tipo}>
                  <td>
                    {p.tipo}
                    <Barrita parte={p.vendidas} total={p.cupo} />
                  </td>
                  <td className="num">{soles(p.precioCentimos)}</td>
                  <td className="num">
                    {p.vendidas}
                    <span className="sutil"> / {p.cupo}</span>
                  </td>
                  <td className="num precio">{soles(p.ingresosCentimos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dos-columnas">
        <div className="apartado">
          <h3 className="subtitulo">Por canal de venta</h3>
          {t.porCanal.length === 0 ? (
            <p className="sutil">Sin pedidos pagados.</p>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Canal</th>
                    <th className="num">Entradas</th>
                    <th className="num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {t.porCanal.map((c) => (
                    <tr key={c.canal}>
                      <td>
                        {c.canal}
                        <Barrita parte={c.centimos} total={t.brutoCentimos} />
                      </td>
                      <td className="num">{c.entradas}</td>
                      <td className="num precio">{soles(c.centimos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <TablaDeMetodos titulo="Por método de pago" filas={t.porMetodo} total={t.brutoCentimos} />
      </div>
    </>
  );
}

function TablaDeMetodos({
  titulo,
  filas,
  total,
}: {
  titulo: string;
  filas: ExpedienteDeNoche["taquilla"]["porMetodo"];
  total: number;
}) {
  return (
    <div className="apartado">
      <h3 className="subtitulo">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="sutil">Sin cobros.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Método</th>
                <th className="num">Operaciones</th>
                <th className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m.metodo}>
                  <td>
                    {metodo(m.metodo)}
                    <Barrita parte={m.centimos} total={total} violeta />
                  </td>
                  <td className="num">{m.operaciones}</td>
                  <td className="num precio">{soles(m.centimos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BarraDeLaNoche({ x }: { x: ExpedienteDeNoche }) {
  const b = x.barra;
  const [todos, setTodos] = useState(false);
  const productos = todos ? b.productos : b.productos.slice(0, 10);
  return (
    <>
      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(b.totalCentimos)}</p>
          <p className="tarjeta__pie">
            Facturado · {NUMERO.format(b.unidades)} unidades
          </p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(b.ticketMedioCentimos)}</p>
          <p className="tarjeta__pie">Ticket medio · {NUMERO.format(b.tickets)} tickets</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">
            {b.gastoPorPersonaCentimos === null ? "—" : soles(b.gastoPorPersonaCentimos)}
          </p>
          <p className="tarjeta__pie">Gasto por persona dentro</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(b.margenCentimos)}</p>
          <p className="tarjeta__pie">Margen bruto estimado (coste {soles(b.costeProductoCentimos)})</p>
        </div>
      </div>

      <div className="dos-columnas">
        <div className="apartado">
          <h3 className="subtitulo">Cuánto vendió cada barra</h3>
          {b.porBarra.length === 0 ? (
            <p className="sutil">No hay ventas de barra atribuidas a esta noche.</p>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Barra</th>
                    <th className="num">Tickets</th>
                    <th className="num">Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {b.porBarra.map((p) => (
                    <tr key={p.barra}>
                      <td>
                        {p.barra}
                        <span className="sutil">
                          {" "}
                          · {p.cajas} {p.cajas === 1 ? "caja" : "cajas"}
                        </span>
                        <Barrita parte={p.centimos} total={b.totalCentimos} />
                      </td>
                      <td className="num">{p.tickets}</td>
                      <td className="num precio">{soles(p.centimos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <TablaDeMetodos titulo="Por método de pago" filas={b.porMetodo} total={b.totalCentimos} />
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Cada caja (quién cobró y si cuadró)</h3>
        {b.cajas.length === 0 ? (
          <p className="sutil">Ninguna caja cobró para esta noche.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Barra</th>
                  <th>Turno</th>
                  <th className="num">Tickets</th>
                  <th className="num">Vendido</th>
                  <th className="num">En efectivo</th>
                  <th className="num">Cuadre</th>
                </tr>
              </thead>
              <tbody>
                {b.cajas.map((c) => (
                  <tr key={c.id} className={c.descuadreCentimos ? "fila--alerta" : undefined}>
                    <td>
                      <Link to={`/panel/caja/${c.id}`} className="enlace">
                        {c.responsable}
                      </Link>
                    </td>
                    <td>{c.barra}</td>
                    <td className="sutil">
                      {horaDeSala(c.abiertaEn, { timeStyle: "short" })}
                      {" – "}
                      {c.cerradaEn ? horaDeSala(c.cerradaEn, { timeStyle: "short" }) : "abierta"}
                    </td>
                    <td className="num">{c.tickets}</td>
                    <td className="num precio">{soles(c.vendidoCentimos)}</td>
                    <td className="num">{soles(c.efectivoCentimos)}</td>
                    <td className="num">
                      {c.cerradaEn === null ? (
                        <span className="estado estado--agotado">Sin cerrar</span>
                      ) : !c.descuadreCentimos ? (
                        <span className="estado estado--publicado">Cuadró</span>
                      ) : (
                        <span className="estado estado--agotado">
                          {c.descuadreCentimos > 0 ? "Sobran " : "Faltan "}
                          {soles(Math.abs(c.descuadreCentimos))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <figure className="grafica">
        <figcaption className="grafica__cabecera">
          <h3 className="grafica__titulo">Ventas de barra por hora</h3>
        </figcaption>
        <PorHora
          datos={b.porHora.map((h) => ({ hora: h.hora, valor: h.centimos }))}
          clave="valor"
          color={VIOLETA}
          dinero
          etiqueta="Lo facturado en barra en cada hora de la noche"
        />
      </figure>

      <div className="apartado">
        <h3 className="subtitulo">Productos</h3>
        {b.productos.length === 0 ? (
          <p className="sutil">Sin ventas.</p>
        ) : (
          <>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Unidades</th>
                    <th className="num">Ingresos</th>
                    <th className="num">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.producto}>
                      <td>
                        {p.producto} <span className="sutil">· {p.categoria}</span>
                        <Barrita parte={p.ingresosCentimos} total={b.productos[0].ingresosCentimos} violeta />
                      </td>
                      <td className="num">{p.unidades}</td>
                      <td className="num precio">{soles(p.ingresosCentimos)}</td>
                      <td className="num">
                        {soles(p.margenCentimos)}
                        <span className="sutil"> · {pct(p.margenCentimos, p.ingresosCentimos)} %</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {b.productos.length > 10 && (
              <button type="button" className="boton-fantasma" onClick={() => setTodos((t) => !t)}>
                {todos ? "Ver solo los 10 primeros" : `Ver los ${b.productos.length} productos`}
              </button>
            )}
            <p className="sutil">
              El margen usa el coste actual de cada producto: sirve para ver el orden de magnitud, no para la
              contabilidad.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Promotores({ x }: { x: ExpedienteDeNoche }) {
  if (x.promotores.length === 0) {
    return <p className="aviso">Ningún promotor vendió ni trajo lista para esta noche.</p>;
  }
  return (
    <div className="apartado">
      <h3 className="subtitulo">Lo que trajo cada promotor</h3>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Promotor</th>
              <th className="num">Entradas</th>
              <th className="num">Vendido</th>
              <th className="num">Lista</th>
              <th className="num">A pagar</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {x.promotores.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/panel/promotores/${p.id}`} className="enlace">
                    <strong>{p.nombre}</strong>
                  </Link>{" "}
                  <span className="sutil">· {p.codigo}</span>
                </td>
                <td className="num">{p.entradas}</td>
                <td className="num precio">{soles(p.ventasCentimos)}</td>
                <td className="num">
                  {x.noche.pasada ? p.entraron : "—"}
                  <span className="sutil"> / {p.apuntados}</span>
                </td>
                <td className="num precio">
                  <strong>{soles(p.aPagarCentimos)}</strong>
                  <br />
                  <span className="sutil">
                    {p.comisionPct} % = {soles(p.comisionCentimos)}
                    {p.bonoCentimos > 0 && ` + ${soles(p.bonoCentimos)} por cabeza`}
                  </span>
                </td>
                <td>
                  {!x.noche.pasada ? (
                    <span className="estado">Por celebrar</span>
                  ) : p.liquidado ? (
                    <span className="estado estado--publicado">Pagado</span>
                  ) : (
                    <span className="estado estado--agotado">Pendiente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReservasYPublico({ x }: { x: ExpedienteDeNoche }) {
  const r = x.reservas;
  const p = x.publico;
  return (
    <div className="dos-columnas">
      <div className="apartado">
        <h3 className="subtitulo">Reservados</h3>
        {r.total === 0 ? (
          <p className="sutil">No hubo reservas de box.</p>
        ) : (
          <>
            <p className="sutil">
              {r.sentadas} sentadas · {r.confirmadas} confirmadas · {r.noVinieron} no vinieron · {r.canceladas}{" "}
              canceladas · depósitos {soles(r.depositosCentimos)}
            </p>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Box</th>
                    <th>Cliente</th>
                    <th className="num">Personas</th>
                    <th>Estado</th>
                    <th className="num">Depósito</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lista.map((b, i) => (
                    <tr key={i}>
                      <td>{b.box}</td>
                      <td>{b.cliente}</td>
                      <td className="num">{b.personas}</td>
                      <td>{NOMBRE_DE_ESTADO_DE_RESERVA[b.estado] ?? b.estado}</td>
                      <td className="num">{soles(b.depositoCentimos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Quién compró</h3>
        {p.compradores === 0 ? (
          <p className="sutil">Nadie compró entradas para esta noche.</p>
        ) : (
          <>
            <dl className="fichas">
              <div>
                <dt>Compradores</dt>
                <dd>{p.compradores}</dd>
              </div>
              <div>
                <dt>Primera vez</dt>
                <dd>
                  {p.nuevos} <span className="sutil">({pct(p.nuevos, p.compradores)} %)</span>
                </dd>
              </div>
              <div>
                <dt>Ya habían venido</dt>
                <dd>{p.recurrentes}</dd>
              </div>
              <div>
                <dt>Edad media</dt>
                <dd>{p.edadMedia === null ? "—" : `${p.edadMedia} años`}</dd>
              </div>
              <div>
                <dt>Aceptan publicidad</dt>
                <dd>{p.aceptanPublicidad}</dd>
              </div>
            </dl>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Distrito</th>
                    <th className="num">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {p.distritos.map((d) => (
                    <tr key={d.distrito}>
                      <td>
                        {d.distrito}
                        <Barrita parte={d.clientes} total={p.compradores} />
                      </td>
                      <td className="num">{d.clientes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Costes({ x }: { x: ExpedienteDeNoche }) {
  const c = x.costes;
  const filas: { concepto: string; centimos: number; detalle: string }[] = [
    {
      concepto: "Gastos de la noche",
      centimos: c.gastosCentimos,
      detalle: c.gastosPorCategoria.map((g) => `${g.categoria} ${soles(g.centimos)}`).join(" · ") || "Ninguno apuntado",
    },
    {
      concepto: "Personal",
      centimos: c.personalCentimos,
      detalle:
        c.personalPorPuesto.map((p) => `${p.puesto}: ${p.personas} pers., ${p.horas} h`).join(" · ") ||
        "Sin turnos registrados para esta noche",
    },
    { concepto: "Comisiones de promotores", centimos: c.comisionesCentimos, detalle: "Porcentaje y pago por cabeza" },
    { concepto: "Coste del producto de barra", centimos: c.costeProductoCentimos, detalle: "Al coste actual de cada producto" },
  ];
  return (
    <>
      <div className="apartado">
        <h3 className="subtitulo">De dónde sale el resultado</h3>
        <div className="tabla-scroll">
          <table className="tabla">
            <tbody>
              <tr>
                <td>
                  <strong>Ingresos</strong>
                  <br />
                  <span className="sutil">
                    Taquilla {soles(x.taquilla.brutoCentimos)} + barra {soles(x.barra.totalCentimos)}
                  </span>
                </td>
                <td className="num precio">
                  <strong>{soles(x.resultado.ingresosCentimos)}</strong>
                </td>
              </tr>
              {filas.map((f) => (
                <tr key={f.concepto}>
                  <td>
                    − {f.concepto}
                    <br />
                    <span className="sutil">{f.detalle}</span>
                  </td>
                  <td className="num precio">{soles(f.centimos)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Resultado</strong>
                  {x.resultado.margenPct !== null && <span className="sutil"> · {x.resultado.margenPct} % de margen</span>}
                </td>
                <td className="num precio">
                  <strong>{soles(x.resultado.resultadoCentimos)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="sutil">
          Los depósitos de los reservados no se suman a los ingresos: se consumen en barra y ya están en lo vendido allí.
          Los gastos se apuntan en <Link to="/panel/gastos" className="enlace">Gastos</Link> eligiendo esta noche.
        </p>
      </div>
    </>
  );
}

function Incidencias({ x, alCambiar }: { x: ExpedienteDeNoche; alCambiar: () => void }) {
  const slug = x.noche.slug;
  const [tipo, setTipo] = useState<TipoDeIncidencia>("OPERACION");
  const [descripcion, setDescripcion] = useState("");
  const [hora, setHora] = useState(() =>
    aHoraDeSala(x.noche.pasada ? x.noche.empiezaA : new Date().toISOString()),
  );
  const [notas, setNotas] = useState(x.notasDeCierre ?? "");
  const [guardando, setGuardando] = useState(false);

  async function apuntar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await apuntarIncidencia(slug, { tipo, descripcion: descripcion.trim(), ocurrioEn: deHoraDeSala(hora) || null });
      toast.success("Incidencia apuntada");
      setDescripcion("");
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo apuntar.");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(id: string) {
    if (!window.confirm("¿Quitar esta incidencia?")) return;
    try {
      await quitarIncidencia(slug, id);
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo quitar.");
    }
  }

  async function guardar() {
    try {
      await guardarNotasDeCierre(slug, notas);
      toast.success("Notas guardadas");
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudieron guardar las notas.");
    }
  }

  return (
    <div className="dos-columnas">
      <div className="apartado">
        <h3 className="subtitulo">Lo que pasó</h3>
        <p className="sutil">
          Peleas, cortes de luz, quejas, ausencias… Explican los números raros cuando se miran un mes después, y la IA
          los usa al escribir el informe.
        </p>
        {x.incidencias.length === 0 ? (
          <p className="sutil">Sin incidencias apuntadas.</p>
        ) : (
          <div>
            {x.incidencias.map((i) => (
              <div key={i.id} className="incidencia">
                <span className="incidencia__hora">{horaDeSala(i.ocurrioEn, { timeStyle: "short" })}</span>
                <div>
                  <span className="etiqueta">{NOMBRE_DE_INCIDENCIA[i.tipo] ?? i.tipo}</span> {i.descripcion}
                  {i.registradaPor && <span className="sutil"> · {i.registradaPor}</span>}
                </div>
                <button type="button" className="boton-fantasma boton--peligro" onClick={() => void quitar(i.id)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <form className="tipo-form" onSubmit={(e) => void apuntar(e)}>
          <div className="tipo-form__campos">
            <label>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeIncidencia)}>
                {(Object.keys(NOMBRE_DE_INCIDENCIA) as TipoDeIncidencia[]).map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_DE_INCIDENCIA[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hora (de la sala)
              <input type="datetime-local" value={hora} onChange={(e) => setHora(e.target.value)} required />
            </label>
            <label className="tipo-form__ancho">
              Qué pasó
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                maxLength={2000}
                rows={3}
                placeholder="Se fue la luz en la barra 10 minutos; se cobró en efectivo mientras tanto."
              />
            </label>
          </div>
          <div className="tipo-form__acciones">
            <button type="submit" disabled={guardando || !descripcion.trim()}>
              {guardando ? "Apuntando…" : "Apuntar incidencia"}
            </button>
          </div>
        </form>
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Notas de cierre</h3>
        <p className="sutil">Cómo fue la noche en palabras de la sala: lo que no sale en ninguna cifra.</p>
        <textarea
          className="campo--ancho"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          maxLength={4000}
          rows={8}
          style={{ width: "100%" }}
          placeholder="El DJ empezó tarde. Mucho público universitario. Faltó hielo a la 1."
        />
        <div className="tipo-form__acciones">
          <button type="button" onClick={() => void guardar()} disabled={notas === (x.notasDeCierre ?? "")}>
            Guardar notas
          </button>
        </div>
      </div>
    </div>
  );
}
