/**
 * La barra de «cuánto de esto va lleno».
 *
 * Existe porque el número solo no se lee: «312» no dice nada, «312 de 500» hay
 * que dividirlo mentalmente, y la barra se entiende de un vistazo desde el otro
 * lado de la mesa. Es la pieza que más se repite entre la portada y la torre, y
 * la razón de que sea un componente y no CSS copiado dos veces.
 */
export function Medidor({
  valor,
  maximo,
  tono = "acento",
}: {
  valor: number;
  /** Si llega a cero la barra sale vacía, no se divide por cero. */
  maximo: number;
  /** `alerta` para cuando estar lleno es un problema, como el aforo. */
  tono?: "acento" | "alerta";
}) {
  // Se recorta al 100 %: con un aforo mal configurado el porcentaje puede pasar
  // de cien, y una barra que se sale de su caja parece un fallo de pintado en
  // vez de un dato raro.
  const porcentaje = maximo <= 0 ? 0 : Math.min(100, Math.round((valor / maximo) * 100));

  return (
    <div
      className="medidor"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={maximo}
    >
      <div
        className={tono === "alerta" ? "medidor__relleno medidor__relleno--alerta" : "medidor__relleno"}
        style={{ transform: `scaleX(${porcentaje / 100})` }}
      />
    </div>
  );
}

/**
 * El marco de un apartado de estas dos pantallas.
 *
 * Las dos son rejillas de bloques con título, y el borde con la cabecera se
 * repetía en cada uno.
 */
export function Bloque({
  titulo,
  pista,
  ancho = false,
  children,
}: {
  titulo: string;
  /** Aclaración corta al lado del título: «tramos de 15 min», «por debajo del mínimo». */
  pista?: string;
  /** Ocupa toda la rejilla en vez de una columna. */
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={ancho ? "bloque bloque--ancho" : "bloque"}>
      <header className="bloque__cabecera">
        <h3 className="bloque__titulo">{titulo}</h3>
        {pista && <span className="bloque__pista">{pista}</span>}
      </header>
      {children}
    </section>
  );
}

/** Lo que se enseña cuando un bloque no tiene nada que enseñar. */
export function BloqueVacio({ children }: { children: React.ReactNode }) {
  return <p className="bloque__vacio">{children}</p>;
}
