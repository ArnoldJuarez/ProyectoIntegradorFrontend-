import { Link } from "react-router-dom";

/**
 * Encabezado de sección: rótulo pequeño arriba, titular grande debajo.
 *
 * El patrón viene del diseño y no es decorativo: el rótulo dice de qué CATEGORÍA
 * es la sección («Agenda», «Mesas VIP») y el titular dice qué te ofrece
 * («Próximas noches», «Reserva tu mesa»). Quien baja rápido con el pulgar lee
 * solo los titulares, y quien busca algo concreto rastrea los rótulos, que al ir
 * en mono y espaciados se distinguen del cuerpo sin leerlos.
 *
 * La regla de abajo es la misma que ya usaba la página: concreto encofrado, todo
 * separado por líneas rectas.
 */
export function Encabezado({
  rotulo,
  titulo,
  accion,
  href,
}: {
  rotulo: string;
  titulo: string;
  accion?: string;
  href?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-acento-text">{rotulo}</span>
        <h2 className="text-3xl sm:text-4xl">{titulo}</h2>
      </div>

      {accion && href && (
        // Fuera del sitio (Instagram) va con <a>; dentro, con el router.
        /^https?:/.test(href) ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="eyebrow shrink-0 pb-1 text-acento-text transition hover:brightness-125"
          >
            {accion} →
          </a>
        ) : (
          <Link
            to={href}
            className="eyebrow shrink-0 pb-1 text-acento-text transition hover:brightness-125"
          >
            {accion} →
          </Link>
        )
      )}
    </div>
  );
}
