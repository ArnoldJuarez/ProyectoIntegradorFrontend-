import { Suspense, lazy, useMemo } from "react";
import { Link } from "react-router-dom";
import { verPlanoPublico } from "../api";
import { CLUB } from "../config";
import { useCarga } from "../datos";
import { simularHastaElFinal, formatearSegundos } from "../local/simulador/motor";
import { construirRejilla } from "../local/simulador/rejilla";
import { SimuladorDeEvacuacion } from "../local/simulador/SimuladorDeEvacuacion";
import { Encabezado } from "./portada/seccion";
import { Revelar } from "./portada/revelar";

/**
 * Seguridad: el plan de evacuación del local, abierto a cualquiera.
 *
 * Lo mismo que está colgado junto a la puerta, pero consultable antes de venir
 * y desde el móvil: dónde están las salidas, por dónde se sale desde cada sitio,
 * las zonas seguras en caso de sismo y el punto de reunión. Con el plano
 * interactivo se toca «estoy aquí» y se ve la ruta; con la simulación, cómo se
 * vacía el local lleno.
 *
 * Los datos son los mismos que maneja la sala en el panel: si se mueve una
 * salida allí, cambia aquí.
 */

const Escena3D = lazy(() => import("../local/escena-3d").then((m) => ({ default: m.Escena3D })));

const TELEFONOS = [
  { numero: "116", quien: "Bomberos" },
  { numero: "105", quien: "Policía Nacional" },
  { numero: "106", quien: "SAMU · ambulancia" },
  { numero: "115", quien: "Defensa Civil" },
];

const QUE_HACER: { titulo: string; icono: string; pasos: string[] }[] = [
  {
    titulo: "Si tiembla",
    icono: "〰",
    pasos: [
      "Mantén la calma y aléjate de vidrios, espejos y lo que pueda caer.",
      "Ve a la zona segura señalizada más cercana (cartel verde «Zona segura en caso de sismo»).",
      "No corras hacia la salida ni uses la escalera mientras dura el movimiento.",
      "Cuando pare, sal siguiendo las rutas verdes hasta el punto de reunión.",
    ],
  },
  {
    titulo: "Si hay fuego o humo",
    icono: "▲",
    pasos: [
      "Avisa al personal o pulsa una alarma (caja roja en la pared).",
      "Sal por la salida más cercana que no tenga humo; si la hay, busca otra.",
      "Con humo, agáchate y cúbrete nariz y boca con la ropa.",
      "No vuelvas a entrar a por nada.",
    ],
  },
  {
    titulo: "Durante la evacuación",
    icono: "→",
    pasos: [
      "Sigue las flechas verdes y las indicaciones del personal de sala.",
      "Camina rápido sin correr y sin empujar; no te pares en las puertas.",
      "Desde la planta alta, baja por la escalera de emergencia más cercana.",
      "Ayuda a quien lo necesite si puedes hacerlo sin riesgo.",
    ],
  },
  {
    titulo: "En el punto de reunión",
    icono: "◎",
    pasos: [
      "Espera allí, fuera de la calzada, hasta que el personal indique.",
      "Comprueba que están todos tus acompañantes y avisa si falta alguien.",
      "No regreses al local hasta que lo autoricen.",
    ],
  },
];

export function Seguridad() {
  const carga = useCarga(verPlanoPublico, []);
  const sala = carga.fase === "listo" ? carga.datos[0] : undefined;

  const plano = useMemo(
    () =>
      sala
        ? { ancho: sala.planoAncho, fondo: sala.planoFondo, zonas: sala.zonas, puertas: sala.puertas, elementos: sala.elementos }
        : null,
    [sala],
  );

  // La cifra de la cabecera: cuánto tarda en vaciarse el local lleno.
  const lleno = useMemo(() => {
    if (!plano || !sala) return null;
    const r = construirRejilla(plano.ancho, plano.fondo, plano.zonas, plano.puertas);
    const s = simularHastaElFinal(r, { personas: sala.aforo, semilla: "publico" });
    return { tiempo: s.tiempoTotal ?? 0, salidas: r.salidas.length };
  }, [plano, sala]);

  const cuenta = (tipo: string) => sala?.elementos.filter((e) => e.tipo === tipo).length ?? 0;

  return (
    <div className="tw min-w-0 overflow-x-hidden bg-ground text-ink">
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="reticula absolute inset-0 opacity-50" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 70% at 15% 0%, rgb(62 230 160 / 0.16), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pt-28 pb-16 sm:pt-36">
          <p className="eyebrow surgir flex w-fit items-center gap-2.5 rounded-full border border-white/15 px-3.5 py-2 text-[#3ee6a0]">
            <span className="latir inline-block size-2 rounded-full bg-[#3ee6a0]" />
            Plan de evacuación
          </p>
          <h1 className="surgir mt-6 max-w-3xl text-[clamp(2.4rem,6.5vw,4.6rem)]" style={{ animationDelay: "80ms" }}>
            Disfruta tranquilo: sabemos por dónde salir.
          </h1>
          <p className="surgir mt-5 max-w-2xl text-lg text-ink-soft" style={{ animationDelay: "160ms" }}>
            Antes de venir, mira dónde están las salidas, las zonas seguras en caso de sismo y el punto de reunión. Toca
            el plano donde vayas a estar y te enseñamos tu ruta.
          </p>

          <div className="surgir mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "240ms" }}>
            {[
              { cifra: lleno ? String(lleno.salidas) : "—", texto: "salidas de evacuación" },
              { cifra: lleno ? formatearSegundos(lleno.tiempo) : "—", texto: `para vaciar el local lleno (${sala?.aforo ?? "…"} personas)` },
              { cifra: String(cuenta("ZONA_SEGURA")), texto: "zonas seguras en sismo" },
              { cifra: String(cuenta("EXTINTOR")), texto: "extintores repartidos" },
            ].map((c) => (
              <div key={c.texto} className="rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur">
                <p className="tnum font-display text-3xl font-bold text-[#3ee6a0]">{c.cifra}</p>
                <p className="mt-1 text-sm text-ink-soft">{c.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {carga.fase === "error" && (
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="aviso aviso--error">No se pudo cargar el plano del local. {carga.mensaje}</p>
        </div>
      )}

      <section id="plano" className="mx-auto max-w-6xl px-5 py-16">
        <Encabezado rotulo="Plano interactivo" titulo="¿Por dónde salgo?" />
        <Revelar>
          <p className="mb-6 max-w-2xl text-ink-soft">
            Toca el plano donde vayas a estar: la línea rosa es tu ruta hasta la salida. Las verdes son las rutas de cada
            zona. Con «Simular la evacuación» ves cómo sale la gente con el local lleno; también puedes colocar un
            incendio y ver cómo se reorganiza.
          </p>
          {plano && sala ? (
            <div className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
              <SimuladorDeEvacuacion plano={plano} aforo={sala.aforo} modo="publico" />
            </div>
          ) : carga.fase === "cargando" ? (
            <p className="text-muted">Cargando el plano…</p>
          ) : null}
        </Revelar>
      </section>

      {plano && sala && (
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <Encabezado rotulo="En 3D" titulo="Las rutas, dentro del local" />
            <Revelar>
              <p className="mb-6 max-w-2xl text-ink-soft">
                Las mismas rutas y elementos de seguridad, en el local en tres dimensiones. Pulsa «Evacuar» para verlo en
                movimiento.
              </p>
              <div className="h-[34rem] sm:h-[40rem]">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center rounded-2xl border border-line">
                      <p className="text-sm text-muted">Cargando la vista 3D…</p>
                    </div>
                  }
                >
                  <Escena3D
                    datos={{
                      nombre: sala.nombre,
                      planoAncho: sala.planoAncho,
                      planoFondo: sala.planoFondo,
                      zonas: sala.zonas,
                      puertas: sala.puertas,
                      elementos: sala.elementos,
                      aforo: sala.aforo,
                    }}
                    conEvacuacion
                  />
                </Suspense>
              </div>
            </Revelar>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 py-16">
        <Encabezado rotulo="Qué hacer" titulo="En caso de emergencia" />
        <div className="grid gap-4 sm:grid-cols-2">
          {QUE_HACER.map((b, i) => (
            <Revelar key={b.titulo} retraso={i * 80}>
              <article className="h-full rounded-2xl border border-line bg-surface p-6">
                <p className="mb-3 flex items-center gap-3">
                  <span aria-hidden className="grid size-9 place-items-center rounded-full bg-[#3ee6a0]/15 font-display text-[#3ee6a0]">
                    {b.icono}
                  </span>
                  <span className="font-display text-xl font-bold">{b.titulo}</span>
                </p>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-ink-soft">
                  {b.pasos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </article>
            </Revelar>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-[1fr_1.4fr]">
          <Revelar>
            <h2 className="text-3xl">Teléfonos de emergencia</h2>
            <p className="mt-3 text-ink-soft">
              Gratuitos desde cualquier teléfono en el Perú. Y en el local, el personal de sala está formado para actuar:
              búscalo con la camiseta del equipo.
            </p>
          </Revelar>
          <div className="grid grid-cols-2 gap-3">
            {TELEFONOS.map((t, i) => (
              <Revelar key={t.numero} retraso={i * 60}>
                <a
                  href={`tel:${t.numero}`}
                  className="pulsable flex flex-col rounded-2xl border border-line bg-ground p-5 transition-colors duration-150 hover:border-[#3ee6a0]/60"
                >
                  <span className="tnum font-display text-4xl font-bold">{t.numero}</span>
                  <span className="text-sm text-ink-soft">{t.quien}</span>
                </a>
              </Revelar>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-14">
          <p className="text-sm text-muted">
            {CLUB.name} · {CLUB.address}. El plan se revisa con cada cambio del local y con los simulacros periódicos. ¿Ves
            algo que no cuadra? Díselo al personal o escríbenos. <Link to="/" className="underline">Volver a la portada</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
