import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Comprar } from "./Comprar";
import { Reservados } from "./Reservados";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, imagen, soles, verNoche } from "../api";
import { CLUB } from "../config";
import { useCarga } from "../datos";

/**
 * La ficha pública de una noche: qué hay, a qué hora, cuánto cuesta y qué hace
 * falta para entrar.
 *
 * Las entradas se listan con su precio y, debajo, el selector para comprarlas.
 * El listado de arriba es informativo —se lee de un vistazo antes de decidir— y
 * el selector es donde se elige.
 */
export function FichaDeNoche() {
  const { slug = "" } = useParams();
  const carga = useCarga(() => verNoche(slug), [slug]);
  const { hash } = useLocation();

  // El navegador salta al ancla al cargar, pero aquí la sección aparece después,
  // cuando llegan los datos: hay que llevarle a mano.
  useEffect(() => {
    if (carga.fase === "listo" && hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    }
  }, [carga.fase, hash]);

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
        style={n.portada ? { backgroundImage: `url(${imagen(n.portada)})` } : undefined}
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
          Agotada quiere decir que no queda nada que vender: enseñar el
          selector con todos los contadores a cero solo haría perder el
          tiempo a quien llega tarde.
        */}
        {agotada ? (
          <p className="aviso">Esta noche está agotada.</p>
        ) : (
          <Comprar slug={n.slug} entradas={n.entradas} />
        )}

        {/* Los reservados sí se pueden pedir: no cobran nada ni apartan la mesa. */}
        {/* Con ancla: la portada enlaza aquí desde «Reserva tu box». */}
        <div id="reservados">
          <Reservados slug={n.slug} />
        </div>

        <p className="migas">
          <Link to="/agenda" className="enlace">
            ← Todas las fechas
          </Link>
        </p>
      </section>
    </div>
  );
}
