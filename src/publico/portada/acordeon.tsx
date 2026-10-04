/**
 * El acordeón de «antes de venir».
 *
 * Está hecho con `<details>` y `<summary>` del navegador, sin una línea de
 * JavaScript. No es purismo: es que este bloque responde las preguntas que
 * bloquean una compra —si te van a dejar entrar con ese DNI, si el QR sirve
 * desde el móvil— y tiene que funcionar aunque el JavaScript falle, tarde o
 * venga bloqueado. Además el navegador ya trae gratis el teclado, el foco y el
 * anuncio de «contraído/expandido» al lector de pantalla, que es justo lo que
 * suele salir mal en los acordeones hechos a mano.
 *
 * El signo `+` es un `<span>` y no el marcador nativo porque el triángulo de
 * serie no se puede pintar igual en todos los navegadores.
 */
export function Acordeon({ apartados }: { apartados: { titulo: string; texto: string }[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {apartados.map((apartado) => (
        <details key={apartado.titulo} className="group border-b border-line last:border-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-4 transition-colors duration-150 hover:text-acento-text [&::-webkit-details-marker]:hidden">
            <span className="text-base font-semibold sm:text-lg">
              {apartado.titulo}
            </span>
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-lg leading-none text-acento-text transition-transform duration-200 ease-out group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="max-w-2xl px-5 pb-5 text-ink-soft">{apartado.texto}</p>
        </details>
      ))}
    </div>
  );
}
