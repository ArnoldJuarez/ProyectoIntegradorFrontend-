import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  decidirPropuesta,
  horaDeSala,
  lanzarAgente,
  listarAgentes,
  soles,
  verBandejaDeIa,
  type AgenteDeIa,
  type Desenlace,
  type NochePropuesta,
  type PropuestaDeIa,
  type PropuestaDeNoches,
} from "../api";
import { useCarga } from "../datos";

/**
 * La bandeja de la IA: lanzar agentes y decidir sobre lo que proponen.
 *
 * Ningún agente publica, envía ni cambia nada por su cuenta. Lo que hace es
 * dejar aquí una propuesta, y solo al aprobarla se crea la campaña, el pedido,
 * el cambio de precio o la noche, siempre en borrador cuando sale hacia fuera.
 *
 * Las noches que propone el programador se pueden retocar antes de aprobar:
 * cambiar el título, mover la hora, ajustar un precio o quitar una de las
 * noches. Lo que se aprueba es lo retocado; lo que dijo la IA queda guardado
 * en su ejecución.
 */

/** Cómo se lee cada campo de las propuestas. Tienen forma distinta según el agente. */
const CAMPOS: Record<string, string> = {
  hook: "Gancho",
  instagram: "Instagram",
  caption: "Texto",
  hashtags: "Hashtags",
  correo: "Correo",
  asunto: "Asunto",
  cuerpo: "Cuerpo",
  findings: "Hallazgos",
  segmento: "Segmento",
  customerCount: "Clientes",
  observation: "Observación",
  campaign: "Campaña propuesta",
  canal: "Canal",
  rationale: "Motivo",
  reasoning: "Razonamiento",
  lineas: "Líneas",
  sku: "SKU",
  productName: "Producto",
  currentStock: "Stock actual",
  suggestedOrder: "Pedir",
  motivo: "Motivo",
  assessment: "Diagnóstico",
  actions: "Acciones",
  eventTitle: "Noche",
  ticketTypeName: "Tipo de entrada",
  currentPriceCents: "Precio actual (céntimos)",
  suggestedPriceCents: "Precio sugerido (céntimos)",
  headline: "Titular",
  resumen: "Resumen",
  metrics: "Métricas",
  label: "Concepto",
  value: "Valor",
  recommendations: "Recomendaciones",
  nombre: "Nombre",
  razonamiento: "Razonamiento",
  noches: "Noches",
};

/** Pinta cualquier JSON de forma legible, sea cual sea el agente que lo produjo. */
function Contenido({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) return <span className="text-muted">—</span>;
  if (typeof valor === "string") {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">{valor}</p>;
  }
  if (typeof valor === "number" || typeof valor === "boolean") {
    return <span className="tnum text-sm text-ink">{String(valor)}</span>;
  }
  if (Array.isArray(valor)) {
    return (
      <ul className="flex flex-col gap-3">
        {valor.map((v, i) => (
          <li key={i} className="rounded-xl border border-line bg-raised p-3">
            <Contenido valor={v} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(valor as Record<string, unknown>).map(([clave, hijo]) => (
        <div key={clave} className="flex flex-col gap-1">
          <span className="eyebrow text-acento-text">{CAMPOS[clave] ?? clave}</span>
          <Contenido valor={hijo} />
        </div>
      ))}
    </div>
  );
}

function BotonDeAgente({ agente, alTerminar }: { agente: AgenteDeIa; alTerminar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; ok: boolean } | null>(null);

  async function lanzar() {
    setOcupado(true);
    setNota(null);
    try {
      const r = await lanzarAgente(agente.clave);
      setNota({ texto: r.mensaje, ok: true });
      toast.success(r.mensaje);
      alTerminar();
    } catch (e) {
      const texto = e instanceof ErrorDeApi ? e.message : "El agente ha fallado.";
      setNota({ texto, ok: false });
      toast.error(texto);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex w-64 flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold">{agente.nombre}</p>
      <p className="text-xs text-muted">{agente.descripcion}</p>
      <button
        type="button"
        onClick={lanzar}
        disabled={ocupado}
        className="mt-auto h-9 rounded-lg border border-acento-dim bg-acento-wash text-sm font-semibold text-acento-text transition-[transform,filter,opacity] duration-150 hover:brightness-125 disabled:opacity-50"
      >
        {ocupado ? "Pensando…" : "Lanzar"}
      </button>
      {nota && (
        <p role="status" className={`text-xs ${nota.ok ? "text-good" : "text-bad"}`}>
          {nota.texto}
        </p>
      )}
    </div>
  );
}

function Decision({
  propuesta,
  alDecidir,
  datos,
  textoAprobar = "Aprobar",
}: {
  propuesta: PropuestaDeIa;
  alDecidir: () => void;
  /** La propuesta retocada a mano, si se retocó. */
  datos?: unknown;
  textoAprobar?: string;
}) {
  const [ocupado, setOcupado] = useState<"APROBAR" | "DESCARTAR" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desenlace, setDesenlace] = useState<Desenlace | null>(null);

  async function decidir(decision: "APROBAR" | "DESCARTAR") {
    setOcupado(decision);
    setError(null);
    try {
      // El resultado se enseña antes de recargar: dice qué se ha creado de
      // verdad y qué queda por hacer a mano.
      const r = await decidirPropuesta(propuesta.id, decision, decision === "APROBAR" ? datos : undefined);
      setDesenlace(r);
      if (r.aplicada) toast.success(r.mensaje);
      else toast(r.mensaje);
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e.message : "No hemos podido guardar la decisión.");
    } finally {
      setOcupado(null);
    }
  }

  if (desenlace) {
    return (
      <div
        className={`flex flex-col gap-2 rounded-xl border p-4 ${
          desenlace.aplicada ? "border-good bg-good-wash" : "border-line-strong bg-raised"
        }`}
      >
        <p className={`text-sm font-semibold ${desenlace.aplicada ? "text-good" : "text-ink"}`}>
          {desenlace.mensaje}
        </p>
        {desenlace.avisos.map((a, i) => (
          <p key={i} className="text-xs text-acento-text">
            · {a}
          </p>
        ))}
        {desenlace.enlaces.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {desenlace.enlaces.map((e) => (
              <Link
                key={e.ruta}
                to={e.ruta}
                className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Abrir «{e.texto}» →
              </Link>
            ))}
          </div>
        )}
        <button type="button" onClick={alDecidir} className="self-start text-xs text-muted underline">
          Actualizar la bandeja
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decidir("APROBAR")}
          disabled={ocupado !== null}
          className="h-9 rounded-lg border border-good/40 bg-good-wash px-4 text-sm font-semibold text-good transition-[transform,filter,opacity] duration-150 hover:brightness-125 disabled:opacity-50"
        >
          {ocupado === "APROBAR" ? "Guardando…" : textoAprobar}
        </button>
        <button
          type="button"
          onClick={() => decidir("DESCARTAR")}
          disabled={ocupado !== null}
          className="h-9 rounded-lg border border-line px-4 text-sm font-medium text-ink-soft transition-colors duration-150 hover:border-line-strong hover:text-ink disabled:opacity-50"
        >
          {ocupado === "DESCARTAR" ? "Guardando…" : "Descartar"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────── Noches propuestas ───────────────────────

const soloHora = (t: string) => (/^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, "0") : "21:00");

/** «2026-10-23» → «viernes 23 de octubre». */
function fechaLegible(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  if (!a || !m || !d) return dia;
  return new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d, 12)),
  );
}

/**
 * Las noches que propone el programador, como noches y no como JSON.
 *
 * Pendiente, se puede abrir el editor: cada campo se cambia en su sitio y una
 * noche entera se puede quitar. Al aprobar viaja lo editado.
 */
function PropuestaDeNochesVista({ propuesta, alDecidir }: { propuesta: PropuestaDeIa; alDecidir: () => void }) {
  const original = propuesta.datos as PropuestaDeNoches;
  const [datos, setDatos] = useState<PropuestaDeNoches>(() => structuredClone(original));
  const [editando, setEditando] = useState(false);
  const pendiente = propuesta.estado === "PENDIENTE";
  const retocada = JSON.stringify(datos) !== JSON.stringify(original);

  function cambiarNoche(i: number, cambio: Partial<NochePropuesta>) {
    setDatos((d) => ({ ...d, noches: d.noches.map((n, j) => (j === i ? { ...n, ...cambio } : n)) }));
  }

  function cambiarEntrada(i: number, k: number, cambio: Partial<NochePropuesta["entradas"][number]>) {
    setDatos((d) => ({
      ...d,
      noches: d.noches.map((n, j) =>
        j === i ? { ...n, entradas: n.entradas.map((t, l) => (l === k ? { ...t, ...cambio } : t)) } : n,
      ),
    }));
  }

  function quitarEntrada(i: number, k: number) {
    setDatos((d) => ({
      ...d,
      noches: d.noches.map((n, j) => (j === i ? { ...n, entradas: n.entradas.filter((_, l) => l !== k) } : n)),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-ink-soft">{datos.razonamiento}</p>

      {datos.noches.length === 0 && (
        <p className="text-sm text-bad">Has quitado todas las noches: no queda nada que aprobar.</p>
      )}

      {datos.noches.map((n, i) => (
        <div key={i} className="noche-propuesta">
          {editando ? (
            <div className="noche-propuesta__editor">
              <label className="campo campo--ancho">
                Título
                <input value={n.titulo} onChange={(e) => cambiarNoche(i, { titulo: e.target.value })} maxLength={160} />
              </label>
              <label className="campo">
                Fecha
                <input type="date" value={n.fecha} onChange={(e) => cambiarNoche(i, { fecha: e.target.value })} />
              </label>
              <label className="campo">
                Puertas
                <input type="time" value={soloHora(n.puertas)} onChange={(e) => cambiarNoche(i, { puertas: e.target.value })} />
              </label>
              <label className="campo">
                Cierre
                <input type="time" value={soloHora(n.cierre)} onChange={(e) => cambiarNoche(i, { cierre: e.target.value })} />
              </label>
              <label className="campo">
                Vestimenta
                <input value={n.vestimenta} onChange={(e) => cambiarNoche(i, { vestimenta: e.target.value })} maxLength={120} />
              </label>
              <label className="campo campo--ancho">
                Descripción
                <textarea value={n.descripcion} onChange={(e) => cambiarNoche(i, { descripcion: e.target.value })} rows={2} maxLength={2000} />
              </label>
              <label className="campo campo--ancho">
                Cartel (separado por comas; el primero es el cabeza)
                <input
                  value={n.artistas.join(", ")}
                  onChange={(e) =>
                    cambiarNoche(i, { artistas: e.target.value.split(",").map((a) => a.trim()).filter(Boolean) })
                  }
                />
              </label>
              <div className="campo campo--ancho">
                Entradas
                {n.entradas.map((t, k) => (
                  <div key={k} className="noche-propuesta__entrada">
                    <input value={t.nombre} onChange={(e) => cambiarEntrada(i, k, { nombre: e.target.value })} aria-label="Nombre de la entrada" maxLength={60} />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={t.precioCentimos / 100}
                      onChange={(e) => cambiarEntrada(i, k, { precioCentimos: Math.round(Number(e.target.value) * 100) })}
                      aria-label="Precio en soles"
                    />
                    <input
                      type="number"
                      min={1}
                      value={t.cantidad}
                      onChange={(e) => cambiarEntrada(i, k, { cantidad: Number(e.target.value) })}
                      aria-label="Cupo"
                    />
                    <button type="button" className="boton-fantasma" onClick={() => quitarEntrada(i, k)}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="boton-fantasma boton--peligro"
                onClick={() => setDatos((d) => ({ ...d, noches: d.noches.filter((_, j) => j !== i) }))}
              >
                Quitar esta noche de la propuesta
              </button>
            </div>
          ) : (
            <>
              <p className="eyebrow text-acento-text">
                {fechaLegible(n.fecha)} · {soloHora(n.puertas)} a {soloHora(n.cierre)}
              </p>
              <h4 className="noche-propuesta__titulo">{n.titulo}</h4>
              <p className="text-sm text-ink-soft">{n.descripcion}</p>
              <p className="text-sm">
                <span className="text-muted">Cartel: </span>
                {n.artistas.length ? n.artistas.join(" · ") : "sin confirmar"}
                {n.vestimenta && <span className="text-muted"> · {n.vestimenta}</span>}
              </p>
              <ul className="noche-propuesta__entradas">
                {n.entradas.map((t, k) => (
                  <li key={k}>
                    <strong>{t.nombre}</strong> {t.precioCentimos === 0 ? "gratis" : soles(t.precioCentimos)} ·{" "}
                    {t.cantidad} entradas
                    {t.descripcion && <span className="text-muted"> · {t.descripcion}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">Por qué: {n.motivo}</p>
            </>
          )}
        </div>
      ))}

      {pendiente && (
        <div className="flex flex-col gap-3">
          <button type="button" className="self-start text-sm text-acento-text underline" onClick={() => setEditando((v) => !v)}>
            {editando ? "Ver como quedará" : "Editar antes de aprobar"}
          </button>
          {retocada && <p className="text-xs text-acento-text">Has hecho cambios: se aprobará tu versión.</p>}
          {datos.noches.length > 0 ? (
            <Decision
              propuesta={propuesta}
              alDecidir={alDecidir}
              datos={retocada ? datos : undefined}
              textoAprobar={datos.noches.length === 1 ? "Aprobar y crear la noche" : `Aprobar y crear ${datos.noches.length} noches`}
            />
          ) : (
            <Decision propuesta={propuesta} alDecidir={alDecidir} textoAprobar="Aprobar" />
          )}
        </div>
      )}
    </div>
  );
}

function EtiquetaDeEstado({ p }: { p: PropuestaDeIa }) {
  return (
    <>
      {p.estado === "PENDIENTE" && <span className="estado">Pendiente</span>}
      {p.estado === "APROBADA" && <span className="estado estado--publicado">Aprobada</span>}
      {p.estado === "RECHAZADA" && <span className="estado estado--cancelado">Descartada</span>}
      {p.aplicada && <span className="estado estado--publicado">Ejecutada</span>}
    </>
  );
}

export function PropuestasIa() {
  const [version, setVersion] = useState(0);
  const agentes = useCarga(listarAgentes, []);
  const bandeja = useCarga(verBandejaDeIa, [version]);
  const recargar = () => setVersion((v) => v + 1);

  if (bandeja.fase === "cargando") return <p className="aviso">Cargando las propuestas…</p>;
  if (bandeja.fase === "error") {
    return <AvisoDeError que="las propuestas" mensaje={bandeja.mensaje} estadoHttp={bandeja.estadoHttp} />;
  }

  const b = bandeja.datos;

  return (
    <section>
      <header className="cabecera">
        <h2>Propuestas de la IA</h2>
        <span className="contador">Nada se publica ni se cambia sin que lo apruebes</span>
      </header>

      <div className="tarjetas">
        <div className={`tarjeta ${b.pendientes > 0 ? "tarjeta--alerta" : ""}`}>
          <p className="tarjeta__cifra">{b.pendientes}</p>
          <p className="tarjeta__pie">Pendientes</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{b.ejecuciones}</p>
          <p className="tarjeta__pie">Ejecuciones registradas</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(b.costeCentimos)}</p>
          <p className="tarjeta__pie">Coste acumulado</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{Math.round(b.tokens / 1000)}k</p>
          <p className="tarjeta__pie">Tokens (entrada + salida)</p>
        </div>
      </div>

      <div className="tw">
        <h3 className="eyebrow mt-6 mb-3 text-muted">Lanzar un agente</h3>
        {agentes.fase === "listo" && (
          <div className="mb-8 flex flex-wrap gap-3">
            {agentes.datos.map((a) => (
              <BotonDeAgente key={a.clave} agente={a} alTerminar={recargar} />
            ))}
          </div>
        )}
        {agentes.fase === "error" && <p className="mb-6 text-sm text-bad">{agentes.mensaje}</p>}

        {b.propuestas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-6 text-sm text-ink-soft">
            Todavía no hay propuestas. Lanza un agente con los botones de arriba.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {b.propuestas.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
                  <h3 className="font-sans text-base font-semibold tracking-normal">{p.tipoNombre}</h3>
                  <span className="text-xs text-muted">
                    {p.agente} · {horaDeSala(p.creadoEn)}
                  </span>
                </header>
                <div className="flex flex-col gap-5 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <EtiquetaDeEstado p={p} />
                    {p.revisadaPor && (
                      <span className="text-xs text-muted">Revisada por {p.revisadaPor}</span>
                    )}
                    <span className="tnum ml-auto text-xs text-muted">
                      {soles(p.costeCentimos)} · {p.tokens} tokens
                    </span>
                  </div>
                  {p.tipo === "EVENTO" ? (
                    <PropuestaDeNochesVista propuesta={p} alDecidir={recargar} />
                  ) : (
                    <>
                      <Contenido valor={p.datos} />
                      {p.estado === "PENDIENTE" && <Decision propuesta={p} alDecidir={recargar} />}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
