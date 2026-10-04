import { useState } from "react";
import { AvisoDeError } from "../Aviso";
import { verLocal } from "../api";
import { useCarga } from "../datos";
import { EditorLocal } from "../local/editor-local";

/**
 * Plano del local, vista 3D y simulación de evacuación.
 *
 * Una zona con aforo y medidas, y una puerta con posición y caudal, son lo que
 * hace falta para responder la pregunta que Defensa Civil hace por escrito:
 * *¿en cuánto tiempo se vacía este local?*
 */
export function Local() {
  // Tras guardar se vuelve a pedir el local: el editor arranca de lo guardado y
  // el aviso de «cambios sin guardar» se apaga solo.
  const [version, setVersion] = useState(0);
  const carga = useCarga(verLocal, [version]);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el local…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="el local" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  return (
    <section>
      <header className="cabecera">
        <h2>El local</h2>
        <span className="contador">Planta, zonas y salidas de cada sala</span>
      </header>
      <p className="descripcion">
        Los cambios se ven al instante en el plano y en 3D; se guardan cuando pulsas el botón.
      </p>
      <div className="tw">
        <EditorLocal key={version} salas={carga.datos} alGuardar={() => setVersion((v) => v + 1)} />
      </div>
    </section>
  );
}
