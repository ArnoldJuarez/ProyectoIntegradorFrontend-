/**
 * Los tipos del plano del local: zonas, puertas y elementos de seguridad, y el
 * color de cada zona.
 *
 * La simulación de evacuación ya no está aquí: vive en `simulador/`, con una
 * rejilla que rodea paredes y baja por la escalera, gente que camina a la
 * velocidad que le deja la densidad y colas en cada puerta. Sustituyó al cálculo
 * en línea recta que había antes, que ignoraba los muros.
 */

/** Espejo del enum `TipoZona` de la base. */
export type TipoZona = "PISTA" | "VIP" | "BARRA" | "OTRA";

export type ZonaPlano = {
  id: string;
  nombre: string;
  tipo: TipoZona;
  aforo: number;
  x: number;
  y: number;
  ancho: number;
  fondo: number;
  alto: number;
  tono: number;
  /** 0 la planta baja, 1 la alta. */
  piso: number;
};

export type PuertaPlano = {
  id: string;
  nombre: string;
  esSalidaEmergencia: boolean;
  caudalPorMinuto: number;
  activo: boolean;
  x: number;
  y: number;
  ancho: number;
  /** Las de la planta alta son escaleras de emergencia. */
  piso: number;
};

/** Qué es un elemento de seguridad del plano. Espejo de `TipoDeElemento`. */
export type TipoDeElemento = "EXTINTOR" | "BOTIQUIN" | "LUZ_EMERGENCIA" | "ALARMA" | "ZONA_SEGURA" | "PUNTO_REUNION";

export type ElementoPlano = {
  /** Vacío en uno recién añadido que todavía no se ha guardado. */
  id: string;
  tipo: TipoDeElemento;
  nombre: string;
  piso: number;
  x: number;
  y: number;
};

export const NOMBRE_DE_ELEMENTO: Record<TipoDeElemento, string> = {
  EXTINTOR: "Extintor",
  BOTIQUIN: "Botiquín",
  LUZ_EMERGENCIA: "Luz de emergencia",
  ALARMA: "Pulsador de alarma",
  ZONA_SEGURA: "Zona segura en sismo",
  PUNTO_REUNION: "Punto de reunión",
};

/**
 * Color estable de una zona: el declarado, o el que le toca por tipo.
 *
 * El de respaldo salía antes de sumar los códigos de las letras del nombre. Era
 * estable, sí, pero arbitrario: la pista podía salir azul y la barra violeta, y
 * corregir una tilde en el nombre cambiaba el color de la zona. Ahora el
 * respaldo dice algo — cada tipo de zona tiene el suyo — y solo se cae al hash
 * en las zonas sin tipo, donde de verdad no hay nada mejor que inventar.
 */
const TONO_POR_TIPO: Record<TipoZona, number | null> = {
  PISTA: 320, // magenta: es donde está la gente
  VIP: 250, // violeta
  BARRA: 40, // ámbar, como la luz de una barra
  OTRA: null,
};

export function tonoDeZona(zona: { nombre: string; tipo: TipoZona; tono: number }): number {
  if (zona.tono >= 0) return zona.tono;
  const porTipo = TONO_POR_TIPO[zona.tipo];
  if (porTipo !== null) return porTipo;
  const suma = [...zona.nombre].reduce((total, letra) => total + letra.charCodeAt(0), 0);
  return 200 + (suma % 160); // 200–360: azul, violeta, magenta
}
