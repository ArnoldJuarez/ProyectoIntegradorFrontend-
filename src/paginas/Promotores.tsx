import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  abrirLista,
  horaDeSala,
  soles,
  verOpcionesDeLista,
  verPromotores,
  type ListaDeInvitados,
  type Rol,
} from "../api";
import { useCarga } from "../datos";

/**
 * Promotores: quién trae gente, cuánta entra de verdad y cuánto hay que pagarle.
 *
 * Promotor no es un tipo de cuenta, es cualquiera del personal con código. Por
 * eso debajo del nombre va su rol: al promotor externo y al de barra que además
 * jala gente no se les paga igual ni se les pide lo mismo.
 */

const ROL: Record<Rol, string> = {
  DIRECCION: "Dirección",
  GERENCIA: "Gerencia",
  PROMOTOR: "Promotor externo",
  PUERTA: "Puerta",
  BARRA: "Barra",
  PERSONAL: "Personal",
};

function porcentaje(parte: number, total: number): number | null {
  return total > 0 ? Math.round((parte / total) * 100) : null;
}

/**
 * Cuánto de la lista entró de verdad.
 *
 * Antes de la noche no se pinta nada: un 0 % ahí parecería un fracaso de alguien
 * cuando lo único que pasa es que todavía no ha abierto la puerta.
 */
function Cumplimiento({ lista }: { lista: ListaDeInvitados }) {
  if (!lista.pasada) return <span className="sutil">la noche no ha pasado</span>;
  const pct = porcentaje(lista.entraron, lista.apuntados);
  if (pct === null) return <span className="sutil">lista vacía</span>;
  const clase = pct >= 60 ? "estado--publicado" : pct >= 30 ? "" : "estado--agotado";
  return <span className={`estado ${clase}`}>{pct}%</span>;
}

export function TablaDeListas({
  listas,
  conPromotor = false,
}: {
  listas: ListaDeInvitados[];
  conPromotor?: boolean;
}) {
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            {conPromotor ? <th>Promotor</th> : <th>Noche</th>}
            {!conPromotor && <th>Fecha</th>}
            <th>Lista</th>
            <th className="num">Apuntados</th>
            <th className="num">Entraron</th>
            <th>Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {listas.map((l) => (
            <tr key={l.id}>
              {conPromotor ? (
                <td>{l.promotor}</td>
              ) : (
                <td>
                  <Link to={`/panel/eventos/${l.nocheSlug}`} className="enlace">
                    {l.noche}
                  </Link>
                </td>
              )}
              {!conPromotor && (
                <td className="sutil">{horaDeSala(l.empiezaA, { dateStyle: "medium" })}</td>
              )}
              <td>
                <Link to={`/panel/promotores/listas/${l.id}`} className="enlace">
                  {l.nombre}
                </Link>
              </td>
              <td className="num">
                {l.apuntados}
                <span className="sutil"> / {l.maxInvitados}</span>
              </td>
              <td className="num">{l.pasada ? l.entraron : "—"}</td>
              <td>
                <Cumplimiento lista={l} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Abrir una lista para una noche. Llega con la noche ya elegida cuando se viene
 * desde su ficha (`?noche=slug`).
 */
function AbrirLista({ alCancelar }: { alCancelar: () => void }) {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const opciones = useCarga(verOpcionesDeLista, []);
  const [slug, setSlug] = useState(parametros.get("noche") ?? "");
  const [promotorId, setPromotorId] = useState("");
  const [nombre, setNombre] = useState("");
  const [maximo, setMaximo] = useState("30");
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  if (opciones.fase === "cargando") return <p className="aviso">Cargando noches y promotores…</p>;
  if (opciones.fase === "error") return <p className="aviso aviso--error">{opciones.mensaje}</p>;
  const { noches, promotores } = opciones.datos;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setFallo(null);
    try {
      const lista = await abrirLista({
        slug: slug || noches[0]?.slug,
        promotorId: promotorId || promotores[0]?.id,
        nombre: nombre.trim(),
        maxInvitados: Number(maximo),
      });
      toast.success(`Lista «${lista.nombre}» abierta`);
      navegar(`/panel/promotores/listas/${lista.id}`);
    } catch (err) {
      setFallo(err instanceof ErrorDeApi ? err.message : "No se pudo abrir la lista.");
      setGuardando(false);
    }
  }

  if (noches.length === 0 || promotores.length === 0) {
    return (
      <p className="aviso">
        {noches.length === 0
          ? "No hay noches próximas donde abrir una lista."
          : "No hay nadie con código de promotor. Dale uno desde Personal."}
      </p>
    );
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}
      <div className="tipo-form__campos">
        <label>
          Noche
          <select value={slug || noches[0].slug} onChange={(e) => setSlug(e.target.value)}>
            {noches.map((n) => (
              <option key={n.slug} value={n.slug}>
                {horaDeSala(n.empiezaA, { dateStyle: "medium" })} · {n.titulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Promotor
          <select value={promotorId || promotores[0].id} onChange={(e) => setPromotorId(e.target.value)}>
            {promotores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.codigo})
              </option>
            ))}
          </select>
        </label>
        <label>
          Nombre de la lista
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            placeholder="Cumpleaños de Ana, grupo de la uni…"
          />
        </label>
        <label>
          Tope de personas
          <input type="number" min={1} max={500} value={maximo} onChange={(e) => setMaximo(e.target.value)} required />
        </label>
      </div>
      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? "Abriendo…" : "Abrir lista"}
        </button>
      </div>
    </form>
  );
}

export function Promotores() {
  const carga = useCarga(verPromotores, []);
  const [parametros] = useSearchParams();
  // Si se llega desde la ficha de una noche, el formulario viene abierto.
  const [abriendo, setAbriendo] = useState(parametros.has("noche"));

  if (carga.fase === "cargando") return <p className="aviso">Cargando los promotores…</p>;
  if (carga.fase === "error") {
    return (
      <AvisoDeError que="los promotores" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
    );
  }

  const r = carga.datos;
  const entranPct = porcentaje(r.entraron, r.invitados);

  return (
    <section>
      <header className="cabecera">
        <h2>Promotores</h2>
        <div className="cabecera__acciones">
          <span className="contador">Quién trae gente y cuánto se le debe</span>
          {!abriendo && (
            <button type="button" className="boton" onClick={() => setAbriendo(true)}>
              Abrir una lista
            </button>
          )}
        </div>
      </header>

      {abriendo && <AbrirLista alCancelar={() => setAbriendo(false)} />}

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{r.activos}</p>
          <p className="tarjeta__pie">Promotores activos</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(r.vendidoCentimos)}</p>
          <p className="tarjeta__pie">Vendido con su código</p>
        </div>
        <div className={`tarjeta ${r.pendienteCentimos > 0 ? "tarjeta--alerta" : ""}`}>
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(r.pendienteCentimos)}</p>
          <p className="tarjeta__pie">Pendiente de pagar · ya pagado {soles(r.pagadoCentimos)}</p>
        </div>
        <div className={`tarjeta ${entranPct !== null && entranPct < 50 ? "tarjeta--alerta" : ""}`}>
          <p className="tarjeta__cifra">{entranPct === null ? "—" : `${entranPct}%`}</p>
          <p className="tarjeta__pie">
            Invitados que entran · {r.entraron} de {r.invitados}
          </p>
        </div>
      </div>

      {r.promotores.length === 0 ? (
        <p className="aviso">
          No hay promotores dados de alta. Un promotor es cualquiera del personal con código propio:
          los pedidos que lo llevan cuentan para su comisión.
        </p>
      ) : (
        <>
          <h3 className="subtitulo">Resumen · abre a cada uno para ver su desglose y registrar pagos</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Promotor</th>
                  <th>Código</th>
                  <th className="num">%</th>
                  <th className="num">Pedidos</th>
                  <th className="num">Vendido</th>
                  <th className="num">Pendiente</th>
                  <th className="num">Pagado</th>
                  <th className="num">Invitados</th>
                </tr>
              </thead>
              <tbody>
                {r.promotores.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/panel/promotores/${p.id}`} className="enlace">
                        <strong>{p.nombre}</strong>
                      </Link>
                      <br />
                      <span className="sutil">
                        {ROL[p.rol] ?? p.rol}
                        {p.email ? ` · ${p.email}` : ""}
                      </span>
                    </td>
                    <td>
                      <span className={`estado ${p.activo ? "estado--publicado" : ""}`}>
                        {p.codigo}
                      </span>
                    </td>
                    <td className="num sutil">
                      {p.comisionPorcentaje}%
                      {p.bonoPorInvitadoCentimos > 0 && (
                        <>
                          <br />+{soles(p.bonoPorInvitadoCentimos)}/inv.
                        </>
                      )}
                    </td>
                    <td className="num">{p.pedidos}</td>
                    <td className="num precio">{soles(p.vendidoCentimos)}</td>
                    <td className="num precio">
                      <strong>{soles(p.pendienteCentimos)}</strong>
                      {p.porCelebrarCentimos > 0 && (
                        <>
                          <br />
                          <span className="sutil">+{soles(p.porCelebrarCentimos)} por celebrar</span>
                        </>
                      )}
                    </td>
                    <td className="num precio sutil">{soles(p.pagadoCentimos)}</td>
                    <td className="num">
                      {p.entraron}/{p.invitados}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {r.promotores.map((p) => (
            <div key={p.id} className="apartado">
              <h3 className="subtitulo">
                {p.nombre}
                <span className="sutil">
                  {" "}
                  · {p.listas.length} {p.listas.length === 1 ? "lista" : "listas"} · pendiente{" "}
                  {soles(p.pendienteCentimos)}
                </span>
              </h3>
              {p.listas.length === 0 ? (
                <p className="sutil">{p.nombre} todavía no ha abierto ninguna lista para una noche.</p>
              ) : (
                <TablaDeListas listas={p.listas} />
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
