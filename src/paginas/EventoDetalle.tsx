import { Link, useParams } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { NOMBRE_DE_ESTADO, horaDeSala, soles, verEvento } from "../api";
import { useCarga } from "../datos";

/** La ficha de una noche: horario, condiciones y cómo va la venta por tipo. */
export function EventoDetalle() {
  const { slug = "" } = useParams();
  const carga = useCarga(() => verEvento(slug), [slug]);

  if (carga.fase === "cargando") return <p className="aviso">Cargando la noche…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="la noche" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const e = carga.datos;

  return (
    <section>
      <p className="migas">
        <Link to="/panel/eventos" className="enlace">
          ← Eventos
        </Link>
      </p>

      <header className="cabecera">
        <h2>{e.titulo}</h2>
        <span className={`estado estado--${e.estado.toLowerCase()}`}>
          {NOMBRE_DE_ESTADO[e.estado]}
        </span>
      </header>

      {e.descripcion && <p className="descripcion">{e.descripcion}</p>}

      <dl className="fichas">
        <div>
          <dt>Sala</dt>
          <dd>
            {e.sala} · aforo {e.aforoDeSala}
          </dd>
        </div>
        <div>
          <dt>Puertas</dt>
          <dd>{horaDeSala(e.puertasA)}</dd>
        </div>
        <div>
          <dt>Empieza</dt>
          <dd>{horaDeSala(e.empiezaA, { timeStyle: "short" })}</dd>
        </div>
        <div>
          <dt>Cierra</dt>
          <dd>{horaDeSala(e.terminaA, { timeStyle: "short" })}</dd>
        </div>
        <div>
          <dt>Edad mínima</dt>
          <dd>{e.edadMinima} años</dd>
        </div>
        {e.vestimenta && (
          <div>
            <dt>Vestimenta</dt>
            <dd>{e.vestimenta}</dd>
          </div>
        )}
      </dl>

      <header className="cabecera">
        <h2>Entradas</h2>
        <span className="contador">{soles(e.recaudadoCentimos)} recaudado</span>
      </header>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="num">Precio</th>
              <th className="num">Vendidas</th>
              <th className="num">Quedan</th>
              <th>Venta</th>
            </tr>
          </thead>
          <tbody>
            {e.tiposDeEntrada.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.nombre}
                  {t.descripcion && <span className="sutil"> · {t.descripcion}</span>}
                </td>
                <td className="num precio">{soles(t.precioCentimos)}</td>
                <td className="num">
                  {t.vendidas} / {t.cantidad}
                </td>
                <td className="num">{t.disponibles}</td>
                <td>
                  <span className="etiqueta">{t.activo ? "Abierta" : "Cerrada"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
