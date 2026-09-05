import { Link, useParams } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verArqueo } from "../api";
import { useCarga } from "../datos";
import { Resultado } from "./Caja";

/**
 * La ficha de un arqueo.
 *
 * Existe para responder una sola pregunta cuando una caja no cuadra: **¿dónde
 * está el dinero?** Por eso lo primero que se enseña es el desglose por método
 * de pago: si faltan cien soles pero casi todo se cobró con tarjeta, el problema
 * no está en el cajón.
 */
export function ArqueoDetalle() {
  const { id = "" } = useParams();
  const carga = useCarga(() => verArqueo(id), [id]);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el arqueo…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="el arqueo" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const { arqueo: a, porMetodoDePago, efectivoCentimos, otrosMediosCentimos, cobros, ultimosCobros } =
    carga.datos;

  return (
    <section>
      <p className="migas">
        <Link to="/panel/caja" className="enlace">
          ← Caja
        </Link>
      </p>

      <header className="cabecera">
        <h2>Caja de {a.responsable}</h2>
        <Resultado
          estaAbierta={a.estaAbierta}
          cuadro={a.cuadro}
          diferenciaCentimos={a.diferenciaCentimos}
        />
      </header>

      <dl className="fichas">
        <div>
          <dt>Sala</dt>
          <dd>{a.sala}</dd>
        </div>
        <div>
          <dt>Abierta</dt>
          <dd>{horaDeSala(a.abiertaEn)}</dd>
        </div>
        <div>
          <dt>Cerrada</dt>
          <dd>
            {a.cerradaEn ? horaDeSala(a.cerradaEn) : <span className="sutil">Sigue abierta</span>}
          </dd>
        </div>
        <div>
          <dt>Fondo de apertura</dt>
          <dd>{soles(a.aperturaCentimos)}</dd>
        </div>
        <div>
          {/* Se separan a propósito: confundir «lo que facturó el turno» con
              «lo que hay en el cajón» es lo que hace parecer que una noche
              vendió seis veces menos de lo que vendió. */}
          <dt>Facturado</dt>
          <dd className="precio">{soles(efectivoCentimos + otrosMediosCentimos)}</dd>
        </div>
        <div>
          <dt>De eso, en efectivo</dt>
          <dd>{soles(efectivoCentimos)}</dd>
        </div>
        <div>
          <dt>Cobros</dt>
          <dd>{cobros}</dd>
        </div>
      </dl>

      <header className="cabecera">
        <h2>El cuadre</h2>
      </header>

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(a.esperadoCentimos)}</p>
          <p className="tarjeta__pie">Debería haber</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">
            {a.contadoCentimos === null ? "—" : soles(a.contadoCentimos)}
          </p>
          <p className="tarjeta__pie">Se contó</p>
        </div>
        <div
          className={
            !a.estaAbierta && !a.cuadro ? "tarjeta tarjeta--alerta" : "tarjeta"
          }
        >
          <p className="tarjeta__cifra tarjeta__cifra--dinero">
            {a.diferenciaCentimos === null ? "—" : soles(a.diferenciaCentimos)}
          </p>
          <p className="tarjeta__pie">Diferencia</p>
        </div>
      </div>

      <header className="cabecera">
        <h2>Cómo se cobró</h2>
        <span className="contador">
          {/* La separación que importa: solo el efectivo llega al cajón. */}
          {soles(efectivoCentimos)} en efectivo · {soles(otrosMediosCentimos)} en otros medios
        </span>
      </header>

      {porMetodoDePago.length === 0 ? (
        <p className="aviso">No se registró ningún cobro en esta caja.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Método</th>
                <th>¿Llega al cajón?</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {porMetodoDePago.map((t) => (
                <tr key={t.metodo}>
                  <td>{t.etiqueta}</td>
                  <td>
                    {t.esEfectivo ? (
                      <span className="etiqueta">Sí</span>
                    ) : (
                      <span className="sutil">No</span>
                    )}
                  </td>
                  <td className="num precio">{soles(t.totalCentimos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ultimosCobros.length > 0 && (
        <>
          <header className="cabecera">
            <h2>Últimos cobros</h2>
            <span className="contador">
              {ultimosCobros.length} de {cobros}
            </span>
          </header>

          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Método</th>
                  <th className="num">Unidades</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {ultimosCobros.map((c) => (
                  <tr key={c.id}>
                    <td className="sutil">{horaDeSala(c.cuando)}</td>
                    <td>
                      <span className="etiqueta">{c.metodoEtiqueta}</span>
                    </td>
                    <td className="num">{c.unidades}</td>
                    <td className="num precio">{soles(c.totalCentimos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
