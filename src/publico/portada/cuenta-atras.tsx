import { useEffect, useState } from "react";
import { cuantoFalta } from "./cuenta-atras-calculo";

/**
 * Cuánto falta para la noche.
 *
 * Sustituye al «4 % vendido» cuando la venta va floja, y no es un truco: con
 * pocas entradas vendidas, el aforo juega EN CONTRA —dice que no va nadie—
 * mientras que el reloj corre igual para todos. Una noche al 4 % a la que le
 * quedan dos días sigue teniendo una razón para comprar hoy.
 *
 * ── El texto inicial llega como PROPIEDAD, y esto importa ──
 *
 * La primera versión lo calculaba en el propio componente, y rompía la
 * hidratación de la página ENTERA. El motivo: el texto cambia cada minuto, así
 * que el servidor pintaba «faltan 23 h 59 min» y el navegador, unos segundos más
 * tarde, calculaba «faltan 23 h 58 min». React encontraba dos árboles distintos,
 * abandonaba la hidratación y con ella se caían los efectos de toda la página
 * —incluida la barra de compra del móvil, que dejó de aparecer.
 *
 * Recibiéndolo hecho, el primer pintado del navegador es idéntico al del
 * servidor por construcción. El reloj solo entra después, ya montado.
 */
export function CuentaAtras({ fecha, inicial }: { fecha: string; inicial: string }) {
  const [texto, setTexto] = useState(inicial);

  useEffect(() => {
    const actualizar = () => setTexto(cuantoFalta(new Date(fecha)));
    // Una vez al montar, para recuperar los segundos perdidos entre el servidor
    // y esta pestaña, y a partir de ahí cada minuto.
    actualizar();
    const id = setInterval(actualizar, 60_000);
    return () => clearInterval(id);
  }, [fecha]);

  /*
   * Un contador de segundos en una web de discoteca parece una cuenta atrás de
   * lanzamiento de cohete, y obliga al navegador a repintar sesenta veces más
   * para decir lo mismo. Cada minuto basta.
   */
  return <span suppressHydrationWarning>{texto}</span>;
}
