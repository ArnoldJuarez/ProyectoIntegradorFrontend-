/**
 * Cuánto falta para una fecha, en texto.
 *
 * Vive en un módulo neutral —sin `"use client"`— porque lo necesitan los dos
 * lados: el servidor para pintar el primer texto y el navegador para irlo
 * actualizando. Si estuviera dentro del componente cliente, el servidor no
 * recibiría la función sino una referencia, que es el mismo tropiezo que ya
 * documenta `lib/tema.ts`.
 */
export function cuantoFalta(fecha: Date, ahora: Date = new Date()): string {
  const minutos = Math.round((fecha.getTime() - ahora.getTime()) / 60_000);

  if (minutos <= 0) return "Está pasando ahora";
  if (minutos < 60) return `Empieza en ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto === 0 ? `Faltan ${horas} h` : `Faltan ${horas} h ${resto} min`;
  }

  const dias = Math.floor(horas / 24);
  const restoHoras = horas % 24;
  if (dias === 1) return restoHoras === 0 ? "Falta 1 día" : `Falta 1 día y ${restoHoras} h`;
  return restoHoras === 0 ? `Faltan ${dias} días` : `Faltan ${dias} días y ${restoHoras} h`;
}
