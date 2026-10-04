import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verHistorialDeNoches, verResumenDelPanel } from "../api";
import type { Cifra, NocheEnPortada } from "../api";
import { useCarga } from "../datos";
import { GraficasDeNoches } from "./GraficasDeNoches";
import { Bloque, BloqueVacio, Medidor } from "./Medidor";
import "./panel.css";

/**
 * La portada del panel: lo que hay que mirar antes de abrir esta noche.
 *
 * No añade nada que no esté en otra pantalla —los ingresos están en pedidos, el
 * stock bajo en almacén, el aforo en la puerta—. Lo que añade es **no tener que
 * abrir tres pantallas y sumar de cabeza** para responder «¿cómo vamos?».
 *
 * Es la misma portada que el sistema anterior, con una diferencia: donde ese
 * tenía la ficha de «Propuestas IA», este enseña «Cajas sin cerrar». El dominio
 * de la IA todavía no está migrado, y una ficha que siempre marca cero ocupa
 * sitio sin decir nada; una caja que nadie ha contado sí es algo que resolver
 * antes de abrir.
 */
export function Resumen() {
  const carga = useCarga(verResumenDelPanel, []);
  // Aparte del resumen: si las gráficas tardan o fallan, el resto se ve igual.
  const historial = useCarga(() => verHistorialDeNoches(14), []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el resumen…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="el resumen" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const r = carga.datos;

  return (
    <section>
      <header className="cabecera">
        <h2>Resumen</h2>
        <span className="contador">lo que hay que mirar antes de abrir</span>
      </header>

      <div className="tarjetas">
        {r.cifras.map((c) => (
          <FichaDeCifra key={c.etiqueta} cifra={c} />
        ))}
      </div>

      {historial.fase === "listo" && <GraficasDeNoches noches={historial.datos} />}

      <div className="portada__rejilla">
        <Bloque titulo="Próxima noche">
          {r.proxima ? (
            <ProximaNoche noche={r.proxima} />
          ) : (
            <BloqueVacio>No hay ninguna fecha publicada por delante.</BloqueVacio>
          )}
        </Bloque>

        <div className="portada__columna">
          <Bloque titulo="Última noche">
            {r.ultima ? (
              <div className="portada__cuerpo">
                <p className="portada__noche-titulo">{r.ultima.titulo}</p>
                <p className="sutil">{horaDeSala(r.ultima.puertasA)}</p>
                <p className="portada__asistencia">
                  <span className="portada__asistencia-cifra">{r.asistenciaDeLaUltima}</span>
                  <span className="sutil">personas escaneadas en puerta</span>
                </p>
              </div>
            ) : (
              <BloqueVacio>Todavía no hay ninguna noche cerrada.</BloqueVacio>
            )}
          </Bloque>

          <Bloque titulo="Último arqueo">
            {r.ultimoArqueo ? (
              <div className="portada__cuerpo">
                <div className="portada__par">
                  <span className="sutil">Responsable</span>
                  <span>{r.ultimoArqueo.responsable}</span>
                </div>
                <div className="portada__par">
                  <span className="sutil">Sala</span>
                  <span>{r.ultimoArqueo.sala}</span>
                </div>
                <div className="portada__par portada__par--separado">
                  <span className="sutil">Descuadre</span>
                  {/*
                    Una caja abierta no es una caja que cuadra: todavía no la ha
                    contado nadie. Enseñar un cero ahí daría por bueno un
                    recuento que no existe.
                  */}
                  {r.ultimoArqueo.estaAbierta ? (
                    <span className="etiqueta">Sin contar</span>
                  ) : (
                    <span
                      className={
                        (r.ultimoArqueo.diferenciaCentimos ?? 0) === 0
                          ? "estado estado--publicado"
                          : "estado estado--agotado"
                      }
                    >
                      {soles(r.ultimoArqueo.diferenciaCentimos ?? 0)}
                    </span>
                  )}
                </div>
                <Link to={`/panel/caja/${r.ultimoArqueo.id}`} className="enlace">
                  Ver el arqueo →
                </Link>
              </div>
            ) : (
              <BloqueVacio>Sin arqueos.</BloqueVacio>
            )}
          </Bloque>
        </div>
      </div>

      {r.hayQueReponer.length > 0 && (
        <Bloque
          titulo="Hay que reponer"
          pista={
            r.totalPorReponer > r.hayQueReponer.length
              ? `${r.hayQueReponer.length} de ${r.totalPorReponer}`
              : "por debajo del mínimo"
          }
          ancho
        >
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Quedan</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Faltan</th>
                </tr>
              </thead>
              <tbody>
                {r.hayQueReponer.map((p) => (
                  <tr key={p.productoId} className="fila--alerta">
                    <td>{p.producto}</td>
                    <td className="num">{p.quedan}</td>
                    <td className="num sutil">{p.umbral}</td>
                    <td className="num">{p.faltan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            Solo salen las primeras. Decir cuántas hay en total evita que alguien
            reponga seis referencias creyendo que ya están todas.
          */}
          {r.totalPorReponer > r.hayQueReponer.length && (
            <p className="bloque__nota">
              Hay {r.totalPorReponer} en total.{" "}
              <Link to="/panel/inventario" className="enlace">
                Verlas en almacén →
              </Link>
            </p>
          )}
        </Bloque>
      )}

      <Bloque titulo="Últimas compras" ancho>
        {r.ultimosPedidos.length === 0 ? (
          <BloqueVacio>Aún no hay pedidos.</BloqueVacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Noche</th>
                  <th>Cuándo</th>
                  <th className="num">Importe</th>
                </tr>
              </thead>
              <tbody>
                {r.ultimosPedidos.map((p) => (
                  <tr key={p.codigo}>
                    <td>
                      <Link to={`/panel/pedidos/${p.codigo}`} className="enlace sku">
                        {p.codigo}
                      </Link>
                    </td>
                    <td>{p.cliente}</td>
                    <td className="sutil">{p.noche}</td>
                    <td className="sutil">{horaDeSala(p.creadoEn)}</td>
                    <td className="num precio">{soles(p.totalCentimos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloque>
    </section>
  );
}

/**
 * Una de las cuatro cifras grandes.
 *
 * El tono llega del backend y aquí solo se traduce a clase: si siete
 * referencias bajo mínimo es malo o normal lo decide el negocio, y repetir esa
 * regla en el navegador significa que un día las dos copias dejan de coincidir.
 *
 * La cifra de dinero se reconoce por el tono `acento` y se formatea como soles.
 * Viaja en céntimos, igual que todo el dinero del sistema.
 */
function FichaDeCifra({ cifra }: { cifra: Cifra }) {
  const esDinero = cifra.tono === "acento";
  const valor = esDinero ? soles(Number(cifra.valor)) : cifra.valor;

  return (
    <div className={cifra.tono === "mal" ? "tarjeta tarjeta--alerta" : "tarjeta"}>
      <p className={esDinero ? "tarjeta__cifra tarjeta__cifra--dinero" : "tarjeta__cifra"}>
        {valor}
      </p>
      <p className="tarjeta__pie">{cifra.etiqueta}</p>
      <p className="portada__pista">{cifra.pie}</p>
    </div>
  );
}

/** La noche que viene, con su aforo y lo que lleva recaudado. */
function ProximaNoche({ noche }: { noche: NocheEnPortada }) {
  return (
    <div className="portada__cuerpo">
      <Link to={`/panel/eventos/${noche.slug}`} className="portada__noche-titulo portada__enlace">
        {noche.titulo}
      </Link>
      <p className="sutil">Puertas: {horaDeSala(noche.puertasA)}</p>

      <div className="portada__medida">
        <div className="portada__par">
          <span className="sutil">Aforo vendido</span>
          <span>
            {noche.vendidas} / {noche.aforoALaVenta}{" "}
            <span className="porcentaje">({noche.porcentajeVendido} %)</span>
          </span>
        </div>
        <Medidor valor={noche.vendidas} maximo={noche.aforoALaVenta} />
      </div>

      <div className="portada__par portada__par--separado">
        <span className="sutil">Recaudado</span>
        <span className="precio">{soles(noche.recaudadoCentimos)}</span>
      </div>
    </div>
  );
}
