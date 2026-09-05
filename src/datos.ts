import { useEffect, useState } from "react";
import { ErrorDeApi } from "./api";

/**
 * Carga de datos de una pantalla.
 *
 * Sale de repetir el mismo `useEffect` con su bandera de vigencia y su
 * `catch` en cada página. No es una librería de caché ni pretende serlo: es el
 * patrón que ya se estaba copiando, escrito una sola vez.
 */

export type Carga<T> =
  | { fase: "cargando" }
  | { fase: "listo"; datos: T }
  | { fase: "error"; mensaje: string; estadoHttp: number };

/**
 * @param pedir la petición a lanzar
 * @param dependencias cuándo hay que volver a lanzarla (p. ej. el slug de la URL)
 */
export function useCarga<T>(pedir: () => Promise<T>, dependencias: unknown[] = []): Carga<T> {
  const [carga, setCarga] = useState<Carga<T>>({ fase: "cargando" });

  useEffect(() => {
    // Si la pantalla cambia a mitad de la petición, no se toca el estado: la
    // respuesta que llega tarde pintaría los datos de la pantalla anterior.
    let vigente = true;
    setCarga({ fase: "cargando" });

    pedir()
      .then((datos) => {
        if (vigente) setCarga({ fase: "listo", datos });
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        const esDeApi = e instanceof ErrorDeApi;
        setCarga({
          fase: "error",
          mensaje: esDeApi ? e.message : "Ocurrió un error inesperado.",
          estadoHttp: esDeApi ? e.estado : -1,
        });
      });

    return () => {
      vigente = false;
    };
    // La función `pedir` se redefine en cada render, así que no puede ir en las
    // dependencias: quien llama declara de qué depende de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return carga;
}
