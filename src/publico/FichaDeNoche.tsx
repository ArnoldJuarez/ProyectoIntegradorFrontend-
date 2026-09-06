import { Link, useParams } from "react-router-dom";
import { Reservados } from "./Reservados";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verNoche } from "../api";
import { CLUB } from "../config";
import { useCarga } from "../datos";

/**
 * La ficha pública de una noche: qué hay, a qué hora, cuánto cuesta y qué hace
 * falta para entrar.
 *
 * La compra todavía no está migrada, así que las entradas se enseñan con sus
 * precios y su disponibilidad pero no se pueden comprar aún.
 */
export function FichaDeNoche() {
  const { slug = "" } = useParams();
  const carga = useCarga(() => verNoche(slug), [slug]);

  if (carga.fase === "cargando") return <p className="aviso">Cargando la noche…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="la noche" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const n = carga.datos;
  const agotada = n.estado === "AGOTADO";

  return (
    <div className="publico">
      <header
        className="hero hero--evento"
        style={n.portada ? { backgroundImage: `url(${n.portada})` } : undefined}
      >
        <div className="hero__velo" />
        <div className="hero__contenido">
          <p className="hero__eyebrow">
            {horaDeSala(n.puertasA, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="hero__nombre hero__nombre--evento">{n.titulo}</h1>
          {agotada && <p className="hero__agotado">Agotado</p>}
        </div>
      </header>

      <section className="seccion">
        {n.descripcion && <p className="descripcion">{n.descripcion}</p>}

        {n.cartel.length > 0 && (
          <>
            <h2 className="seccion__titulo">Cartel</h2>
            <ul className="cartel">
              {n.cartel.map((a) => (
                <li key={a.nombre} className={a.cabezaDeCartel ? "cartel__cabeza" : undefined}>
                  <p className="cartel__nombre">{a.nombre}</p>
                  {a.genero && <p className="cartel__genero">{a.genero}</p>}
                  {a.empiezaA && a.terminaA && (
                    <p className="cartel__hora">
                      {horaDeSala(a.empiezaA, { timeStyle: "short" })}–
                      {horaDeSala(a.terminaA, { timeStyle: "short" })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="seccion__titulo">Antes de venir</h2>
        <dl className="fichas">
          <div>
            <dt>Sala</dt>
            <dd>{n.sala}</dd>
          </div>
          <div>
            <dt>Puertas</dt>
            <dd>{horaDeSala(n.puertasA, { timeStyle: "short" })}</dd>
          </div>
          <div>
            <dt>Cierre</dt>
            <dd>{horaDeSala(n.terminaA, { timeStyle: "short" })}</dd>
          </div>
          <div>
            <dt>Edad mínima</dt>
            <dd>{n.edadMinima} años, con DNI</dd>
          </div>
          {n.vestimenta && (
            <div>
              <dt>Vestimenta</dt>
              <dd>{n.vestimenta}</dd>
            </div>
          )}
          <div>
            <dt>Dirección</dt>
            <dd>{CLUB.address}</dd>
          </div>
        </dl>

        <h2 className="seccion__titulo">Entradas</h2>
        <ul className="entradas">
          {n.entradas.map((e) => (
            <li key={e.id} className={e.disponibles === 0 ? "entrada entrada--sin" : "entrada"}>
              <div>
                <p className="entrada__nombre">{e.nombre}</p>
                {e.descripcion && <p className="entrada__desc">{e.descripcion}</p>}
              </div>
              <div className="entrada__derecha">
                <p className="entrada__precio">{soles(e.precioCentimos)}</p>
                <p className="entrada__quedan">
                  {e.disponibles === 0
                    ? "Agotada"
                    : e.disponibles <= 20
                      ? `Quedan ${e.disponibles}`
                      : "Disponible"}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/*
          La compra vive en el sistema anterior hasta que se migre: es lo
          transaccional y va al final. Decirlo es mejor que un botón que no
          hace nada.
        */}
        <p className="aviso">
          La compra por internet todavía no está disponible en esta versión. Escríbenos por
          WhatsApp para comprar tu entrada.
        </p>

        {/* Los reservados sí se pueden pedir: no cobran nada ni apartan la mesa. */}
        <Reservados slug={n.slug} />

        <p className="migas">
          <Link to="/agenda" className="enlace">
            ← Todas las fechas
          </Link>
        </p>
      </section>
    </div>
  );
}
