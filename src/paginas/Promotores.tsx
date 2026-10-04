import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verPromotores, type ListaDeInvitados, type Rol } from "../api";
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
              <td>{l.nombre}</td>
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

export function Promotores() {
  const carga = useCarga(verPromotores, []);

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
        <span className="contador">Quién trae gente y cuánto se le debe</span>
      </header>

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{r.activos}</p>
          <p className="tarjeta__pie">Promotores activos</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(r.vendidoCentimos)}</p>
          <p className="tarjeta__pie">Vendido con su código</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(r.comisionesCentimos)}</p>
          <p className="tarjeta__pie">Comisiones a pagar</p>
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
          <h3 className="subtitulo">Resumen, por comisión</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Promotor</th>
                  <th>Código</th>
                  <th className="num">%</th>
                  <th className="num">Pedidos</th>
                  <th className="num">Vendido</th>
                  <th className="num">Comisión</th>
                  <th className="num">Invitados</th>
                </tr>
              </thead>
              <tbody>
                {r.promotores.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nombre}</strong>
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
                    <td className="num sutil">{p.comisionPorcentaje}%</td>
                    <td className="num">{p.pedidos}</td>
                    <td className="num precio">{soles(p.vendidoCentimos)}</td>
                    <td className="num precio">
                      <strong>{soles(p.comisionCentimos)}</strong>
                    </td>
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
                  · {p.listas.length} {p.listas.length === 1 ? "lista" : "listas"} · comisión{" "}
                  {soles(p.comisionCentimos)}
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
