import { Link, useParams } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import {
  NOMBRE_DE_CANAL,
  NOMBRE_DE_INTERACCION,
  horaDeSala,
  soles,
  verCliente,
} from "../api";
import { useCarga } from "../datos";

/**
 * La ficha de un cliente: quién es, cuánto vale y qué ha pasado con él.
 *
 * El historial es lo que distingue esto de una fila de una tabla: sin él, un
 * cliente son cuatro contadores sin contexto.
 */
export function ClienteDetalle() {
  const { id = "" } = useParams();
  const carga = useCarga(() => verCliente(id), [id]);

  if (carga.fase === "cargando") return <p className="aviso">Cargando la ficha…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="la ficha" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const c = carga.datos;

  return (
    <section>
      <p className="migas">
        <Link to="/panel/clientes" className="enlace">
          ← Clientes
        </Link>
      </p>

      <header className="cabecera">
        <h2>{c.nombre}</h2>
        {c.aceptaMarketing && <span className="etiqueta">Acepta boletín</span>}
      </header>

      <dl className="fichas">
        <div>
          <dt>Correo</dt>
          <dd>{c.email}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{c.telefono ?? <span className="sutil">Sin teléfono</span>}</dd>
        </div>
        <div>
          <dt>Visitas</dt>
          <dd>{c.visitas}</dd>
        </div>
        <div>
          <dt>Gastado</dt>
          <dd className="precio">{soles(c.gastadoCentimos)}</dd>
        </div>
        <div>
          <dt>Media por visita</dt>
          {/* Derivada de los otros dos contadores; no se guarda en la base. */}
          <dd>{c.visitas > 0 ? soles(c.gastoMedioCentimos) : <span className="sutil">—</span>}</dd>
        </div>
        <div>
          <dt>Última visita</dt>
          <dd>
            {c.ultimaVisita ? (
              horaDeSala(c.ultimaVisita, { dateStyle: "medium" })
            ) : (
              <span className="sutil">Nunca ha venido</span>
            )}
          </dd>
        </div>
        {c.distrito && (
          <div>
            <dt>Distrito</dt>
            <dd>{c.distrito}</dd>
          </div>
        )}
        <div>
          <dt>En la base desde</dt>
          <dd>{horaDeSala(c.creadoEn, { dateStyle: "medium" })}</dd>
        </div>
        {c.consintioEn && (
          <div>
            {/* Un consentimiento sin fecha no vale: si preguntan cuándo lo dio,
                hay que poder responder. */}
            <dt>Consintió el boletín</dt>
            <dd>{horaDeSala(c.consintioEn, { dateStyle: "medium" })}</dd>
          </div>
        )}
      </dl>

      <header className="cabecera">
        <h2>Historial</h2>
        <span className="contador">
          {c.historial.length} {c.historial.length === 1 ? "apunte" : "apuntes"}
        </span>
      </header>

      {c.historial.length === 0 ? (
        <p className="aviso">Todavía no hay nada apuntado de esta persona.</p>
      ) : (
        <ul className="historial">
          {c.historial.map((linea) => (
            <li key={linea.id}>
              <div className="historial__meta">
                <span className="etiqueta">{NOMBRE_DE_INTERACCION[linea.tipo]}</span>
                {linea.canal && <span className="sutil">{NOMBRE_DE_CANAL[linea.canal]}</span>}
              </div>
              <p className="historial__resumen">{linea.resumen}</p>
              <p className="historial__cuando">{horaDeSala(linea.cuando)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
