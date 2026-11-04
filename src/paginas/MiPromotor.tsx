import { useState } from "react";
import { toast } from "sonner";
import { Login } from "../Login";
import {
  ErrorDeApi,
  abrirMiLista,
  apuntarEnMiLista,
  horaDeSala,
  quitarDeMiLista,
  verMiLista,
  verMiPanelDePromotor,
  type MiPanelDePromotor,
} from "../api";
import { useCarga } from "../datos";
import { useSesion } from "../sesion";
import { CifrasDePromotor, EnlaceDeVenta, TablaDeLiquidaciones, TablaDeNochesDePromotor } from "./PromotorDetalle";
import "../App.css";
import "./expediente.css";

/**
 * La pantalla del propio promotor, en `/promotor`.
 *
 * Va fuera del panel por lo mismo que la puerta y la barra: un promotor no ve
 * clientes, ni caja, ni nada de la casa. Aquí ve lo suyo —lo que ha vendido, lo
 * que se le debe y lo que ya cobró— y gestiona sus listas. Es la misma ficha
 * que ve la sala, así que no hay discusión posible sobre las cifras.
 *
 * Lo que no puede: marcar quién entró. Eso lo hace la puerta; si lo hiciera él,
 * se estaría apuntando su propio pago por cabeza.
 */
export function MiPromotor() {
  const { estado, entrar, salir } = useSesion();

  if (estado.fase === "comprobando") return <p className="aviso">Comprobando la sesión…</p>;
  if (estado.fase === "error") return <p className="aviso aviso--error">{estado.mensaje}</p>;
  if (estado.fase === "fuera") {
    return (
      <div className="mi-promotor">
        <Login alEntrar={entrar} />
      </div>
    );
  }

  return (
    <div className="mi-promotor">
      <header className="cabecera">
        <div>
          <h2>Hola, {estado.usuario.nombre.split(" ")[0]}</h2>
          <p className="sutil">Tu panel de promotor</p>
        </div>
        <div className="cabecera__acciones">
          <button type="button" className="boton-fantasma" onClick={() => void salir()}>
            Salir
          </button>
        </div>
      </header>
      <Contenido />
    </div>
  );
}

function Contenido() {
  const [version, setVersion] = useState(0);
  const carga = useCarga(verMiPanelDePromotor, [version]);
  const [abierta, setAbierta] = useState<string | null>(null);

  if (carga.fase === "cargando") return <p className="aviso">Cargando lo tuyo…</p>;
  if (carga.fase === "error") {
    return (
      <p className="aviso aviso--error">
        {carga.estadoHttp === 403
          ? "Tu cuenta no tiene código de promotor. Pídeselo a la dirección del local."
          : carga.mensaje}
      </p>
    );
  }

  const { ficha, noches } = carga.datos;
  const recargar = () => setVersion((v) => v + 1);
  const proximas = ficha.promotor.listas.filter((l) => !l.pasada);

  return (
    <>
      <p className="sutil">
        Ganas el {ficha.promotor.comisionPorcentaje} % del precio de cada entrada vendida con tu código
        {ficha.promotor.bonoPorInvitadoCentimos > 0 &&
          ` y ${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
            ficha.promotor.bonoPorInvitadoCentimos / 100,
          )} por cada persona de tus listas que entra`}
        . Lo de cada noche se te debe cuando la noche ya pasó.
      </p>
      <EnlaceDeVenta codigo={ficha.promotor.codigo} />
      <CifrasDePromotor f={ficha} />

      <div className="apartado">
        <div className="apartado__cabecera">
          <h3 className="subtitulo">Tus listas para las próximas noches</h3>
        </div>
        <NuevaLista noches={noches} alAbrir={(id) => { setAbierta(id); recargar(); }} />
        {proximas.length === 0 ? (
          <p className="sutil">No tienes listas abiertas para las próximas noches.</p>
        ) : (
          <ul className="avisos">
            {proximas.map((l) => (
              <li key={l.id} className="aviso-noche--neutro">
                <button type="button" className="enlace" onClick={() => setAbierta(abierta === l.id ? null : l.id)}>
                  <strong>{l.nombre}</strong>
                </button>
                <span className="sutil">
                  {" "}
                  · {l.noche}, {horaDeSala(l.empiezaA, { dateStyle: "medium" })} · {l.apuntados}/{l.maxInvitados} personas
                </span>
              </li>
            ))}
          </ul>
        )}
        {abierta && <MiLista id={abierta} alCambiar={recargar} />}
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Noche a noche</h3>
        <TablaDeNochesDePromotor noches={ficha.noches} enlazar={false} />
      </div>

      <div className="apartado">
        <h3 className="subtitulo">Lo que ya cobraste</h3>
        <TablaDeLiquidaciones liquidaciones={ficha.liquidaciones} />
      </div>
    </>
  );
}

function NuevaLista({ noches, alAbrir }: { noches: MiPanelDePromotor["noches"]; alAbrir: (id: string) => void }) {
  const [slug, setSlug] = useState("");
  const [nombre, setNombre] = useState("");
  const [maximo, setMaximo] = useState("20");
  const [abriendo, setAbriendo] = useState(false);

  if (noches.length === 0) return <p className="sutil">No hay noches a la venta donde abrir una lista.</p>;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAbriendo(true);
    try {
      const l = await abrirMiLista({ slug: slug || noches[0].slug, nombre: nombre.trim(), maxInvitados: Number(maximo) });
      toast.success(`Lista «${l.nombre}» abierta`);
      setNombre("");
      alAbrir(l.id);
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo abrir la lista.");
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      <div className="tipo-form__campos">
        <label>
          Noche
          <select value={slug || noches[0].slug} onChange={(e) => setSlug(e.target.value)}>
            {noches.map((n) => (
              <option key={n.slug} value={n.slug}>
                {horaDeSala(n.empiezaA, { dateStyle: "medium" })} · {n.titulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nombre de la lista
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={80} placeholder="Cumple de Ana" />
        </label>
        <label>
          Tope de personas
          <input type="number" min={1} max={150} value={maximo} onChange={(e) => setMaximo(e.target.value)} required />
        </label>
      </div>
      <div className="tipo-form__acciones">
        <button type="submit" disabled={abriendo}>
          {abriendo ? "Abriendo…" : "Abrir lista"}
        </button>
      </div>
    </form>
  );
}

function MiLista({ id, alCambiar }: { id: string; alCambiar: () => void }) {
  const [version, setVersion] = useState(0);
  const carga = useCarga(() => verMiLista(id), [id, version]);
  const [nombre, setNombre] = useState("");
  const [personas, setPersonas] = useState("1");

  if (carga.fase === "cargando") return <p className="aviso">Cargando la lista…</p>;
  if (carga.fase === "error") return <p className="aviso aviso--error">{carga.mensaje}</p>;
  const l = carga.datos;

  const cambiar = () => {
    setVersion((v) => v + 1);
    alCambiar();
  };

  async function apuntar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apuntarEnMiLista(id, nombre.trim(), Number(personas));
      setNombre("");
      setPersonas("1");
      cambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo apuntar.");
    }
  }

  async function quitar(invitadoId: string) {
    try {
      await quitarDeMiLista(invitadoId);
      cambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo quitar.");
    }
  }

  return (
    <div className="apartado">
      <h3 className="subtitulo">
        {l.nombre} <span className="sutil">· {l.noche} · {l.apuntados}/{l.maxInvitados}</span>
      </h3>
      <form className="tipo-form" onSubmit={(e) => void apuntar(e)}>
        <div className="tipo-form__campos">
          <label>
            Nombre y apellido
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} />
          </label>
          <label>
            Personas
            <input type="number" min={1} max={20} value={personas} onChange={(e) => setPersonas(e.target.value)} />
          </label>
        </div>
        <div className="tipo-form__acciones">
          <button type="submit" disabled={!nombre.trim()}>
            Apuntar
          </button>
        </div>
      </form>
      {l.invitados.length === 0 ? (
        <p className="sutil">La lista está vacía.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <tbody>
              {l.invitados.map((i) => (
                <tr key={i.id}>
                  <td>{i.nombreCompleto}</td>
                  <td className="num">{i.personas > 1 ? `+${i.personas - 1}` : ""}</td>
                  <td className="acciones">
                    {i.entro ? (
                      <span className="estado estado--publicado">Entró</span>
                    ) : (
                      <button type="button" className="boton-fantasma boton--peligro" onClick={() => void quitar(i.id)}>
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
