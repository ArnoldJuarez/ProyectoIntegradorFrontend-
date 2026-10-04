import { useEffect, useState } from "react";
import { imagen } from "../../api";

/**
 * El fondo de la portada, en cascada: vídeo → foto → haces de luz.
 *
 * Tres fuentes y no una porque las tres van a existir en momentos distintos de
 * la vida del sitio. Hoy no hay ni vídeo ni fotos, y la portada tiene que verse
 * viva igual; mañana habrá un vídeo del local y debe entrar sin tocar la página.
 *
 * ── Por qué el vídeo no es incondicional ──
 *
 * Un vídeo de portada es la mejor foto que se puede poner y a la vez la peor
 * decisión posible para quien lo mira. Dos casos donde NO se sirve:
 *
 * - `prefers-reduced-motion`: hay gente a la que el movimiento a pantalla
 *   completa le provoca mareo. No es una preferencia estética.
 * - `saveData` o red lenta: alguien mirando la fecha desde la calle con datos
 *   no debería pagar tres megas para leer «sábado 22».
 *
 * En los dos casos se cae al póster, que es un fotograma del propio vídeo: la
 * portada se ve igual, simplemente quieta.
 *
 * Y el vídeo arranca en el cliente a propósito. El servidor no sabe nada de la
 * red ni de las preferencias de movimiento de quien pide la página, así que
 * decidir allí sería adivinar.
 */
export function PortadaMedia({
  video,
  portada,
  foto,
}: {
  video?: string;
  /** Imagen fija del sitio: póster del vídeo y fondo por defecto de la portada. */
  portada?: string;
  /** Foto de esta noche concreta, si la tiene. */
  foto?: string | null;
}) {
  const [conMovimiento, setConMovimiento] = useState(false);

  useEffect(() => {
    const quietud = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // `connection` no existe en Safari ni en Firefox: si no está, no se asume nada.
    const red = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    const ahorro = red?.saveData === true || /(^|-)2g$/.test(red?.effectiveType ?? "");
    setConMovimiento(!quietud && !ahorro);
  }, []);

  /*
   * La foto de la noche manda sobre la del sitio.
   *
   * Si el local ha subido una imagen para ESE sábado, esa es la que cuenta de qué
   * va esa noche; la del sitio es el fondo genérico para cuando no hay ninguna.
   */
  const fija = foto ? imagen(foto) : portada;

  if (video && conMovimiento) {
    return (
      <Capa>
        <video
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={portada || undefined}
          // `metadata` y no `auto`: el vídeo empieza a bajar cuando hace falta,
          // no compitiendo con las fuentes y el HTML por el ancho de banda.
          preload="metadata"
        />
        <Velo />
      </Capa>
    );
  }

  if (fija) {
    return (
      <Capa>
        {/*
         * `object-position` arriba y no al centro: en una foto de sala lo que
         * cuenta —los focos, el techo, el humo— está en la parte de arriba, y es
         * justo lo que un recorte centrado se come en una pantalla apaisada.
         */}
        <img
          src={fija}
          alt=""
          className="acercar h-full w-full object-cover"
          style={{ objectPosition: "center 25%" }}
        />
        <Velo />
      </Capa>
    );
  }

  return <Haces />;
}

function Capa({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {children}
    </div>
  );
}

/**
 * El velo que hace legible el texto.
 *
 * Sin él la portada es una lotería: el título se lee o no según lo que salga en
 * ese fotograma. Con el degradado a negro por abajo —donde vive el texto— se lee
 * siempre, y arriba deja ver la imagen.
 *
 * Va fijo en negro y no en tokens: encima hay una foto de un local a oscuras,
 * que no cambia porque el visitante prefiera el tema claro.
 */
function Velo() {
  return (
    <div
      className="absolute inset-0"
      style={{
        /*
         * Fuerte abajo, casi transparente arriba.
         *
         * El texto vive en la mitad de abajo, así que ahí el velo tiene que
         * tapar de verdad; arriba, donde solo hay luces y humo, se retira para
         * que la foto conserve su color. Un velo parejo protege igual pero
         * apaga la imagen entera, y entonces daba lo mismo ponerla en gris.
         */
        background: [
          /*
           * Velo lateral: la columna izquierda es donde vive el titular, y en una
           * foto de discoteca ahí puede caer un foco. Sin esto, que el título se
           * lea depende de la foto que toque — y con un vídeo, del fotograma.
           * Protege solo esa banda; la derecha se queda con todo su color.
           */
          "radial-gradient(60% 70% at 90% 0%, rgb(163 116 255 / 0.35), transparent 60%)",
          "radial-gradient(55% 60% at 0% 100%, rgb(255 61 154 / 0.38), transparent 60%)",
          "linear-gradient(90deg, rgb(11 7 16 / 0.85) 0%, rgb(11 7 16 / 0.45) 45%, transparent 78%)",
          /* Y el vertical, que sostiene los datos y el botón de abajo. */
          "linear-gradient(180deg, rgb(11 7 16 / 0.35) 0%, rgb(11 7 16 / 0.1) 32%, rgb(11 7 16 / 0.72) 74%, rgb(11 7 16) 100%)",
        ].join(", "),
      }}
    />
  );
}

/**
 * Haces de luz: la portada cuando no hay ni vídeo ni foto.
 *
 * Son tres focos barriendo desde el techo, como la cabina apuntando a la pista.
 * Cada uno con su ángulo, su duración y su retardo, y los tres en números primos
 * de segundos: así el ciclo conjunto tarda minutos en repetirse y nunca se ve el
 * patrón. Chartreuse los dos de fuera, magenta el del centro — los dos colores
 * de la identidad, sin inventar ninguno.
 */
function Haces() {
  const haces = [
    { desde: "-22deg", hasta: "14deg", izquierda: "18%", color: "rgb(255 61 154 / 0.55)", dur: "11s", retardo: "0s" },
    { desde: "16deg", hasta: "-12deg", izquierda: "52%", color: "rgb(163 116 255 / 0.45)", dur: "13s", retardo: "-3s" },
    { desde: "-8deg", hasta: "24deg", izquierda: "80%", color: "rgb(255 61 154 / 0.4)", dur: "17s", retardo: "-7s" },
  ];

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {haces.map((haz, i) => (
        <span
          key={i}
          className="haz"
          style={
            {
              left: haz.izquierda,
              "--haz-desde": haz.desde,
              "--haz-hasta": haz.hasta,
              "--haz-color": haz.color,
              animationDuration: haz.dur,
              animationDelay: haz.retardo,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
