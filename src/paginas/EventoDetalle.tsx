import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TablaDeListas } from "./Promotores";
import { TiposDeEntrada } from "./TiposDeEntrada";
import { AvisoDeError } from "../Aviso";
import { NOMBRE_DE_ESTADO, horaDeSala, listasDeLaNoche, soles, verEvento } from "../api";
import { useCarga } from "../datos";

/** La ficha de una noche: horario, condiciones y cómo va la venta por tipo. */
export function EventoDetalle() {
  const { slug = "" } = useParams();

  /*
   * Un contador para volver a pedir la ficha.
   *
   * `useCarga` no trae un «recargar» a propósito: no es una librería de caché,
   * es el patrón de carga escrito una vez. Aquí se le añade una dependencia que
   * cambia a mano, que hace falta porque tocar las entradas cambia también los
   * totales de arriba —lo recaudado y lo vendido— y dejarlos viejos sería peor
   * que no enseñarlos.
   */
  const [version, setVersion] = useState(0);
  const carga = useCarga(() => verEvento(slug), [slug, version]);
  const listas = useCarga(() => listasDeLaNoche(slug), [slug]);

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
        <div className="cabecera__acciones">
          <span className={`estado estado--${e.estado.toLowerCase()}`}>
            {NOMBRE_DE_ESTADO[e.estado]}
          </span>
          <Link to={`/panel/eventos/${e.slug}/editar`} className="boton-secundario">
            Editar
          </Link>
        </div>
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
        <div>
          <dt>Recaudado</dt>
          <dd className="precio">{soles(e.recaudadoCentimos)}</dd>
        </div>
        {e.vestimenta && (
          <div>
            <dt>Vestimenta</dt>
            <dd>{e.vestimenta}</dd>
          </div>
        )}
      </dl>

      <TiposDeEntrada
        slug={e.slug}
        tipos={e.tiposDeEntrada}
        aforoDeSala={e.aforoDeSala}
        alCambiar={() => setVersion((v) => v + 1)}
      />

      {/* Las listas no bloquean la ficha: si fallan, la noche se sigue viendo. */}
      {listas.fase === "listo" && (
        <div className="apartado">
          <h3 className="subtitulo">Listas de invitados</h3>
          {listas.datos.length === 0 ? (
            <p className="sutil">Ningún promotor ha abierto lista para esta noche.</p>
          ) : (
            <TablaDeListas listas={listas.datos} conPromotor />
          )}
        </div>
      )}
    </section>
  );
}
