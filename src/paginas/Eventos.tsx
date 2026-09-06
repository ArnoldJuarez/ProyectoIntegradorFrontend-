import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { NOMBRE_DE_ESTADO, horaDeSala, listarEventos, soles } from "../api";
import { useCarga } from "../datos";

/**
 * Las noches, con su aforo vendido en vivo.
 *
 * Equivale a `app/panel/eventos/page.tsx` del sistema anterior.
 */
export function Eventos() {
  const carga = useCarga(listarEventos, []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando las noches…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="las noches" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const eventos = carga.datos;

  return (
    <section>
      <header className="cabecera">
        <h2>Eventos</h2>
        <div className="cabecera__acciones">
          <span className="contador">
            {eventos.length} {eventos.length === 1 ? "noche" : "noches"}
          </span>
          <Link to="/panel/eventos/nueva" className="boton-secundario">
            Nueva noche
          </Link>
        </div>
      </header>

      {eventos.length === 0 ? (
        <p className="aviso">Todavía no hay ninguna noche creada.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Noche</th>
                <th>Puertas</th>
                <th>Sala</th>
                <th>Estado</th>
                <th className="num">Aforo</th>
                <th className="num">Recaudado</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                // Sin aforo a la venta no hay porcentaje que calcular: dividir
                // daria NaN y se pintaria "NaN%".
                const porcentaje =
                  e.aforoALaVenta > 0 ? Math.round((e.vendidas / e.aforoALaVenta) * 100) : 0;

                return (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/panel/eventos/${e.slug}`} className="enlace">
                        {e.titulo}
                      </Link>
                    </td>
                    <td>{horaDeSala(e.puertasA)}</td>
                    <td>{e.sala}</td>
                    <td>
                      <span className={`estado estado--${e.estado.toLowerCase()}`}>
                        {NOMBRE_DE_ESTADO[e.estado]}
                      </span>
                    </td>
                    <td className="num">
                      {e.vendidas} / {e.aforoALaVenta}
                      <span className="porcentaje"> {porcentaje}%</span>
                    </td>
                    <td className="num precio">{soles(e.recaudadoCentimos)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
