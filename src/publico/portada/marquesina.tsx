/**
 * Marquesina: el cartel de la fachada desfilando.
 *
 * Es lo que más "enciende" la página por menos código. Una discoteca real tiene
 * una tira luminosa con el nombre y la fecha repitiéndose; esto es lo mismo.
 *
 * El truco de la implementación: el contenido se pinta DOS veces y la animación
 * desplaza exactamente la mitad. Cuando termina, la segunda copia está donde
 * estaba la primera, así que el bucle es invisible. Con una sola copia se ve el
 * salto en cada vuelta.
 *
 * `aria-hidden` porque es decoración: un lector de pantalla no debe leer el
 * mismo texto ocho veces.
 */
export function Marquesina({
  textos,
  invertida = false,
}: {
  textos: string[];
  invertida?: boolean;
}) {
  const tira = [...textos, ...textos];

  return (
    <div
      aria-hidden
      className={`relative flex overflow-hidden border-y border-line py-2.5 ${
 invertida ? "bg-acento text-on-acento" : "bg-ground text-ink-soft"
      }`}
    >
      <div
        className="marquesina flex shrink-0 gap-8 whitespace-nowrap pr-8"
        style={invertida ? { animationDirection: "reverse", animationDuration: "26s" } : undefined}
      >
        {tira.map((texto, i) => (
          <span key={i} className="eyebrow flex items-center gap-8">
            {texto}
            <span className={invertida ? "text-on-acento/50" : "text-acento-text"}>✳</span>
          </span>
        ))}
      </div>
    </div>
  );
}
