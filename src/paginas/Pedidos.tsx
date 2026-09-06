import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, listarPedidos, soles, type EstadoDePedido } from "../api";
import { useCarga } from "../datos";

/**
 * Los pedidos de entradas del panel.
 *
 * De momento es solo consulta: la compra en sí vive todavía en el sistema
 * anterior. Sirve para responder «¿pagó esta persona?» cuando alguien llama
 * diciendo que compró y no le llegó nada.
 */

/** El color del estado, reutilizando el mismo lenguaje visual que los eventos. */
function claseDeEstado(estado: EstadoDePedido): string {
  switch (estado) {
    case "PAGADO":
      return "estado estado--publicado";
    case "CANCELADO":
    case "DEVUELTO":
      return "estado estado--agotado";
    default:
      return "estado";
  }
}

export function Pedidos() {
  const carga = useCarga(listarPedidos, []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando los pedidos…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="los pedidos" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const pedidos = carga.datos;
  const pagados = pedidos.filter((p) => p.estado === "PAGADO");
  const facturado = pagados.reduce((suma, p) => suma + p.totalCentimos, 0);

  return (
    <section>
      <header className="cabecera">
        <h2>Pedidos</h2>
        <span className="contador">
          {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
        </span>
      </header>

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{pagados.length}</p>
          <p className="tarjeta__pie">Pagados</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{pedidos.length - pagados.length}</p>
          <p className="tarjeta__pie">Sin pagar</p>
        </div>
        <div className="tarjeta">
          {/* Solo lo pagado cuenta como ingreso: un pendiente reserva cupo pero
              todavía no es dinero. */}
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(facturado)}</p>
          <p className="tarjeta__pie">Facturado</p>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <p className="aviso">Todavía no hay pedidos.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Noche</th>
                <th>Estado</th>
                <th className="num">Total</th>
                <th>Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.codigo}>
                  <td className="sku">
                    <Link to={`/panel/pedidos/${p.codigo}`} className="enlace">
                      {p.codigo}
                    </Link>
                  </td>
                  <td>{p.cliente}</td>
                  <td className="sutil">{p.noche}</td>
                  <td>
                    <span className={claseDeEstado(p.estado)}>{p.estadoEtiqueta}</span>
                  </td>
                  <td className="num precio">{soles(p.totalCentimos)}</td>
                  <td className="sutil">{horaDeSala(p.creadoEn, { dateStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
