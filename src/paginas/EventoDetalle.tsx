import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { TablaDeListas } from "./Promotores";
import { TiposDeEntrada } from "./TiposDeEntrada";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  borrarNoche,
  comoVideo,
  estadoVisible,
  horaDeSala,
  imagen,
  listasDeLaNoche,
  soles,
  verEvento,
} from "../api";
import { useCarga } from "../datos";

/** La ficha de una noche: horario, cartel, flyer y video, y cómo va la venta por tipo. */
export function EventoDetalle() {
  const { slug = "" } = useParams();
  const navegar = useNavigate();

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
  const [borrando, setBorrando] = useState(false);

  if (carga.fase === "cargando") return <p className="aviso">Cargando la noche…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="la noche" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const e = carga.datos;
  // Solo se ofrece borrar lo que el backend podría borrar; si aun así tiene
  // historia (pedidos, gastos…), el mensaje de vuelta dice cuál.
  const borrable = e.estado === "BORRADOR" || e.estado === "CANCELADO";
  const video = e.video ? comoVideo(e.video) : null;

  async function borrar() {
    if (!window.confirm(`¿Borrar «${e.titulo}»? Se pierden sus entradas, su cartel y su flyer.`)) return;
    setBorrando(true);
    try {
      await borrarNoche(e.slug);
      toast.success("Noche borrada");
      navegar("/panel/eventos");
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo borrar la noche.");
      setBorrando(false);
    }
  }

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
          <span className={estadoVisible(e.estado, e.empiezaA).clase}>
            {estadoVisible(e.estado, e.empiezaA).texto}
          </span>
          <Link to={`/panel/eventos/${e.slug}/noche`} className="boton">
            {new Date(e.empiezaA) < new Date() ? "Cómo fue la noche" : "Cómo va la venta"}
          </Link>
          <Link to={`/panel/eventos/${e.slug}/editar`} className="boton-secundario">
            Editar
          </Link>
          {e.estado !== "BORRADOR" && (
            <Link to={`/evento/${e.slug}`} className="boton-fantasma">
              Ver en la web
            </Link>
          )}
          {borrable && (
            <button type="button" className="boton-fantasma boton--peligro" onClick={() => void borrar()} disabled={borrando}>
              {borrando ? "Borrando…" : "Borrar"}
            </button>
          )}
        </div>
      </header>

      {e.estado === "BORRADOR" && (
        <p className="aviso">
          Está en borrador: no sale en la web. Revisa el cartel y las entradas, sube el flyer y cámbiala a
          «Publicado» desde «Editar» cuando esté lista.
        </p>
      )}

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
        <div>
          <dt>Cartel</dt>
          <dd>
            {e.cartel.length === 0 ? (
              <span className="sutil">Sin confirmar</span>
            ) : (
              e.cartel.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && " · "}
                  {a.cabezaDeCartel ? <strong>{a.nombre}</strong> : a.nombre}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>

      {(e.portada || video) && (
        <div className="medios">
          {e.portada && <img src={imagen(e.portada)} alt="Flyer de la noche" className="medios__flyer" />}
          {video?.tipo === "archivo" && (
            <video src={video.src} className="medios__video" controls muted playsInline preload="metadata" />
          )}
          {video?.tipo === "youtube" && (
            <iframe
              className="medios__video"
              src={`https://www.youtube-nocookie.com/embed/${video.id}`}
              title={`Video de ${e.titulo}`}
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          )}
        </div>
      )}

      <TiposDeEntrada
        slug={e.slug}
        tipos={e.tiposDeEntrada}
        aforoDeSala={e.aforoDeSala}
        alCambiar={() => setVersion((v) => v + 1)}
      />

      {/* Las listas no bloquean la ficha: si fallan, la noche se sigue viendo. */}
      {listas.fase === "listo" && (
        <div className="apartado">
          <div className="apartado__cabecera">
            <h3 className="subtitulo">Listas de invitados</h3>
            <Link to={`/panel/promotores?noche=${e.slug}`} className="boton-secundario">
              Abrir una lista
            </Link>
          </div>
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
