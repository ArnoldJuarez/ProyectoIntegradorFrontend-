import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Aparece al entrar en pantalla: sube 24 px y se funde, una sola vez.
 *
 * Solo para la web pública (marketing): en el panel, que se usa a diario, esto
 * sería una interfaz peleándose con quien la lee. Se dispara una vez y no se
 * repite al volver a pasar por delante.
 *
 * Con «reducir movimiento» no sube: solo se funde (ver `.revelar` en
 * publico.css). Y si el navegador no tiene IntersectionObserver, se enseña sin
 * más: el contenido nunca se queda escondido por culpa de la animación.
 *
 * @param retraso milisegundos, para escalonar una fila de tarjetas (30–80 ms entre una y otra)
 */
export function Revelar({ children, retraso = 0, className = "" }: { children: ReactNode; retraso?: number; className?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [visto, setVisto] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisto(true);
      return;
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisto(true);
          observador.disconnect();
        }
      },
      // Un poco antes de que entre del todo: se ve aparecer, no llegar tarde.
      { rootMargin: "0px 0px -80px 0px", threshold: 0.08 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={caja}
      className={`revelar ${className}`}
      data-visible={visto ? "" : undefined}
      style={retraso ? { transitionDelay: `${retraso}ms` } : undefined}
    >
      {children}
    </div>
  );
}
