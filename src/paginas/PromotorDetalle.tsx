import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_ESTADO_DE_NOCHE_DE_PROMOTOR,
  NOMBRE_DE_PAGO,
  anularLiquidacion,
  deHoraDeSala,
  horaDeSala,
  liquidarPromotor,
  soles,
  verPromotor,
  type FichaDePromotor,
  type Liquidacion,
  type MetodoDePago,
  type NocheDelPromotor,
} from "../api";
import { useCarga } from "../datos";
import { TablaDeListas } from "./Promotores";
import "./expediente.css";

/**
 * La ficha de un promotor: qué ha vendido noche a noche, cuánto se le debe,
 * qué se le ha pagado y desde aquí, registrar el pago.
 *
 * Las piezas de lectura se exportan porque la pantalla del propio promotor
 * (`/promotor`) enseña lo mismo: así lo que ve él y lo que ve la sala no pueden
 * no cuadrar.
 */

const CLASE_DE_ESTADO: Record<NocheDelPromotor["estado"], string> = {
  POR_CELEBRAR: "estado",
  PENDIENTE: "estado estado--agotado",
  LIQUIDADA: "estado estado--publicado",
};

/** La dirección completa de su enlace de venta. */
export function enlaceDeVenta(codigo: string): string {
  return `${window.location.origin}/?promo=${encodeURIComponent(codigo)}`;
}

export function EnlaceDeVenta({ codigo }: { codigo: string }) {
  const enlace = enlaceDeVenta(codigo);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar: selecciónalo a mano.");
    }
  }
  return (
    <div className="enlace-promo">
      <span>Enlace de venta:</span>
      <code>{enlace}</code>
      <button type="button" className="boton-secundario" onClick={() => void copiar()}>
        Copiar
      </button>
      <span className="sutil">Lo que se compre desde este enlace (en los 7 días siguientes) cuenta para su comisión.</span>
    </div>
  );
}

export function CifrasDePromotor({ f }: { f: FichaDePromotor }) {
  const p = f.promotor;
  return (
    <div className="tarjetas">
      <div className={`tarjeta ${p.pendienteCentimos > 0 ? "tarjeta--alerta" : ""}`}>
        <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(p.pendienteCentimos)}</p>
        <p className="tarjeta__pie">Pendiente de pago (noches ya pasadas)</p>
      </div>
      <div className="tarjeta">
        <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(p.porCelebrarCentimos)}</p>
        <p className="tarjeta__pie">Por celebrar (vendido para noches que vienen)</p>
      </div>
      <div className="tarjeta">
        <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(p.pagadoCentimos)}</p>
        <p className="tarjeta__pie">
          Pagado en total{p.ultimoPago && ` · último ${horaDeSala(p.ultimoPago, { dateStyle: "medium" })}`}
        </p>
      </div>
      <div className="tarjeta">
        <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(p.vendidoCentimos)}</p>
        <p className="tarjeta__pie">
          Vendido con su código · {p.pedidos} pedidos · invitados {p.entraron}/{p.invitados}
        </p>
      </div>
    </div>
  );
}

export function TablaDeNochesDePromotor({ noches, enlazar }: { noches: NocheDelPromotor[]; enlazar: boolean }) {
  if (noches.length === 0) return <p className="sutil">Todavía no ha vendido ni traído lista para ninguna noche.</p>;
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            <th>Noche</th>
            <th className="num">Entradas</th>
            <th className="num">Vendido</th>
            <th className="num">Lista</th>
            <th className="num">Gana</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {noches.map((n) => (
            <tr key={n.slug}>
              <td>
                {enlazar ? (
                  <Link to={`/panel/eventos/${n.slug}/noche`} className="enlace">
                    {n.titulo}
                  </Link>
                ) : (
                  n.titulo
                )}
                <br />
                <span className="sutil">{horaDeSala(n.empiezaA, { dateStyle: "medium" })}</span>
              </td>
              <td className="num">{n.entradas}</td>
              <td className="num precio">{soles(n.ventasCentimos)}</td>
              <td className="num">
                {n.estado === "POR_CELEBRAR" ? "—" : n.entraron}
                <span className="sutil"> / {n.apuntados}</span>
              </td>
              <td className="num precio">
                <strong>{soles(n.totalCentimos)}</strong>
                {n.bonoCentimos > 0 && (
                  <>
                    <br />
                    <span className="sutil">
                      {soles(n.comisionCentimos)} + {soles(n.bonoCentimos)} por cabeza
                    </span>
                  </>
                )}
              </td>
              <td>
                <span className={CLASE_DE_ESTADO[n.estado]}>{NOMBRE_DE_ESTADO_DE_NOCHE_DE_PROMOTOR[n.estado]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaDeLiquidaciones({
  liquidaciones,
  alAnular,
}: {
  liquidaciones: Liquidacion[];
  alAnular?: (l: Liquidacion) => void;
}) {
  if (liquidaciones.length === 0) return <p className="sutil">Todavía no hay ningún pago registrado.</p>;
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            <th>Pagado</th>
            <th>Cubre</th>
            <th className="num">Comisión</th>
            <th className="num">Por cabeza</th>
            <th className="num">Ajuste</th>
            <th className="num">Total</th>
            <th>Cómo</th>
            {alAnular && <th></th>}
          </tr>
        </thead>
        <tbody>
          {liquidaciones.map((l) => (
            <tr key={l.id}>
              <td>
                {horaDeSala(l.pagadaEn, { dateStyle: "medium" })}
                {l.registradaPor && <span className="sutil"><br />por {l.registradaPor}</span>}
              </td>
              <td className="sutil">
                Noches hasta {horaDeSala(l.hasta, { dateStyle: "medium" })}
                <br />
                {l.pedidos} pedidos · {l.entradas} entradas
              </td>
              <td className="num">
                {soles(l.comisionCentimos)}
                <br />
                <span className="sutil">
                  {l.comisionPorcentaje} % de {soles(l.ventasCentimos)}
                </span>
              </td>
              <td className="num">
                {soles(l.bonoCentimos)}
                {l.invitadosEntraron > 0 && (
                  <>
                    <br />
                    <span className="sutil">
                      {l.invitadosEntraron} × {soles(l.bonoPorInvitadoCentimos)}
                    </span>
                  </>
                )}
              </td>
              <td className="num">{l.ajusteCentimos === 0 ? "—" : soles(l.ajusteCentimos)}</td>
              <td className="num precio">
                <strong>{soles(l.totalCentimos)}</strong>
              </td>
              <td>
                {NOMBRE_DE_PAGO[l.metodoDePago]}
                {l.referencia && <span className="sutil"> · {l.referencia}</span>}
                {l.nota && (
                  <>
                    <br />
                    <span className="sutil">{l.nota}</span>
                  </>
                )}
              </td>
              {alAnular && (
                <td className="acciones">
                  <button type="button" className="boton-fantasma boton--peligro" onClick={() => alAnular(l)}>
                    Anular
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Registrar un pago: enseña antes qué se va a pagar y por qué. */
function RegistrarPago({ f, alPagar, alCancelar }: { f: FichaDePromotor; alPagar: () => void; alCancelar: () => void }) {
  const pend = f.pendiente;
  const [metodo, setMetodo] = useState<MetodoDePago>("YAPE");
  const [referencia, setReferencia] = useState("");
  const [nota, setNota] = useState("");
  const [ajuste, setAjuste] = useState("0");
  const [hasta, setHasta] = useState("");
  const [guardando, setGuardando] = useState(false);

  const ajusteCentimos = Math.round(Number(ajuste || 0) * 100);
  const total = pend.totalCentimos + ajusteCentimos;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const l = await liquidarPromotor(f.promotor.id, {
        hasta: hasta ? deHoraDeSala(`${hasta}T23:59`) : null,
        metodoDePago: metodo,
        referencia: referencia.trim(),
        nota: nota.trim(),
        ajusteCentimos,
      });
      toast.success(`Pago de ${soles(l.totalCentimos)} registrado`);
      alPagar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo registrar el pago.");
      setGuardando(false);
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      <p>
        Entra en este pago todo lo pendiente de noches que ya empezaron
        {hasta ? ` hasta el ${hasta}` : ""}:{" "}
        <strong>
          {pend.pedidos} pedidos ({pend.entradas} entradas, {soles(pend.ventasCentimos)}) × {pend.comisionPct} % ={" "}
          {soles(pend.comisionCentimos)}
        </strong>
        {pend.bonoPorInvitadoCentimos > 0 && (
          <>
            {" "}
            + <strong>{pend.invitadosEntraron} invitados × {soles(pend.bonoPorInvitadoCentimos)} = {soles(pend.bonoCentimos)}</strong>
          </>
        )}
        . Cada pedido y cada lista quedan marcados: no se pueden volver a pagar.
      </p>
      {hasta && <p className="sutil">La cifra de arriba es de hasta hoy; el backend recalcula con la fecha elegida al guardar.</p>}
      <div className="tipo-form__campos">
        <label>
          Cómo se le pagó
          <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoDePago)}>
            {(Object.keys(NOMBRE_DE_PAGO) as MetodoDePago[]).map((m) => (
              <option key={m} value={m}>
                {NOMBRE_DE_PAGO[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          N.º de operación (opcional)
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={80} />
        </label>
        <label>
          Solo noches hasta (opcional)
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label>
          Ajuste a mano (S/, + o −)
          <input type="number" step="0.10" value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
        </label>
        <label className="tipo-form__ancho">
          Nota {ajusteCentimos !== 0 && "(obligatoria con ajuste)"}
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={500}
            required={ajusteCentimos !== 0}
            placeholder="Adelanto del día 5, descuento por…"
          />
        </label>
      </div>
      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando || (total <= 0 && !hasta)}>
          {guardando ? "Registrando…" : `Registrar pago de ${soles(Math.max(0, total))}`}
        </button>
      </div>
    </form>
  );
}

export function PromotorDetalle() {
  const id = Number(useParams().id);
  const [version, setVersion] = useState(0);
  const carga = useCarga(() => verPromotor(id), [id, version]);
  const [pagando, setPagando] = useState(false);

  if (carga.fase === "cargando") return <p className="aviso">Cargando al promotor…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="el promotor" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const f = carga.datos;
  const p = f.promotor;
  const recargar = () => setVersion((v) => v + 1);

  async function anular(l: Liquidacion) {
    if (
      !window.confirm(
        `¿Anular el pago de ${soles(l.totalCentimos)} del ${horaDeSala(l.pagadaEn, { dateStyle: "medium" })}? ` +
          "Lo que cubría vuelve a quedar pendiente. Úsalo solo si se registró por error.",
      )
    )
      return;
    try {
      await anularLiquidacion(l.id);
      toast.success("Pago anulado");
      recargar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo anular.");
    }
  }

  return (
    <section>
      <p className="migas">
        <Link to="/panel/promotores" className="enlace">
          ← Promotores
        </Link>
      </p>
      <header className="cabecera">
        <div>
          <h2>{p.nombre}</h2>
          <p className="sutil">
            Código {p.codigo} · {p.comisionPorcentaje} % de comisión
            {p.bonoPorInvitadoCentimos > 0 && ` + ${soles(p.bonoPorInvitadoCentimos)} por invitado que entra`}
            {!p.activo && " · desactivado"}
          </p>
        </div>
        <div className="cabecera__acciones">
          {!pagando && (
            <button type="button" className="boton" onClick={() => setPagando(true)} disabled={f.pendiente.totalCentimos <= 0}>
              {f.pendiente.totalCentimos > 0 ? `Pagar ${soles(f.pendiente.totalCentimos)}` : "Nada pendiente"}
            </button>
          )}
          <Link to="/panel/personal" className="boton-fantasma">
            Cambiar comisión
          </Link>
        </div>
      </header>

      {pagando && (
        <RegistrarPago
          f={f}
          alCancelar={() => setPagando(false)}
          alPagar={() => {
            setPagando(false);
            recargar();
          }}
        />
      )}

      <EnlaceDeVenta codigo={p.codigo} />
      <CifrasDePromotor f={f} />

      <div className="apartado">
        <h3 className="subtitulo">Noche a noche</h3>
        <TablaDeNochesDePromotor noches={f.noches} enlazar />
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Pagos registrados</h3>
        <TablaDeLiquidaciones liquidaciones={f.liquidaciones} alAnular={(l) => void anular(l)} />
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Sus listas de invitados</h3>
        {p.listas.length === 0 ? <p className="sutil">No ha abierto ninguna lista.</p> : <TablaDeListas listas={p.listas} />}
      </div>
    </section>
  );
}
