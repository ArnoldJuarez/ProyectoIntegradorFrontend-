import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

/**
 * La barra de compra que sigue al visitante en el móvil.
 *
 * En un móvil, el botón de comprar de la portada desaparece en cuanto se baja un
 * dedo, y a partir de ahí el visitante recorre ocho secciones sin una sola forma
 * de comprar a mano. Esta barra arregla eso: aparece justo cuando la portada
 * sale de pantalla y ya no se va.
 *
 * Solo en móvil. En escritorio la cabecera pegajosa ya lleva el botón de comprar
 * siempre visible, y una segunda barra abajo sería decir lo mismo dos veces.
 */
export function BarraMovil({
  href,
  titulo,
  precio,
}: {
  href: string;
  titulo: string;
  precio: string | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const portada = document.querySelector("main section");
    if (!portada) return;

    /*
     * `IntersectionObserver` y no un escuchador de scroll: el evento de scroll
     * dispara decenas de veces por segundo y obliga a medir posiciones a mano,
     * lo que en un móvil modesto se nota. Esto lo resuelve el navegador y solo
     * avisa cuando la portada entra o sale.
     */
    const observador = new IntersectionObserver(([entrada]) => setVisible(!entrada.isIntersecting), {
      threshold: 0,
    });
    observador.observe(portada);
    return () => observador.disconnect();
  }, []);

  /*
   * Avisa al resto de la página de que hay una barra abajo, para que el botón
   * flotante del chat se aparte y no se pisen. Va en el `body` porque los dos
   * son hermanos lejanos y no comparten padre.
   */
  useEffect(() => {
    document.body.dataset.barraMovil = visible ? "1" : "0";
    return () => {
      delete document.body.dataset.barraMovil;
    };
  }, [visible]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-acento-dim bg-ground/95 backdrop-blur-xl transition duration-300 sm:hidden ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      // Fuera de pantalla no debe existir para el teclado ni para el lector de
      // pantalla: si no, se tabula a un botón invisible.
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate text-muted">{titulo}</p>
          {precio && <p className="tnum font-display text-xl font-black leading-tight">{precio}</p>}
        </div>
        <Link
          to={href}
          tabIndex={visible ? undefined : -1}
          className="eyebrow shrink-0 bg-acento px-6 py-3.5 text-on-acento transition hover:brightness-110"
        >
          Comprar
        </Link>
      </div>
    </div>
  );
}
