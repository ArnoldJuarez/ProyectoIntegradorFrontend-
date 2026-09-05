import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, listarClientes, soles } from "../api";
import { useCarga } from "../datos";

/**
 * El listado de clientes del panel.
 *
 * Equivale a `app/panel/clientes/page.tsx` del sistema anterior.
 */
export function Clientes() {
  const [escrito, setEscrito] = useState("");
  const [buscado, setBuscado] = useState("");

  /*
   * La búsqueda se retrasa un poco en vez de dispararse en cada tecla: sin
   * esto, escribir "arnold" son seis peticiones y las respuestas pueden llegar
   * desordenadas, dejando en pantalla el resultado de "arnol".
   */
  useEffect(() => {
    const espera = setTimeout(() => setBuscado(escrito), 300);
    return () => clearTimeout(espera);
  }, [escrito]);

  const carga = useCarga(() => listarClientes(buscado), [buscado]);

  return (
    <section>
      <header className="cabecera">
        <h2>Clientes</h2>
        {carga.fase === "listo" && (
          <span className="contador">
            {carga.datos.length} {carga.datos.length === 1 ? "persona" : "personas"}
          </span>
        )}
      </header>

      <input
        className="buscador"
        type="search"
        placeholder="Buscar por nombre o correo…"
        value={escrito}
        onChange={(e) => setEscrito(e.target.value)}
      />

      {carga.fase === "cargando" && <p className="aviso">Cargando…</p>}

      {carga.fase === "error" && (
        <AvisoDeError que="los clientes" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
      )}

      {carga.fase === "listo" &&
        (carga.datos.length === 0 ? (
          <p className="aviso">
            {buscado ? `Nadie coincide con «${buscado}».` : "Todavía no hay clientes."}
          </p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th className="num">Visitas</th>
                  <th className="num">Gastado</th>
                  <th>Última visita</th>
                  <th>Boletín</th>
                </tr>
              </thead>
              <tbody>
                {carga.datos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/panel/clientes/${c.id}`} className="enlace">
                        {c.nombre}
                      </Link>
                    </td>
                    <td>
                      {c.email}
                      {c.telefono && <span className="sutil"> · {c.telefono}</span>}
                    </td>
                    <td className="num">{c.visitas}</td>
                    <td className="num precio">{soles(c.gastadoCentimos)}</td>
                    <td>
                      {c.ultimaVisita ? (
                        horaDeSala(c.ultimaVisita, { dateStyle: "medium" })
                      ) : (
                        <span className="sutil">Nunca</span>
                      )}
                    </td>
                    <td>
                      {c.aceptaMarketing ? (
                        <span className="etiqueta">Sí</span>
                      ) : (
                        <span className="sutil">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
