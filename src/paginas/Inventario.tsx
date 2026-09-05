import { AvisoDeError } from "../Aviso";
import { listarProductos, soles } from "../api";
import { useCarga } from "../datos";

/**
 * Inventario de barra y almacén.
 *
 * Equivale a `app/panel/inventario/page.tsx` del sistema anterior.
 */
export function Inventario() {
  const carga = useCarga(listarProductos, []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el inventario…</p>;
  if (carga.fase === "error") {
    return (
      <AvisoDeError que="el inventario" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
    );
  }

  const productos = carga.datos;

  return (
    <section>
      <header className="cabecera">
        <h2>Inventario</h2>
        <span className="contador">
          {productos.length} {productos.length === 1 ? "producto" : "productos"}
        </span>
      </header>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th className="num">Precio</th>
              <th className="num">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td className="sku">{p.sku}</td>
                <td>{p.nombre}</td>
                <td>{p.categoria}</td>
                <td>
                  <span className="etiqueta">{p.unidad}</span>
                </td>
                <td className="num precio">{soles(p.precioCentimos)}</td>
                <td className="num">{p.alertaDeStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
