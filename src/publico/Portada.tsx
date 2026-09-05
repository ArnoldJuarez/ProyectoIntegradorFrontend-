import { Link } from "react-router-dom";
import { Boletin } from "./Boletin";
import { horaDeSala, soles, verAgenda, type NocheEnCartelera } from "../api";
import { CLUB, pendiente } from "../config";
import { useCarga } from "../datos";

/**
 * La página de inicio.
 *
 * Lo primero que ve alguien que llega desde Instagram un viernes por la tarde,
 * así que lo primero que tiene que responder es «¿qué hay esta noche y cuánto
 * cuesta?». Todo lo demás —el local, cómo llegar, las dudas— va después.
 */

function Cabecera({ proxima }: { proxima?: NocheEnCartelera }) {
  // La foto de la próxima noche manda sobre la de archivo: es más concreta y
  // más actual que cualquier imagen genérica de discoteca.
  const fondo = proxima?.portada ?? CLUB.portada;

  return (
    <header className="hero" style={{ backgroundImage: `url(${fondo})` }}>
      <div className="hero__velo" />
      <div className="hero__contenido">
        <p className="hero__eyebrow">{CLUB.city}</p>
        <h1 className="hero__nombre">{CLUB.name}</h1>
        <p className="hero__tagline">{CLUB.tagline}</p>

        {proxima ? (
          <div className="hero__proxima">
            <p className="hero__cuando">{horaDeSala(proxima.puertasA)}</p>
            <p className="hero__titulo">{proxima.titulo}</p>
            <Link to={`/evento/${proxima.slug}`} className="boton">
              Ver y comprar · desde {soles(proxima.precioDesdeCentimos)}
            </Link>
          </div>
        ) : (
          <p className="hero__proxima">Pronto anunciamos las próximas fechas.</p>
        )}
      </div>
    </header>
  );
}

function TarjetaDeNoche({ noche }: { noche: NocheEnCartelera }) {
  const cabeza = noche.cartel.find((a) => a.cabezaDeCartel) ?? noche.cartel[0];
  const agotada = noche.estado === "SOLD_OUT";

  return (
    <article className="noche">
      <Link to={`/evento/${noche.slug}`} className="noche__enlace">
        <div
          className="noche__foto"
          style={noche.portada ? { backgroundImage: `url(${noche.portada})` } : undefined}
        >
          {agotada && <span className="noche__agotada">Agotado</span>}
        </div>

        <div className="noche__cuerpo">
          <p className="noche__fecha">
            {horaDeSala(noche.puertasA, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h3 className="noche__titulo">{noche.titulo}</h3>

          {cabeza && (
            <p className="noche__cartel">
              {cabeza.nombre}
              {cabeza.genero && <span className="sutil"> · {cabeza.genero}</span>}
            </p>
          )}

          <p className="noche__pie">
            <span className="noche__precio">desde {soles(noche.precioDesdeCentimos)}</span>
            {/*
              El porcentaje solo aparece cuando ya dice algo. Un "0% vendido"
              en una noche recién publicada solo consigue que parezca vacía.
            */}
            {noche.porcentajeVendido >= 50 && !agotada && (
              <span className="noche__llenando">{noche.porcentajeVendido}% vendido</span>
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function Portada() {
  const carga = useCarga(verAgenda, []);

  const noches = carga.fase === "listo" ? carga.datos : [];
  const proxima = noches[0];

  return (
    <div className="publico">
      <Cabecera proxima={proxima} />

      <section className="seccion" id="agenda">
        <h2 className="seccion__titulo">Próximas noches</h2>

        {carga.fase === "cargando" && <p className="aviso">Cargando la agenda…</p>}

        {carga.fase === "error" && (
          <div className="aviso aviso--error">
            <p className="aviso__titulo">No se pudo cargar la agenda</p>
            <p>{carga.mensaje}</p>
          </div>
        )}

        {carga.fase === "listo" &&
          (noches.length === 0 ? (
            <p className="aviso">
              No hay fechas anunciadas ahora mismo. Síguenos en Instagram para enterarte.
            </p>
          ) : (
            <div className="noches">
              {noches.map((n) => (
                <TarjetaDeNoche key={n.slug} noche={n} />
              ))}
            </div>
          ))}
      </section>

      {CLUB.cumple.activa && (
        <section className="seccion promo">
          <h2 className="promo__titulo">{CLUB.cumple.titulo}</h2>
          <p className="promo__texto">{CLUB.cumple.texto}</p>
          <p className="promo__letra">{CLUB.cumple.letraPequena}</p>
        </section>
      )}

      <Boletin />

      <section className="seccion" id="local">
        <h2 className="seccion__titulo">El local</h2>
        <dl className="fichas">
          <div>
            <dt>Dónde</dt>
            <dd>{CLUB.address}</dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>{CLUB.hours}</dd>
          </div>
          <div>
            <dt>Edad mínima</dt>
            <dd>{CLUB.minAge} años, con DNI</dd>
          </div>
          <div>
            <dt>Barra</dt>
            <dd>{CLUB.barra}</dd>
          </div>
        </dl>

        <h3 className="seccion__subtitulo">Antes de venir</h3>
        <p className="descripcion">{CLUB.vestimenta}</p>
        {/*
          `pendiente()` distingue los datos que todavía no nos ha dado el local.
          Se enseñan tal cual, con sus comillas angulares, para que no se olviden;
          lo que no se hace es construir enlaces con ellos.
        */}
        {!pendiente(CLUB.reembolso) && <p className="descripcion">{CLUB.reembolso}</p>}
      </section>
    </div>
  );
}
