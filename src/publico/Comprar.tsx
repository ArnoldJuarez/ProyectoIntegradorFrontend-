import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ErrorDeApi,
  comprarEntradas,
  promoRecordada,
  soles,
  type EntradaALaVenta,
} from "../api";

/**
 * El selector de entradas y el formulario de compra.
 *
 * <p>Vive aparte de la ficha de la noche porque tiene estado propio —cuántas de
 * cada tipo, los datos de quien compra, si se está enviando— y meterlo dentro
 * obligaría a la ficha entera a volver a pintarse cada vez que alguien toca un
 * «+».
 */
export function Comprar({ slug, entradas }: { slug: string; entradas: EntradaALaVenta[] }) {
  const navegar = useNavigate();

  /** Cuántas de cada tipo, por id. Solo lo que se ha elegido. */
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  /*
   * El total que se enseña aquí es solo informativo: el que vale es el que
   * calcula el servidor al crear el pedido. Se repite el cálculo para que la
   * persona vea lo que va a pagar antes de dar sus datos, no porque este número
   * mande.
   */
  const { unidades, subtotal } = useMemo(() => {
    let unidades = 0;
    let subtotal = 0;
    for (const e of entradas) {
      const cuantas = cantidades[e.id] ?? 0;
      unidades += cuantas;
      subtotal += cuantas * e.precioCentimos;
    }
    return { unidades, subtotal };
  }, [cantidades, entradas]);

  /** La misma comisión que aplica el servidor. Si cambia allí, cambia aquí. */
  const comision = Math.round(subtotal * 0.05);

  function cambiar(entrada: EntradaALaVenta, delta: number) {
    setCantidades((previas) => {
      const ahora = (previas[entrada.id] ?? 0) + delta;
      // El tope es el menor de los dos: lo que queda y lo que se permite por
      // pedido. El servidor lo vuelve a comprobar, esto solo evita el viaje.
      const tope = Math.min(entrada.disponibles, entrada.maximoPorPedido);
      const ajustada = Math.max(0, Math.min(ahora, tope));

      const siguientes = { ...previas };
      if (ajustada === 0) {
        delete siguientes[entrada.id];
      } else {
        siguientes[entrada.id] = ajustada;
      }
      return siguientes;
    });
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando || unidades === 0) return;

    setEnviando(true);
    setFallo(null);

    try {
      const resguardo = await comprarEntradas({
        slug,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        lineas: Object.entries(cantidades).map(([tipoDeEntradaId, cantidad]) => ({
          tipoDeEntradaId,
          cantidad,
        })),
        // Si llegó por el enlace de un promotor, la venta le cuenta a él.
        promo: promoRecordada(),
      });

      // A la página de sus entradas: allí se paga y allí quedan los QR. El
      // código va en la URL, así que el enlace se puede guardar o reenviar.
      navegar(`/entradas/${resguardo.codigo}`);
    } catch (e) {
      // Un 409 es «se agotaron mientras rellenabas»: el mensaje del backend
      // está escrito para leerse, así que se enseña tal cual.
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo crear el pedido.");
      setEnviando(false);
    }
  }

  const aLaVenta = entradas.filter((e) => e.disponibles > 0);

  if (aLaVenta.length === 0) {
    return <p className="aviso">No quedan entradas a la venta para esta noche.</p>;
  }

  return (
    <form className="comprar" onSubmit={(e) => void enviar(e)}>
      <ul className="comprar__tipos">
        {aLaVenta.map((e) => {
          const cuantas = cantidades[e.id] ?? 0;
          const tope = Math.min(e.disponibles, e.maximoPorPedido);

          return (
            <li key={e.id} className="comprar__tipo">
              <div className="comprar__que">
                <p className="comprar__nombre">{e.nombre}</p>
                <p className="comprar__precio">
                  {soles(e.precioCentimos)}
                  {e.consumicionesIncluidas > 0 &&
                    ` · ${e.consumicionesIncluidas} ${
                      e.consumicionesIncluidas === 1 ? "consumición" : "consumiciones"
                    }`}
                </p>
              </div>

              <div className="contador-compra">
                <button
                  type="button"
                  onClick={() => cambiar(e, -1)}
                  disabled={cuantas === 0}
                  aria-label={`Quitar una entrada ${e.nombre}`}
                >
                  −
                </button>
                <span className="contador-compra__cifra">{cuantas}</span>
                <button
                  type="button"
                  onClick={() => cambiar(e, 1)}
                  disabled={cuantas >= tope}
                  aria-label={`Añadir una entrada ${e.nombre}`}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Los datos y el total solo aparecen cuando hay algo que comprar: un
          formulario vacío encima de un carrito vacío es ruido. */}
      {unidades > 0 && (
        <>
          <div className="comprar__cuenta">
            <p>
              <span>
                {unidades} {unidades === 1 ? "entrada" : "entradas"}
              </span>
              <strong>{soles(subtotal)}</strong>
            </p>
            <p>
              <span>Gestión</span>
              <strong>{soles(comision)}</strong>
            </p>
            <p className="comprar__total">
              <span>Total</span>
              <strong>{soles(subtotal + comision)}</strong>
            </p>
          </div>

          <div className="comprar__datos">
            <label>
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={80}
                autoComplete="given-name"
              />
            </label>
            <label>
              Apellido
              <input
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                maxLength={80}
                autoComplete="family-name"
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={160}
                autoComplete="email"
              />
            </label>
            <label>
              Teléfono
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={30}
                autoComplete="tel"
              />
            </label>
          </div>

          {fallo && <p className="aviso aviso--error">{fallo}</p>}

          <button type="submit" className="comprar__boton" disabled={enviando}>
            {enviando ? "Reservando…" : `Comprar · ${soles(subtotal + comision)}`}
          </button>

          <p className="comprar__letra">
            El nombre que pongas es el que va impreso en las entradas. Te llevamos a una
            página con tus QR, guárdala.
          </p>
        </>
      )}
    </form>
  );
}
