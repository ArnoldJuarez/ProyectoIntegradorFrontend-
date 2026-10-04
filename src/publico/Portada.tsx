import { Link } from "react-router-dom";
import { Boletin } from "./Boletin";
import { Acordeon } from "./portada/acordeon";
import { BarraMovil } from "./portada/barra-movil";
import { CuentaAtras } from "./portada/cuenta-atras";
import { cuantoFalta } from "./portada/cuenta-atras-calculo";
import { ElLocal } from "./portada/el-local";
import { EventCard } from "./portada/event-card";
import { Marquesina } from "./portada/marquesina";
import { PortadaMedia } from "./portada/portada-media";
import { Encabezado } from "./portada/seccion";
import { horaDeSala, imagen, soles, verAgenda, verExtrasDePortada, type NocheEnCartelera } from "../api";
import { CLUB, pendiente } from "../config";
import { useCarga } from "../datos";

/**
 * La portada pública: la próxima noche ocupa la pantalla.
 *
 * La noticia es esa noche concreta, no un eslogan sobre «la mejor fiesta de la
 * ciudad». Quien entra un jueves está decidiendo si sale el sábado, y lo que
 * necesita es la fecha, el cartel y el precio. Debajo, el resto: más fechas,
 * boxes, el local, artistas, noches pasadas y cómo llegar.
 *
 * Es la misma portada que el sistema anterior, con sus mismas piezas.
 */

/**
 * Umbral de urgencia: a partir de aquí la barra de aforo deja de ser un dato y
 * pasa a ser un aviso. Por debajo de dos tercios, decir «últimas» es mentira, y
 * una web que miente con la escasez se nota.
 */
const UMBRAL_ULTIMAS = 65;

/**
 * Por debajo de aquí, el aforo no se enseña. Un «4 % vendido» no informa:
 * desanima. Mientras no haya prueba social, lo que empuja es el reloj.
 */
const UMBRAL_AFORO = 25;

/**
 * El título sin el nombre del cabeza de cartel pegado detrás.
 *
 * Las noches se llaman «Noche Electrónica · Nena Sur», y en la portada el
 * cartel ya va en su propia línea. Solo corta si el nombre está EXACTAMENTE al
 * final y tras un separador; si al cortar no queda nada, devuelve el original.
 */
function tituloSinCabeza(titulo: string, cabeza: string | null): string {
  if (!cabeza) return titulo;
  for (const separador of ["·", "-", "–", "—", "|"]) {
    const sufijo = ` ${separador} ${cabeza}`.toLowerCase();
    if (titulo.toLowerCase().endsWith(sufijo)) {
      return titulo.slice(0, -sufijo.length).trim() || titulo;
    }
  }
  return titulo;
}

function Cabecera({ proxima, hayMas }: { proxima?: NocheEnCartelera; hayMas: boolean }) {
  const cabeza = proxima?.cartel.find((a) => a.cabezaDeCartel)?.nombre ?? null;
  const teloneros = proxima?.cartel.filter((a) => !a.cabezaDeCartel).map((a) => a.nombre) ?? [];
  const generos = proxima ? [...new Set(proxima.cartel.map((a) => a.genero).filter(Boolean))] : [];
  const vendido = proxima?.porcentajeVendido ?? 0;

  return (
    <section className="relative flex min-h-[88vh] flex-col justify-end overflow-hidden border-b border-line">
      {/* Vídeo, foto o haces de luz: lo que haya, en ese orden. */}
      <PortadaMedia portada={CLUB.portada} foto={proxima?.portada} />

      {/*
        El hueco de abajo en móvil es para el botón flotante del chat: sin
        margen, se come el precio y el aviso del precio en puerta.
      */}
      <div className="relative mx-auto w-full max-w-6xl px-5 pt-28 pb-28 sm:pt-36 sm:pb-20">
        {proxima ? (
          <div className="flex max-w-4xl flex-col gap-6">
            {/* El género antes que el nombre: es el primer filtro de quien duda. */}
            <span className="eyebrow encender flex w-fit items-center gap-3 border border-acento-dim px-3 py-2 text-acento-text">
              <span className="latir inline-block h-2 w-2 bg-acento" />
              {generos[0] ?? "Próxima noche"}
            </span>

            <h1 className="surgir text-[clamp(3rem,13vw,8.5rem)]">
              {tituloSinCabeza(proxima.titulo, cabeza)}
            </h1>

            {cabeza && (
              <div className="surgir flex flex-wrap items-baseline gap-x-5 gap-y-1" style={{ animationDelay: "80ms" }}>
                <span className="font-display text-4xl font-black text-acento-text uppercase">{cabeza}</span>
                {teloneros.length > 0 && (
                  <span className="text-ink-soft">
                    {teloneros.join(" · ")} {teloneros.length === 1 ? "abre" : "abren"} la noche
                  </span>
                )}
              </div>
            )}

            <div className="surgir flex flex-wrap items-center gap-2" style={{ animationDelay: "200ms" }}>
              {[
                horaDeSala(proxima.empiezaA, { weekday: "long", day: "numeric", month: "long" }),
                proxima.sala,
                `Puertas ${horaDeSala(proxima.puertasA, { timeStyle: "short" })}`,
                `+${proxima.edadMinima} con DNI`,
                proxima.vestimenta,
              ]
                .filter(Boolean)
                .map((dato) => (
                  <span
                    key={dato as string}
                    className="eyebrow border border-line bg-surface/70 px-3 py-1.5 text-ink-soft backdrop-blur"
                  >
                    {dato}
                  </span>
                ))}
            </div>

            {/*
              La barra de aforo, con las dos caras del mismo número: lo vendido,
              que es la prueba social, y el reloj, que corre igual para todos.
            */}
            <div className="surgir flex max-w-xl flex-col gap-1.5" style={{ animationDelay: "240ms" }}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="eyebrow tnum text-acento-text">
                  <CuentaAtras fecha={proxima.empiezaA} inicial={cuantoFalta(new Date(proxima.empiezaA))} />
                </span>
                {vendido >= UMBRAL_AFORO && (
                  <span className={`eyebrow tnum ${vendido >= UMBRAL_ULTIMAS ? "text-alarma" : "text-muted"}`}>
                    {vendido}% vendido
                    {vendido >= UMBRAL_ULTIMAS && " · Últimas entradas"}
                  </span>
                )}
              </div>
              {vendido >= UMBRAL_AFORO && (
                <div aria-hidden className="h-[3px] bg-white/12">
                  <div
                    className={`subir h-full ${vendido >= UMBRAL_ULTIMAS ? "bg-alarma" : "bg-acento"}`}
                    style={{ width: `${vendido}%` }}
                  />
                </div>
              )}
            </div>

            <div className="surgir mt-2 flex flex-wrap items-center gap-6" style={{ animationDelay: "280ms" }}>
              <Link
                to={`/evento/${proxima.slug}`}
                className="glow-acento group flex items-center gap-3 bg-acento px-8 py-4 font-display text-2xl font-black text-on-acento uppercase transition duration-300 hover:brightness-110"
              >
                Comprar entrada
                <span className="transition duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <div className="flex flex-col">
                <span className="eyebrow text-muted">desde</span>
                <span className="tnum font-display text-4xl font-black">{soles(proxima.precioDesdeCentimos)}</span>
                {/* El aviso que evita la discusión en la puerta. */}
                <span className="text-xs text-muted">el precio en puerta es mayor</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex max-w-2xl flex-col gap-5">
            <h1 className="text-neon text-[clamp(3rem,12vw,7rem)]">{CLUB.name}</h1>
            <p className="text-lg text-ink-soft">
              Estamos cerrando el próximo cartel. Vuelve en unos días y tendrás fechas nuevas aquí.
            </p>
          </div>
        )}

        {/* Pista de que la página sigue. Sin esto, media web se queda en la portada. */}
        {hayMas && (
          <a
            href="#fechas"
            className="eyebrow mt-12 inline-flex items-center gap-2 text-muted transition hover:text-acento-text"
          >
            Ver más <span aria-hidden>↓</span>
          </a>
        )}
      </div>
    </section>
  );
}

export function Portada() {
  const agenda = useCarga(verAgenda, []);
  const extras = useCarga(verExtrasDePortada, []);

  const noches = agenda.fase === "listo" ? agenda.datos : [];
  const [proxima, ...resto] = noches;
  const x = extras.fase === "listo" ? extras.datos : null;

  const whatsapp = CLUB.whatsapp && !pendiente(CLUB.whatsapp) ? CLUB.whatsapp : null;
  const instagram = CLUB.instagram && !pendiente(CLUB.instagram) ? CLUB.instagram : null;
  const mapa = CLUB.coords
    ? `https://www.google.com/maps?q=${CLUB.coords.lat},${CLUB.coords.lng}&hl=es&z=17&output=embed`
    : null;

  return (
    // overflow-x-hidden: la marquesina es más ancha que la pantalla a propósito, y sin
    // recortarla la página entera se desplaza de lado en el móvil.
    <div className="tw min-w-0 overflow-x-hidden bg-ground text-ink">
      {agenda.fase === "error" && (
        <div className="aviso aviso--error">
          <p className="aviso__titulo">No se pudo cargar la agenda</p>
          <p>{agenda.mensaje}</p>
        </div>
      )}

      <Cabecera proxima={proxima} hayMas={resto.length > 0} />

      {/* La fachada: el cartel desfilando. */}
      <Marquesina
        textos={[CLUB.name, "Jueves a domingo", "Entradas en línea", `+${CLUB.minAge} con DNI`, "Boxes"]}
      />

      {resto.length > 0 && (
        <section id="fechas" className="mx-auto max-w-6xl px-5 py-20">
          <Encabezado rotulo="Agenda" titulo="Próximas noches" accion="Ver todas" href="/agenda" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resto.map((n, i) => (
              <EventCard key={n.slug} noche={n} indice={i} />
            ))}
          </div>
        </section>
      )}

      {/*
        La promo de cumpleaños, justo después de las fechas y en una banda que
        corta la página: funciona porque quien cumple años arrastra a diez.
      */}
      {CLUB.cumple.activa && (
        <section className="relative overflow-hidden border-y border-acento-dim">
          <div aria-hidden className="rayado absolute inset-0" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(60% 120% at 15% 50%, rgb(201 255 0 / 0.14) 0%, transparent 65%)" }}
          />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl sm:text-4xl">{CLUB.cumple.titulo}</h2>
              <p className="mt-1 font-display text-2xl font-black text-acento-text uppercase">{CLUB.cumple.texto}</p>
              <p className="mt-2 max-w-md text-sm text-ink-soft">{CLUB.cumple.letraPequena}</p>
            </div>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="glow-acento eyebrow shrink-0 self-start bg-acento px-6 py-4 text-on-acento transition hover:brightness-110 sm:self-auto"
              >
                Pedirlo por WhatsApp
              </a>
            )}
          </div>
        </section>
      )}

      {/* Boxes: vende el box, por eso el consumo mínimo va grande. */}
      {x && x.boxes.length > 0 && (
        <section id="reservados" className="relative overflow-hidden border-y border-line bg-surface">
          <div aria-hidden className="reticula absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-6xl px-5 py-20">
            <Encabezado rotulo="Boxes" titulo="Reserva tu box" />

            <div className="mb-10 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
              <p className="max-w-2xl text-lg text-ink-soft">
                Box propio, acceso sin cola y atención para todo el grupo. Se confirma por teléfono tras
                la solicitud y el depósito se descuenta del consumo de la noche.
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  "Acceso sin cola",
                  "Atención en el box toda la noche",
                  "El depósito se descuenta del consumo",
                  "El box es tuyo hasta que cierre",
                ].map((v) => (
                  <li key={v} className="flex items-start gap-3 text-ink-soft">
                    <span aria-hidden className="mt-0.5 text-acento-text">
                      ✓
                    </span>
                    {v}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-10 grid gap-4 sm:grid-cols-2">
              {x.boxes.map((b, i) => (
                <div
                  key={`${b.zona}|${b.plazas}|${b.consumoMinimoCentimos}`}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className="surgir group relative overflow-hidden border border-line bg-ground p-6 transition duration-300 hover:border-acento"
                >
                  <div className="relative mb-4 flex items-start justify-between gap-4">
                    <p className="font-display text-3xl leading-none font-black uppercase">{b.zona ?? "Box"}</p>
                    <span className="eyebrow tnum shrink-0 border border-acento-dim px-2.5 py-1.5 text-acento-text">
                      {b.cuantos} {b.cuantos === 1 ? "box" : "boxes"}
                    </span>
                  </div>
                  <p className="relative text-sm text-ink-soft">Hasta {b.plazas} personas</p>
                  <p className="tnum relative mt-4 font-display text-4xl font-black text-acento-text">
                    {soles(b.consumoMinimoCentimos)}
                  </p>
                  <p className="eyebrow relative text-muted">consumo mínimo</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* El box se pide para una noche concreta: el formulario vive en su ficha. */}
              {proxima && (
                <Link
                  to={`/evento/${proxima.slug}#reservados`}
                  className="glow-acento eyebrow bg-acento px-6 py-4 text-on-acento transition hover:brightness-110"
                >
                  Pedir box para {proxima.titulo}
                </Link>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="eyebrow border border-line px-5 py-3 text-ink-soft transition hover:border-acento hover:text-acento-text"
                >
                  Consultar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* El local: cuánta gente cabe y cómo está repartida. Datos de la base. */}
      {x && x.salas.length > 0 && (
        <section id="local" className="mx-auto max-w-6xl px-5 py-20">
          <Encabezado rotulo="El espacio" titulo="El local" />
          <ElLocal salas={x.salas} />
        </section>
      )}

      {/* Los artistas son el producto. */}
      {x && x.artistas.length > 0 && (
        <section id="artistas" className="mx-auto max-w-6xl px-5 py-20">
          <Encabezado rotulo={`Cartel ${new Date().getFullYear()}`} titulo="Artistas" />
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {x.artistas.map((a, i) => (
              <div
                key={a.nombre}
                style={{ animationDelay: `${i * 70}ms` }}
                className="surgir group flex flex-col gap-1 bg-ground p-6 transition duration-300 hover:bg-surface"
              >
                <span className="eyebrow text-acento-text">{a.genero}</span>
                <p className="font-display text-3xl font-black uppercase transition group-hover:text-acento-text">
                  {a.nombre}
                </p>
                {a.instagram && <span className="eyebrow text-muted">@{a.instagram}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <Marquesina textos={["Cusqueña", "Pisco", "Reguetón", "Techno", "Salsa", "Cumbia"]} invertida />

      {/* Lo que ya pasó. Un local con historia se nota. */}
      {x && x.pasadas.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Encabezado
            rotulo="Noches pasadas"
            titulo="Galería"
            accion={instagram ? `@${instagram}` : undefined}
            href={instagram ? `https://instagram.com/${instagram}` : undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {x.pasadas.map((n, i) => (
              <div
                key={n.slug}
                style={{ animationDelay: `${i * 70}ms` }}
                className="surgir group relative flex aspect-square flex-col justify-end overflow-hidden border border-line p-4"
              >
                {n.portada ? (
                  <img
                    src={imagen(n.portada)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div aria-hidden className="rayado absolute inset-0" />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, transparent 30%, rgb(8 8 8 / 0.9) 100%)" }}
                />
                <p className="eyebrow relative text-muted">
                  {horaDeSala(n.empiezaA, { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="relative font-display text-xl leading-tight font-black uppercase">{n.titulo}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* En acordeón: son cinco respuestas largas, y desplegadas no las lee nadie. */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Encabezado rotulo="Info práctica" titulo="Antes de venir" />
        <Acordeon
          apartados={[
            {
              titulo: "Edad y documento",
              texto: `Solo mayores de ${CLUB.minAge}. Se pide DNI, carné de extranjería o pasaporte en la puerta, sin excepciones. Una foto del documento en el móvil no vale.`,
            },
            {
              titulo: "Cómo funciona tu QR",
              texto:
                "Al confirmar la compra recibes un código QR. Lo enseñas desde el móvil en la puerta, no hace falta imprimirlo. Cada QR entra una vez: si lo reenvías, el segundo en llegar se queda fuera.",
            },
            { titulo: "Horario", texto: CLUB.hours },
            { titulo: "Vestimenta", texto: CLUB.vestimenta },
            { titulo: "Devoluciones", texto: CLUB.reembolso },
          ]}
        />
      </section>

      {/* La razón para volver cuando hoy no se compra. */}
      <div className="border-y border-line bg-surface">
        <Boletin />
      </div>

      {/* Cómo llegar: tres datos distintos para tres maneras de venir. */}
      <section id="llegar" className="mx-auto max-w-6xl px-5 py-20">
        <Encabezado rotulo="Ubicación" titulo="Cómo llegar" />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { rotulo: "Dirección", texto: CLUB.address },
            { rotulo: "Referencia", texto: CLUB.reference },
            { rotulo: "Estacionamiento", texto: CLUB.parking },
            { rotulo: "Transporte", texto: CLUB.transport },
          ].map((d) => (
            <div key={d.rotulo}>
              <p className="eyebrow mb-2 text-acento-text">{d.rotulo}</p>
              <p className="text-ink-soft">{d.texto}</p>
            </div>
          ))}
        </div>

        {/* Con `loading="lazy"`: es un marco de terceros al final de la página. */}
        {mapa && (
          <div className="mt-10 border border-line bg-raised">
            <iframe
              src={mapa}
              title={`Mapa de ${CLUB.name} en ${CLUB.address}`}
              className="block h-[380px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}

        {CLUB.mapsUrl && (
          <a
            href={CLUB.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="eyebrow mt-4 inline-flex items-center gap-2 border border-line px-5 py-3 text-ink-soft transition hover:border-acento hover:text-acento-text"
          >
            Cómo llegar en Google Maps <span aria-hidden>→</span>
          </a>
        )}
      </section>

      {/* Solo si hay algo que comprar: una barra de compra sin noche no compra nada. */}
      {proxima && (
        <BarraMovil
          href={`/evento/${proxima.slug}`}
          titulo={proxima.titulo}
          precio={`Desde ${soles(proxima.precioDesdeCentimos)}`}
        />
      )}
    </div>
  );
}
