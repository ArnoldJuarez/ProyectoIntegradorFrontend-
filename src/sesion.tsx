import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { quienSoy, salir as salirDeLaApi, type Sesion } from "./api";

/**
 * Quién está dentro, disponible en toda la aplicación.
 *
 * Existe como contexto y no como estado de `App` porque ahora hay varias
 * pantallas y todas necesitan saberlo: el encabezado para enseñar el nombre, y
 * cada página para no pedir datos que no le van a dar.
 */

type Estado =
  | { fase: "comprobando" }
  | { fase: "fuera" }
  | { fase: "dentro"; usuario: Sesion }
  | { fase: "error"; mensaje: string };

type Contexto = {
  estado: Estado;
  entrar: (usuario: Sesion) => void;
  salir: () => Promise<void>;
};

const ContextoDeSesion = createContext<Contexto | null>(null);

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  /*
   * Al arrancar no se sabe si hay sesión: la cookie es httpOnly y este código
   * no puede leerla. Hay que preguntárselo al backend.
   *
   * De ahí la fase "comprobando": sin ella se vería el formulario de login un
   * instante en cada recarga, aun teniendo la sesión abierta.
   */
  const [estado, setEstado] = useState<Estado>({ fase: "comprobando" });

  useEffect(() => {
    let vigente = true;

    quienSoy()
      .then((usuario) => {
        if (!vigente) return;
        setEstado(usuario ? { fase: "dentro", usuario } : { fase: "fuera" });
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado({
          fase: "error",
          mensaje: e instanceof Error ? e.message : "Error inesperado.",
        });
      });

    return () => {
      vigente = false;
    };
  }, []);

  async function salir() {
    // Aunque la petición falle, la sesión se da por cerrada en la interfaz:
    // dejar a alguien "dentro" porque el backend no contestó es peor que
    // pedirle que vuelva a entrar.
    await salirDeLaApi().catch(() => {});
    setEstado({ fase: "fuera" });
  }

  return (
    <ContextoDeSesion.Provider
      value={{ estado, entrar: (usuario) => setEstado({ fase: "dentro", usuario }), salir }}
    >
      {children}
    </ContextoDeSesion.Provider>
  );
}

export function useSesion(): Contexto {
  const contexto = useContext(ContextoDeSesion);
  if (!contexto) {
    throw new Error("useSesion tiene que usarse dentro de <ProveedorDeSesion>");
  }
  return contexto;
}
