import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { NOMBRE_DE_ESTADO_DE_RESERVA, horaDeSala, soles, verLaNoche } from "../api";
import type { AccesoPorPuerta, ReservaEnLaNoche, TramoDeEntrada } from "../api";
import { useCarga } from "../datos";
import { Bloque, BloqueVacio, Medidor } from "./Medidor";
import "./panel.css";

/** A partir de este porcentaje de aforo, la barra avisa en vez de informar. */
const AFORO_AL_LIMITE = 92;

/**
 * La torre de control: cómo va la noche, mientras va.
 *
 * Es la pantalla que se mira de pie y de lejos, así que la jerarquía está
 * invertida respecto a las demás: el aforo va en un número enorme arriba y todo
 * lo demás debajo. A las dos de la mañana no se lee nada más que ese número.
 *
 * Se pide una sola vez al abrir y no se refresca sola. Un intervalo parece la
 * mejora obvia, pero mientras no haya una señal del servidor —una conexión
 * abierta o un aviso— sería el navegador preguntando a ciegas cada pocos
 * segundos. La gente que usa esta pantalla recarga cuando quiere saber, y eso
 * se nota menos que una cifra que cambia sola justo cuando la estás leyendo.
 */
export function Torre() {
  const carga = useCarga(verLaNoche, []);

  if (carga.fase === "cargando") return <p className="aviso">Mirando cómo va la noche…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="la noche" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const t = carga.datos;

  if (!t.hayNoche) {
    return (
      <section>
        <header className="cabecera">
          <h2>Torre de control</h2>
        </header>
        <div className="aviso">
          <p className="aviso__titulo">No hay ninguna noche programada</p>
          <p>
            Esta pantalla enseña la noche abierta, y si no hay ninguna, la siguiente.{" "}
            <Link to="/panel/eventos/nueva" className="enlace">
              Programar una →
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const porcentajeDeAforo = t.aforoDeSala <= 0 ? 0 : Math.round((t.dentro / t.aforoDeSala) * 100);
  const alLimite = porcentajeDeAforo >= AFORO_AL_LIMITE;

  // Quien compró y no ha pasado por la puerta. Nunca negativo: el aforo en vivo
  // cuenta accesos, y un reescaneo mal registrado lo dejaría por encima de las
  // vendidas y la resta saldría al revés.
  const sinLlegar = Math.max(0, t.vendidas - t.dentro);

  return (
    <section>
      <header className="cabecera">
        <h2>Torre de control</h2>
        {/*
          «En curso» y «Abre a las…» no son adornos: los números de una noche que
          no ha empezado son todos cero con razón, y sin esta marca parecen un
          fallo de carga.
        */}
        {t.enCurso ? (
          <span className="torre__en-vivo">
            <span className="torre__latido" aria-hidden="true" />
            En curso
          </span>
        ) : (
          <span className="etiqueta">
            {t.puertasA ? `Abre a las ${horaDeSala(t.puertasA, { timeStyle: "short" })}` : "Sin abrir"}
          </span>
        )}
      </header>

      <p className="torre__noche">
        <Link to={`/panel/eventos/${t.slug}`} className="enlace">
          {t.titulo}
        </Link>
        <span className="sutil"> · {t.sala}</span>
      </p>

      {/* El aforo: el número grande. Es lo único que se lee desde lejos. */}
      <div className={alLimite ? "torre__aforo torre__aforo--limite" : "torre__aforo"}>
        <div className="torre__aforo-fila">
          <div>
            <p className="tarjeta__pie">Personas dentro</p>
            <p className="torre__aforo-cifra">
              {t.dentro}
              <span className="torre__aforo-total"> / {t.aforoDeSala}</span>
            </p>
          </div>
          <div className="torre__aforo-lado">
            <p className="tarjeta__pie">Sin llegar</p>
            <p className="torre__aforo-secundaria">{sinLlegar}</p>
            <p className="portada__pista">de {t.vendidas} entradas vendidas</p>
          </div>
        </div>

        <Medidor
          valor={t.dentro}
          maximo={t.aforoDeSala}
          tono={alLimite ? "alerta" : "acento"}
        />

        {alLimite && (
          <p className="torre__alerta">
            Aforo casi completo. Revisa el control de puerta antes de seguir dejando entrar.
          </p>
        )}
      </div>

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{t.vendidas}</p>
          <p className="tarjeta__pie">Entradas vendidas</p>
          <p className="portada__pista">de {t.aforoDeSala} de aforo</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(t.taquillaCentimos)}</p>
          <p className="tarjeta__pie">Taquilla</p>
          <p className="portada__pista">entradas pagadas</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(t.barraCentimos)}</p>
          <p className="tarjeta__pie">Barra</p>
          <p className="portada__pista">
            {t.consumiciones} {t.consumiciones === 1 ? "consumición" : "consumiciones"}
          </p>
        </div>
        <div className="tarjeta">
          {/*
            La cifra que de verdad dice cómo va la noche. Se divide entre quien
            entró, no entre quien compró: mucha gente que no consume es aforo
            ocupado sin ingreso.
          */}
          <p className="tarjeta__cifra tarjeta__cifra--dinero">
            {t.dentro === 0 ? "—" : soles(t.gastoPorAsistenteCentimos)}
          </p>
          <p className="tarjeta__pie">Por asistente</p>
          <p className="portada__pista">consumo medio en barra</p>
        </div>
      </div>

      <div className="portada__rejilla">
        <Bloque titulo="Ritmo de entrada" pista="tramos de 15 min">
          {t.ritmoDeEntrada.length === 0 ? (
            <BloqueVacio>
              {t.enCurso
                ? "Todavía no ha entrado nadie. Los escaneos aparecerán aquí en cuanto empiecen."
                : "La curva se dibuja cuando la noche está abierta."}
            </BloqueVacio>
          ) : (
            <Curva tramos={t.ritmoDeEntrada} />
          )}
        </Bloque>

        <Bloque titulo="Por puerta" pista="reparto de accesos">
          {t.porPuerta.length === 0 ? (
            <BloqueVacio>Sin accesos registrados todavía.</BloqueVacio>
          ) : (
            <div className="portada__cuerpo">
              {t.porPuerta.map((p) => (
                <Puerta key={p.puerta} acceso={p} dentro={t.dentro} />
              ))}
            </div>
          )}
        </Bloque>

        <Bloque
          titulo="Reservados"
          pista={`${t.reservados.length} ${t.reservados.length === 1 ? "solicitud" : "solicitudes"}`}
          ancho
        >
          {t.reservados.length === 0 ? (
            <BloqueVacio>
              Las solicitudes que llegan desde la web aparecen aquí para confirmarlas por teléfono.
            </BloqueVacio>
          ) : (
            <div className="torre__reservas">
              {t.reservados.map((r) => (
                <FichaDeReserva key={`${r.mesa}-${r.cliente}`} reserva={r} />
              ))}
            </div>
          )}
        </Bloque>
      </div>
    </section>
  );
}

/**
 * La curva de entrada.
 *
 * Barras y no una cifra por tramo a propósito: lo que se mira es la forma —si
 * la cola se está formando o ya pasó—, no cuánta gente entró entre las 23:15 y
 * las 23:30. El número exacto sale al pasar por encima.
 */
function Curva({ tramos }: { tramos: TramoDeEntrada[] }) {
  // El pico marca la escala. Mínimo uno para no dividir por cero en un tramo
  // con todo a cero, que puede pasar si solo hay un tramo y está vacío.
  const pico = Math.max(1, ...tramos.map((t) => t.personas));

  return (
    <div className="portada__cuerpo">
      <div className="torre__curva">
        {tramos.map((t) => (
          <div
            key={t.desde}
            className="torre__barra"
            title={`${horaDeSala(t.desde, { timeStyle: "short" })}: ${t.personas}`}
          >
            <div
              className="torre__barra-relleno"
              style={{ height: `${(t.personas / pico) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="torre__curva-pie">
        <span>{horaDeSala(tramos[0].desde, { timeStyle: "short" })}</span>
        <span className="sutil">pico {pico} / 15 min</span>
        <span>{horaDeSala(tramos[tramos.length - 1].desde, { timeStyle: "short" })}</span>
      </div>
    </div>
  );
}

/** Cuánta gente entró por un acceso, comparada con el total que hay dentro. */
function Puerta({ acceso, dentro }: { acceso: AccesoPorPuerta; dentro: number }) {
  return (
    <div className="portada__medida">
      <div className="portada__par">
        <span>{acceso.puerta}</span>
        <span className="sutil">
          {acceso.personas}
          {acceso.caudalPorMinuto > 0 && ` · ${acceso.caudalPorMinuto}/min`}
        </span>
      </div>
      {/* Contra el total que hay dentro, no contra el aforo: lo que se quiere
          ver es el reparto entre puertas, no lo lleno que está el local. */}
      <Medidor valor={acceso.personas} maximo={Math.max(1, dentro)} />
    </div>
  );
}

function FichaDeReserva({ reserva }: { reserva: ReservaEnLaNoche }) {
  // Tres tonos y no dos: una solicitud sin confirmar no es lo mismo que una
  // cancelada, y quien mira esto necesita distinguir lo que tiene pendiente de
  // llamar de lo que ya está resuelto.
  const tono =
    reserva.estado === "SENTADA"
      ? "estado estado--publicado"
      : reserva.estado === "NO_VINO" || reserva.estado === "CANCELADO"
        ? "estado estado--agotado"
        : "etiqueta";

  return (
    <div className="torre__reserva">
      <div className="torre__reserva-cabecera">
        <div>
          <p className="portada__pista">{reserva.zona ?? "Sin zona"}</p>
          <p className="torre__reserva-mesa">{reserva.mesa}</p>
        </div>
        <span className={tono}>{NOMBRE_DE_ESTADO_DE_RESERVA[reserva.estado]}</span>
      </div>
      <p>{reserva.cliente}</p>
      <p className="portada__pista">
        {reserva.personas} {reserva.personas === 1 ? "persona" : "personas"}
      </p>
    </div>
  );
}
