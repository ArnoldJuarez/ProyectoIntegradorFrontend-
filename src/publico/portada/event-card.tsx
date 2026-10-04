import { Link } from "react-router-dom";
import { horaDeSala, imagen, soles, type NocheEnCartelera } from "../../api";

/**
 * A partir de este porcentaje vendido la tarjeta avisa de que quedan pocas.
 *
 * La API pública da el porcentaje y no las entradas que quedan —cuántas se han
 * vendido es dato interno—, así que el aviso va por porcentaje.
 */
const UMBRAL_ULTIMAS = 85;

/**
 * Inclinación del rayado de una noche sin foto.
 *
 * Sale del slug, así que cada noche tiene la suya y siempre la misma: dos
 * tarjetas sin foto juntas no parecen la misma tarjeta repetida.
 */
function anguloDeEvento(slug: string): number {
  const suma = [...slug].reduce((total, letra) => total + letra.charCodeAt(0), 0);
  return 100 + (suma % 80);
}

/** La tarjeta de una noche en la agenda: fecha, título, géneros, aforo y precio. */
export function EventCard({ noche, indice = 0 }: { noche: NocheEnCartelera; indice?: number }) {
  const agotada = noche.estado === "AGOTADO";
  const vendido = noche.porcentajeVendido;
  const ultimas = !agotada && vendido >= UMBRAL_ULTIMAS;
  const angulo = anguloDeEvento(noche.slug);
  const generos = [...new Set(noche.cartel.map((a) => a.genero).filter(Boolean))];
  const fecha = horaDeSala(noche.empiezaA, { weekday: "long", day: "numeric", month: "long" });

  return (
    <Link
      to={`/evento/${noche.slug}`}
      style={{ animationDelay: `${indice * 80}ms` }}
      className="pulsable surgir group relative flex aspect-4/5 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 text-ink no-underline transition-[transform,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-acento-dim focus-visible:-translate-y-1"
      aria-label={`${noche.titulo}, ${fecha}`}
    >
      {/* La foto de la noche si la hay; si no, rayado de concreto. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={
          noche.portada
            ? undefined
            : { backgroundImage: `repeating-linear-gradient(${angulo}deg, #141414 0 14px, #0c0c0c 14px 28px)` }
        }
      >
        {noche.portada && (
          <img
            src={imagen(noche.portada)}
            alt=""
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            loading="lazy"
          />
        )}
      </div>

      {/* Degradado que garantiza que el título se lea sobre cualquier fondo. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgb(8 8 8 / 0.3) 0%, rgb(8 8 8 / 0.94) 70%)" }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <span className="eyebrow text-acento-text">{fecha}</span>

        {agotada ? (
          <span className="eyebrow shrink-0 rounded-full border border-line-strong bg-ground/80 px-2.5 py-1 text-muted backdrop-blur">
            Agotado
          </span>
        ) : ultimas ? (
          <span className="eyebrow glow-alarma shrink-0 rounded-full bg-alarma px-2.5 py-1 font-semibold text-on-alarma">
            Últimas
          </span>
        ) : (
          <span className="eyebrow shrink-0 text-ink-soft">
            {horaDeSala(noche.puertasA, { timeStyle: "short" })}
          </span>
        )}
      </div>

      <div className="relative flex flex-col gap-2">
        <h3 className="text-2xl transition-colors duration-150 group-hover:text-acento-text">{noche.titulo}</h3>

        <p className="eyebrow line-clamp-1 text-muted">
          {generos.join(" · ") || noche.cartel.map((a) => a.nombre).join(" · ") || "Cartel por confirmar"}
        </p>

        <div aria-hidden className="h-1 overflow-hidden rounded-full bg-white/12">
          <div
            className="subir h-full"
            style={{
              width: `${vendido}%`,
              background: agotada
                ? "var(--color-line-strong)"
                : ultimas
                  ? "var(--color-alarma)"
                  : "var(--color-acento)",
            }}
          />
        </div>

        <div className="flex items-baseline justify-between gap-2">
          {agotada ? (
            <span className="eyebrow text-ink-soft">Lista de espera</span>
          ) : (
            <span className={`eyebrow tnum ${ultimas ? "text-alarma" : "text-ink-soft"}`}>
              {vendido}% vendido
            </span>
          )}
          {!agotada && (
            <span className="tnum font-display text-xl font-bold whitespace-nowrap text-ink">
              {soles(noche.precioDesdeCentimos)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
