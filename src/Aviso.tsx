/**
 * El aviso de que algo no se pudo cargar.
 *
 * Traduce el código HTTP a algo accionable, que es la diferencia entre "error
 * 403" y saber qué hacer a continuación. Estaba repetido en cada pantalla.
 */
export function AvisoDeError({
  que,
  mensaje,
  estadoHttp,
}: {
  /** Qué se estaba cargando: "el inventario", "las noches"… */
  que: string;
  mensaje: string;
  estadoHttp: number;
}) {
  // Cuando sabemos qué significa el código, el mensaje del backend sobra: para
  // un 403 dice «Forbidden», que encima de una explicación en condiciones solo
  // añade ruido en inglés.
  if (estadoHttp === 403) {
    return (
      <div className="aviso aviso--error">
        <p className="aviso__titulo">Esta sección no es para tu cuenta</p>
        <p>
          El panel es de dirección y jefatura de sala. Un portero, por ejemplo, entra al sistema
          pero no aquí.
        </p>
      </div>
    );
  }

  if (estadoHttp === 404) {
    return (
      <div className="aviso aviso--error">
        <p className="aviso__titulo">No existe</p>
        <p>Puede que la dirección esté mal escrita o que se haya borrado.</p>
      </div>
    );
  }

  return (
    <div className="aviso aviso--error">
      <p className="aviso__titulo">No se pudo cargar {que}</p>
      <p>{mensaje}</p>
      {estadoHttp === 0 && (
        <p className="aviso__pista">
          Comprueba que el backend está arrancado: <code>cd backend</code> y{" "}
          <code>./mvnw spring-boot:run</code>
        </p>
      )}
    </div>
  );
}
