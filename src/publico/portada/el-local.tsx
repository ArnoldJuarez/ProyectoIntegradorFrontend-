import { useState } from "react";
import { CLUB } from "../../config";

export type Sala = {
  nombre: string;
  aforo: number;
  descripcion: string | null;
  zonas: { nombre: string; aforo: number }[];
};

/**
 * «El local», con una pestaña por sala.
 *
 * Las salas, los aforos y las zonas salen de la base de datos, no de un archivo
 * de textos: son los mismos números que usan el plano, la simulación de
 * evacuación y el aforo de la puerta. Si mañana la terraza pasa de 300 a 250 en
 * el panel, esta sección lo dice sola.
 *
 * Pestañas de verdad y no `<a href="#">`: `role="tab"` hace que el lector de
 * pantalla anuncie «pestaña 2 de 2, seleccionada», que es la diferencia entre
 * una lista de enlaces y un conmutador.
 */
export function ElLocal({ salas }: { salas: Sala[] }) {
  const [activa, setActiva] = useState(0);
  const sala = salas[activa];

  if (!sala) return null;

  return (
    <div>
      {/*
       * Con una sola sala no hay nada que conmutar: una pestaña suelta es un
       * botón que no lleva a ninguna parte, y al lector de pantalla le anuncia
       * «pestaña 1 de 1», que es ruido. El local tiene una sala; el día que
       * tenga dos, las pestañas vuelven solas.
       */}
      <div
        role="tablist"
        aria-label="Salas del local"
        hidden={salas.length < 2}
        className="mb-8 flex flex-wrap gap-px"
      >
        {salas.map((s, i) => (
          <button
            key={s.nombre}
            role="tab"
            type="button"
            aria-selected={i === activa}
            onClick={() => setActiva(i)}
            className={`eyebrow px-5 py-3 transition ${
 i === activa
                ? "bg-acento text-on-acento"
                : "bg-raised text-muted hover:text-ink"
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="grid gap-10 border-t border-line pt-8 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-2 text-muted">Aforo</p>
          {/*
           * El aforo va a tamaño de titular. En una discoteca no es un dato
           * administrativo: es la respuesta a «¿voy a estar apretado?».
           */}
          <p className="tnum font-display text-6xl font-black leading-none">{sala.aforo}</p>
          <p className="eyebrow mt-2 text-muted">personas</p>

          {sala.descripcion && <p className="mt-6 max-w-md text-ink-soft">{sala.descripcion}</p>}

        </div>

        <div>
          {sala.zonas.length > 0 && (
            <>
              <p className="eyebrow mb-4 text-acento-text">Zonas</p>
              <ul className="flex flex-col">
                {sala.zonas.map((zona) => (
                  <li
                    key={zona.nombre}
                    className="flex items-baseline justify-between gap-4 border-b border-line py-2.5"
                  >
                    <span className="font-display text-xl font-black uppercase">{zona.nombre}</span>
                    {/* Aforo 0 = la zona no se controla por separado; no se inventa un número. */}
                    {zona.aforo > 0 && (
                      <span className="tnum eyebrow text-muted">{zona.aforo} personas</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {CLUB.barra && (
            <>
              <p className="eyebrow mb-3 mt-8 text-acento-text">En barra</p>
              <p className="font-display text-2xl font-black uppercase">{CLUB.barra}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
