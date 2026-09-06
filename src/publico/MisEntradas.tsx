import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  horaDeSala,
  pagarPedido,
  soles,
  verMisEntradas,
  type EntradaConQr,
  type MisEntradas as Pedido,
} from "../api";
import { useCarga } from "../datos";

/**
 * «Tus entradas»: la página que se queda quien compra.
 *
 * <p>Es la única pantalla pública que enseña códigos completos de entrada, y no
 * pide cuenta: quien compró no tiene ninguna, lo único que tiene es este enlace.
 * El código del pedido hace de llave, y por eso el backend no manda aquí ni su
 * correo ni su teléfono — quien acierte un código ajeno no se lleva los datos de
 * nadie.
 *
 * <p>Tiene dos estados en una sola página, a propósito: sin pagar enseña el
 * total y el botón; pagada enseña los QR. Separarlas en dos rutas obligaría a
 * quien vuelve al enlace a adivinar cuál abrir.
 */
export function MisEntradas() {
  const { codigo = "" } = useParams();
  const carga = useCarga(() => verMisEntradas(codigo), [codigo]);

  // Después de pagar no se recarga la página: la respuesta del pago trae ya lo
  // necesario para volver a pedir el pedido, y se guarda aquí.
  const [recienPagado, setRecienPagado] = useState<Pedido | null>(null);

  if (carga.fase === "cargando") return <p className="aviso">Buscando tu pedido…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="tu pedido" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const pedido = recienPagado ?? carga.datos;

  return (
    <div className="publico">
      <section className="seccion seccion--estrecha">
        <p className="migas">
          Pedido <span className="tnum">{pedido.codigo}</span>
        </p>
        <h1 className="entradas__titulo">{pedido.pagado ? "Tus entradas" : "Tu pedido"}</h1>
        <p className="entradas__noche">
          {pedido.noche} · {pedido.sala} · puertas{" "}
          {horaDeSala(pedido.puertasA, { dateStyle: "long", timeStyle: "short" })}
        </p>

        {pedido.pagado ? (
          <Qrs entradas={pedido.entradas} />
        ) : (
          <SinPagar pedido={pedido} alPagar={setRecienPagado} />
        )}

        <p className="migas">
          <Link to={`/evento/${pedido.slug}`} className="enlace">
            ← Volver a la noche
          </Link>
        </p>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

/** El paso de pagar. El cobro es simulado: no hay pasarela conectada. */
function SinPagar({
  pedido,
  alPagar,
}: {
  pedido: Pedido;
  alPagar: (p: Pedido) => void;
}) {
  const [pagando, setPagando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function pagar() {
    if (pagando) return;
    setPagando(true);
    setFallo(null);

    try {
      await pagarPedido(pedido.codigo);
      // Se vuelve a pedir el pedido en vez de construirlo aquí: las entradas y
      // sus códigos los emite el servidor, y este es el único sitio de donde
      // pueden salir.
      alPagar(await verMisEntradas(pedido.codigo));
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo confirmar el pago.");
      setPagando(false);
    }
  }

  return (
    <div className="pagar">
      <p className="pagar__total">
        <span>A pagar</span>
        <strong>{soles(pedido.totalCentimos)}</strong>
      </p>

      {fallo && <p className="aviso aviso--error">{fallo}</p>}

      <button type="button" className="comprar__boton" onClick={() => void pagar()} disabled={pagando}>
        {pagando ? "Confirmando…" : "Pagar ahora"}
      </button>

      {/*
        Dicho sin rodeos y en la propia pantalla. Una demo que parece cobrar de
        verdad es la clase de cosa que alguien enseña sin saber que no cobra.
      */}
      <p className="pagar__aviso">
        El cobro está <strong>simulado</strong>: no hay pasarela conectada y no se cobra nada.
        Al confirmar se emiten las entradas igual que lo harían tras un pago real.
      </p>
    </div>
  );
}

/** Las entradas con su QR, una tarjeta por entrada. */
function Qrs({ entradas }: { entradas: EntradaConQr[] }) {
  if (entradas.length === 0) {
    return <p className="aviso">Este pedido no tiene entradas emitidas.</p>;
  }

  return (
    <>
      <p className="entradas__aviso">
        Enseña cada QR en la puerta desde el móvil. Se escanea una sola vez, así que no
        compartas la captura con nadie.
      </p>

      <ul className="qrs">
        {entradas.map((e) => (
          <li key={e.codigo} className={e.yaSeUso ? "qr qr--usada" : "qr"}>
            <Codigo valor={e.codigo} />
            <div className="qr__datos">
              <p className="qr__tipo">{e.tipoDeEntrada}</p>
              {e.titular && <p className="qr__titular">{e.titular}</p>}
              {e.consumicionesIncluidas > 0 && (
                <p className="qr__extra">
                  {e.consumicionesIncluidas}{" "}
                  {e.consumicionesIncluidas === 1 ? "consumición" : "consumiciones"}
                </p>
              )}
              {e.yaSeUso && <p className="qr__usada">Ya utilizada</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * El dibujo del QR.
 *
 * <p>Se genera en el navegador y no lo manda el servidor: lo que viaja es el
 * texto del código, que son sesenta caracteres, en vez de una imagen. El
 * servidor no tiene que saber nada de códigos de barras.
 *
 * <p>El fondo es blanco fijo y no un color del tema. No es un descuido: un
 * lector necesita el contraste máximo y un margen en blanco alrededor, y sobre
 * el fondo oscuro de esta web un QR en gris no se lee.
 */
function Codigo({ valor }: { valor: string }) {
  const [imagen, setImagen] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    QRCode.toDataURL(valor, {
      margin: 2,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (vigente) setImagen(url);
      })
      .catch(() => {
        // Si el dibujo falla, el código en texto sigue sirviendo: en la puerta
        // se puede teclear. Es peor no enseñar nada.
        if (vigente) setImagen(null);
      });

    return () => {
      vigente = false;
    };
  }, [valor]);

  return (
    <div className="qr__imagen">
      {imagen ? (
        <img src={imagen} alt="Código QR de la entrada" width={160} height={160} />
      ) : (
        <code className="qr__texto">{valor}</code>
      )}
    </div>
  );
}
