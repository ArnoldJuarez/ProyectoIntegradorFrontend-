import { Link, useParams } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verPedido } from "../api";
import { useCarga } from "../datos";

/**
 * La ficha de un pedido: qué compró, cuánto pagó y en qué estado están sus
 * entradas.
 *
 * Lo que más se consulta aquí es la lista de entradas: si alguien discute en la
 * puerta, esto dice si su entrada ya se usó y a qué hora.
 */
export function PedidoDetalle() {
  const { codigo = "" } = useParams();
  const carga = useCarga(() => verPedido(codigo), [codigo]);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el pedido…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="el pedido" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const { pedido: p, email, telefono, subtotalCentimos, comisionCentimos, lineas, entradas } =
    carga.datos;

  const usadas = entradas.filter((e) => e.yaSeUso).length;

  return (
    <section>
      <p className="migas">
        <Link to="/panel/pedidos" className="enlace">
          ← Pedidos
        </Link>
      </p>

      <header className="cabecera">
        <h2>{p.codigo}</h2>
        <span className={p.estado === "PAGADO" ? "estado estado--publicado" : "estado"}>
          {p.estadoEtiqueta}
        </span>
      </header>

      <dl className="fichas">
        <div>
          <dt>Cliente</dt>
          <dd>{p.cliente}</dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{telefono ?? <span className="sutil">Sin teléfono</span>}</dd>
        </div>
        <div>
          <dt>Noche</dt>
          <dd>
            <Link to={`/panel/eventos/${p.nocheSlug}`} className="enlace">
              {p.noche}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Creado</dt>
          <dd>{horaDeSala(p.creadoEn)}</dd>
        </div>
        <div>
          <dt>Pagado</dt>
          <dd>{p.pagadoEn ? horaDeSala(p.pagadoEn) : <span className="sutil">Sin pagar</span>}</dd>
        </div>
      </dl>

      <header className="cabecera">
        <h2>Lo que compró</h2>
      </header>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="num">Cantidad</th>
              <th className="num">Precio</th>
              <th className="num">Importe</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.tipoDeEntrada}>
                <td>{l.tipoDeEntrada}</td>
                <td className="num">{l.cantidad}</td>
                <td className="num sutil">{soles(l.precioUnitarioCentimos)}</td>
                <td className="num precio">{soles(l.importeCentimos)}</td>
              </tr>
            ))}
            {/* La comisión va aparte del subtotal: es lo que el cliente ve
                desglosado al pagar, y sumarla en silencio da sorpresas. */}
            <tr>
              <td colSpan={3} className="num sutil">
                Subtotal
              </td>
              <td className="num sutil">{soles(subtotalCentimos)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="num sutil">
                Gastos de gestión
              </td>
              <td className="num sutil">{soles(comisionCentimos)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="num">
                <strong>Total</strong>
              </td>
              <td className="num precio">
                <strong>{soles(p.totalCentimos)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <header className="cabecera">
        <h2>Entradas</h2>
        <span className="contador">
          {usadas} de {entradas.length} usadas
        </span>
      </header>

      {entradas.length === 0 ? (
        <p className="aviso">
          Este pedido todavía no tiene entradas emitidas. Se emiten al pagar.
        </p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                {/* Referencia y no «código»: lo que se enseña son los primeros
                    caracteres del id, no el contenido del QR. */}
                <th>Ref.</th>
                <th>Tipo</th>
                <th>Titular</th>
                <th>Estado</th>
                <th>Entró</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.referencia}>
                  <td className="sku">{e.referencia}</td>
                  <td>{e.tipoDeEntrada}</td>
                  <td>{e.titular ?? <span className="sutil">Sin nombre</span>}</td>
                  <td>
                    <span
                      className={
                        e.estado === "VALIDA" ? "estado estado--publicado" : "estado"
                      }
                    >
                      {e.estadoEtiqueta}
                    </span>
                  </td>
                  <td className="sutil">
                    {e.escaneadaEn ? horaDeSala(e.escaneadaEn) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
