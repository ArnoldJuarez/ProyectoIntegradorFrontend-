import { useState } from "react";
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
  type PropuestaDeIa,
} from "../api";
import { useCarga } from "../datos";

/**
 * La bandeja de la IA: lanzar agentes y decidir sobre lo que proponen.
 *
 * Ningún agente publica, envía ni cambia nada por su cuenta. Lo que hace es
 * dejar aquí una propuesta, y solo al aprobarla se crea la campaña, el pedido o
 * el cambio de precio, siempre en borrador cuando sale hacia fuera.
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

function Decision({ propuesta, alDecidir }: { propuesta: PropuestaDeIa; alDecidir: () => void }) {
  const [ocupado, setOcupado] = useState<"APROBAR" | "DESCARTAR" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desenlace, setDesenlace] = useState<Desenlace | null>(null);

  async function decidir(decision: "APROBAR" | "DESCARTAR") {
    setOcupado(decision);
    setError(null);
    try {
      // El resultado se enseña antes de recargar: dice qué se ha creado de
      // verdad y qué queda por hacer a mano.
      const r = await decidirPropuesta(propuesta.id, decision);
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
          {ocupado === "APROBAR" ? "Guardando…" : "Aprobar"}
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
                  <Contenido valor={p.datos} />
                  {p.estado === "PENDIENTE" && <Decision propuesta={p} alDecidir={recargar} />}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
