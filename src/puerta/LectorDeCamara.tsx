import jsQR from "jsqr";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Leer el QR de la entrada con la cámara del móvil o de la tablet.
 *
 * Convive con el lector de pistola, no lo sustituye: en una puerta con cola el
 * aparato dedicado es más rápido, pero no todas las puertas lo tienen, y un
 * portero con el móvil de la casa tiene que poder trabajar igual.
 *
 * ## Cómo se decodifica
 *
 * Primero con `BarcodeDetector`, el lector nativo del navegador (Chrome de
 * Android, Safari reciente): es rápido y no gasta batería. Donde no existe
 * —Chrome de escritorio en Windows, Firefox— se cae a `jsQR`, que lee los
 * píxeles de un fotograma. Cualquiera de los dos da el mismo texto: el código
 * firmado de la entrada, el mismo que se teclearía.
 *
 * ## La misma entrada dos veces
 *
 * La cámara ve el QR en treinta fotogramas por segundo. Sin un freno, una sola
 * entrada se mandaría al servidor varias veces y la segunda saldría como
 * «repetida» delante del cliente que acaba de pasar. Por eso el mismo código no
 * se vuelve a mandar en unos segundos, y entre lectura y lectura hay una pausa.
 *
 * ## Por qué a veces no arranca
 *
 * El navegador solo da la cámara en un sitio seguro: `https://` o `localhost`.
 * Si la tablet abre el panel por la IP de la red (`http://192.168…`), la cámara
 * no está disponible y aquí se dice así, en vez de quedarse en negro.
 */

/** Cada cuánto se mira un fotograma. Más seguido no lee más rápido y calienta el móvil. */
const CADA_MS = 180;
/** Tras una lectura, cuánto se espera antes de leer la siguiente. */
const PAUSA_MS = 1500;
/** Cuánto tiempo no se vuelve a mandar el mismo código. */
const MISMO_CODIGO_MS = 6000;

type Detector = { detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]> };

function detectorNativo(): Detector | null {
  const Clase = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (!Clase) return null;
  try {
    return new Clase({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function motivoDeFallo(e: unknown): string {
  const nombre = e instanceof DOMException ? e.name : "";
  if (!window.isSecureContext) {
    return "La cámara solo funciona en https:// o en localhost. Abre el panel con una dirección segura o usa el lector.";
  }
  if (nombre === "NotAllowedError") return "No se dio permiso para usar la cámara. Actívalo en el candado de la barra de direcciones.";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "Este dispositivo no tiene cámara disponible.";
  if (nombre === "NotReadableError") return "Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.";
  return "No se pudo abrir la cámara.";
}

export function LectorDeCamara({ alLeer, ocupado }: { alLeer: (codigo: string) => void; ocupado: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [destello, setDestello] = useState(false);

  // Las refs evitan reiniciar la cámara cada vez que cambian: abrirla cuesta
  // un segundo y pide permiso en algunos navegadores.
  const alLeerRef = useRef(alLeer);
  const ocupadoRef = useRef(ocupado);
  useLayoutEffect(() => {
    alLeerRef.current = alLeer;
    ocupadoRef.current = ocupado;
  });

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let reloj = 0;
    let vigente = true;
    let pausaHasta = 0;
    const vistos = new Map<string, number>();
    const nativo = detectorNativo();

    async function arrancar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFallo(motivoDeFallo(null));
        return;
      }
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          // La de atrás: es la que se apunta al móvil del cliente.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        if (vigente) setFallo(motivoDeFallo(e));
        return;
      }
      if (!vigente || !video.current) {
        flujo.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = flujo;
      await video.current.play().catch(() => undefined);
      setListo(true);
      reloj = window.setInterval(() => void mirar(), CADA_MS);
    }

    async function mirar() {
      const v = video.current;
      const c = lienzo.current;
      if (!v || !c || v.readyState < 2 || ocupadoRef.current || Date.now() < pausaHasta) return;

      let texto: string | null = null;
      try {
        if (nativo) {
          const hallados = await nativo.detect(v);
          texto = hallados[0]?.rawValue ?? null;
        } else {
          // Se lee el centro del encuadre a resolución reducida: es donde se
          // pone el QR y es cuatro veces menos trabajo que el fotograma entero.
          const lado = Math.min(v.videoWidth, v.videoHeight);
          const escala = Math.min(1, 640 / lado);
          c.width = Math.round(lado * escala);
          c.height = Math.round(lado * escala);
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, (v.videoWidth - lado) / 2, (v.videoHeight - lado) / 2, lado, lado, 0, 0, c.width, c.height);
          const imagen = ctx.getImageData(0, 0, c.width, c.height);
          texto = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
      } catch {
        return;
      }

      const codigo = texto?.trim();
      if (!codigo) return;
      const ahora = Date.now();
      if ((vistos.get(codigo) ?? 0) > ahora) return;

      vistos.set(codigo, ahora + MISMO_CODIGO_MS);
      pausaHasta = ahora + PAUSA_MS;
      setDestello(true);
      window.setTimeout(() => setDestello(false), 350);
      navigator.vibrate?.(60);
      alLeerRef.current(codigo);
    }

    void arrancar();

    return () => {
      vigente = false;
      window.clearInterval(reloj);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (fallo) return <p className="puerta__aviso puerta__aviso--mal">{fallo}</p>;

  return (
    <div className={`camara ${destello ? "camara--leido" : ""}`}>
      <video ref={video} className="camara__video" muted playsInline aria-label="Imagen de la cámara" />
      <canvas ref={lienzo} hidden />
      <div className="camara__marco" aria-hidden="true" />
      <p className="camara__pista">{listo ? "Apunta al QR de la entrada" : "Abriendo la cámara…"}</p>
    </div>
  );
}
