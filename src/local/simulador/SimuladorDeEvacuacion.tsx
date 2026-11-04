import { useEffect, useMemo, useRef, useState } from "react";
import { NOMBRE_DE_ELEMENTO, type TipoDeElemento } from "../evacuacion";
import { MapaDeEvacuacion, type Plano } from "./MapaDeEvacuacion";
import { Simulacion, formatearSegundos, simularHastaElFinal, type Incendio } from "./motor";
import { RECORRIDO_MAXIMO, resumenDe, revisar, type Comprobacion } from "./normativa";
import { calcularCampo, construirRejilla, rutaDesde, rutasDeZonas } from "./rejilla";
import { nombreDePlanta } from "./geometria";
import "./simulador.css";

/**
 * El simulador de evacuación: el mapa, los controles y los resultados.
 *
 * Lo usan dos pantallas con dos públicos:
 *
 * - **Panel** (`modo="panel"`): la jefatura de sala prueba escenarios —cuánta
 *   gente, un incendio aquí o allá— y revisa lo que pide la normativa.
 * - **Web pública** (`modo="publico"`): el cliente ve por dónde se sale desde
 *   donde está, dónde están las zonas seguras y el punto de reunión, y puede ver
 *   la simulación. Sin la revisión técnica, que es para la sala.
 *
 * Al cambiar cualquier dato se calcula la evacuación entera al instante (cien
 * milisegundos) para dar los números; el botón «Simular» la repite despacio
 * para verla.
 */

type Props = {
  plano: Plano;
  aforo: number;
  modo: "panel" | "publico";
};

type Clic = "posicion" | "incendio";

const VELOCIDADES = [1, 3, 8];

const LEYENDA: { tipo: TipoDeElemento | "SALIDA" | "RUTA"; texto: string; clase: string }[] = [
  { tipo: "SALIDA", texto: "Salida", clase: "leyenda__salida" },
  { tipo: "RUTA", texto: "Ruta de evacuación", clase: "leyenda__ruta" },
  { tipo: "ZONA_SEGURA", texto: NOMBRE_DE_ELEMENTO.ZONA_SEGURA, clase: "leyenda__segura" },
  { tipo: "PUNTO_REUNION", texto: NOMBRE_DE_ELEMENTO.PUNTO_REUNION, clase: "leyenda__reunion" },
  { tipo: "EXTINTOR", texto: NOMBRE_DE_ELEMENTO.EXTINTOR, clase: "leyenda__extintor" },
  { tipo: "BOTIQUIN", texto: NOMBRE_DE_ELEMENTO.BOTIQUIN, clase: "leyenda__botiquin" },
  { tipo: "LUZ_EMERGENCIA", texto: NOMBRE_DE_ELEMENTO.LUZ_EMERGENCIA, clase: "leyenda__luz" },
  { tipo: "ALARMA", texto: NOMBRE_DE_ELEMENTO.ALARMA, clase: "leyenda__alarma" },
];

export function SimuladorDeEvacuacion({ plano, aforo, modo }: Props) {
  const rejilla = useMemo(
    () => construirRejilla(plano.ancho, plano.fondo, plano.zonas, plano.puertas),
    [plano.ancho, plano.fondo, plano.zonas, plano.puertas],
  );
  const campo = useMemo(() => calcularCampo(rejilla), [rejilla]);
  const rutas = useMemo(() => rutasDeZonas(rejilla, campo).map((r) => r.ruta), [rejilla, campo]);

  const [personas, setPersonas] = useState(Math.max(50, aforo || 300));
  const [clic, setClic] = useState<Clic>("posicion");
  const [posicion, setPosicion] = useState<{ piso: number; x: number; y: number } | null>(null);
  const [incendio, setIncendio] = useState<Incendio | null>(null);
  const [objetivo, setObjetivo] = useState(180);
  const [velocidad, setVelocidad] = useState(3);
  const [flechas, setFlechas] = useState(modo === "panel");

  // La simulación animada vive en una ref: cambia sesenta veces por segundo y
  // no tiene que repintar React en cada paso. Lo que se enseña en números se
  // copia a estado cuatro veces por segundo.
  const sim = useRef<Simulacion | null>(null);
  const [animando, setAnimando] = useState(false);
  const [, setLatido] = useState(0);

  // La estimación instantánea: la evacuación entera con los datos actuales.
  const estimacion = useMemo(
    () => simularHastaElFinal(rejilla, { personas, incendio, semilla: "estimacion" }),
    [rejilla, personas, incendio],
  );
  const comprobaciones = useMemo<Comprobacion[]>(
    () => (modo === "panel" ? revisar(rejilla, campo, plano.elementos, estimacion, objetivo) : []),
    [modo, rejilla, campo, plano.elementos, estimacion, objetivo],
  );

  const rutaPropia = useMemo(() => {
    if (!posicion) return [];
    // Con un incendio colocado, la ruta lo esquiva.
    const c = incendio ? new Simulacion(rejilla, { personas: 0, incendio }).campo : campo;
    return rutaDesde(rejilla, c, posicion.piso, posicion.x, posicion.y);
  }, [posicion, rejilla, campo, incendio]);

  useEffect(() => {
    if (!animando) return;
    let cuadro = 0;
    let antes = performance.now();
    let ultimoLatido = 0;
    const bucle = (ahora: number) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000);
      antes = ahora;
      const s = sim.current;
      if (s && !s.terminada) s.avanzar(dt * velocidad);
      if (ahora - ultimoLatido > 250) {
        ultimoLatido = ahora;
        setLatido((n) => n + 1);
      }
      if (s?.terminada) {
        setAnimando(false);
        setLatido((n) => n + 1);
        return;
      }
      cuadro = requestAnimationFrame(bucle);
    };
    cuadro = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(cuadro);
  }, [animando, velocidad]);

  function empezar() {
    sim.current = new Simulacion(rejilla, { personas, incendio, semilla: "animada" });
    setAnimando(true);
  }

  function parar() {
    setAnimando(false);
    sim.current = null;
    setLatido((n) => n + 1);
  }

  function pulsar(piso: number, x: number, y: number) {
    if (clic === "incendio") {
      setIncendio({ piso, x, y, radio: 1.5, crece: 0.06, radioMaximo: 7 });
      setClic("posicion");
      parar();
    } else {
      setPosicion({ piso, x, y });
    }
  }

  const s = sim.current;
  const mostrada = s ?? estimacion;
  const enCurso = s !== null;
  const tiempoTotal = estimacion.tiempoTotal ?? 0;
  const resumen = resumenDe(comprobaciones);
  const distanciaPropia = useMemo(() => {
    if (rutaPropia.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < rutaPropia.length; i++) {
      const a = rutaPropia[i - 1];
      const b = rutaPropia[i];
      d += a.piso === b.piso ? Math.hypot(b.x - a.x, b.y - a.y) : 10;
    }
    return d;
  }, [rutaPropia]);
  const salidaPropia = useMemo(() => {
    if (rutaPropia.length < 2) return null;
    const fin = rutaPropia[rutaPropia.length - 1];
    return rejilla.salidas
      .filter((x) => x.piso === fin.piso)
      .reduce<{ nombre: string; d: number } | null>((mejor, x) => {
        const d = Math.hypot(x.puerta.x - fin.x, x.puerta.y - fin.y);
        return !mejor || d < mejor.d ? { nombre: x.puerta.nombre, d } : mejor;
      }, null)?.nombre;
  }, [rutaPropia, rejilla]);

  return (
    <div className="simulador">
      <div className="simulador__controles">
        <div className="simulador__grupo">
          <button type="button" className={clic === "posicion" ? "activo" : ""} onClick={() => setClic("posicion")} aria-pressed={clic === "posicion"}>
            📍 ¿Dónde estás?
          </button>
          <button type="button" className={clic === "incendio" ? "activo peligro" : ""} onClick={() => setClic("incendio")} aria-pressed={clic === "incendio"}>
            🔥 Colocar un incendio
          </button>
          {incendio && (
            <button type="button" onClick={() => { setIncendio(null); parar(); }}>
              Quitar incendio
            </button>
          )}
        </div>

        <label className="simulador__personas">
          Personas dentro <strong>{personas}</strong>
          <input
            type="range"
            min={20}
            max={Math.max(aforo * 1.2, 200)}
            step={10}
            value={personas}
            onChange={(e) => {
              setPersonas(Number(e.target.value));
              parar();
            }}
          />
        </label>

        <div className="simulador__grupo">
          {!enCurso || !animando ? (
            <button type="button" className="principal" onClick={empezar}>
              ▶ {enCurso ? "Repetir" : "Simular la evacuación"}
            </button>
          ) : (
            <button type="button" onClick={() => setAnimando(false)}>
              ❚❚ Pausa
            </button>
          )}
          {enCurso && !animando && !s?.terminada && (
            <button type="button" onClick={() => setAnimando(true)}>
              ▶ Seguir
            </button>
          )}
          {enCurso && (
            <button type="button" onClick={parar}>
              ■ Parar
            </button>
          )}
          <span className="simulador__velocidad">
            {VELOCIDADES.map((v) => (
              <button key={v} type="button" className={velocidad === v ? "activo" : ""} onClick={() => setVelocidad(v)}>
                ×{v}
              </button>
            ))}
          </span>
          <label className="simulador__casilla">
            <input type="checkbox" checked={flechas} onChange={(e) => setFlechas(e.target.checked)} /> Flechas de flujo
          </label>
        </div>
      </div>

      <MapaDeEvacuacion
        plano={plano}
        rejilla={rejilla}
        campo={s?.campo ?? campo}
        simulacion={s}
        rutas={enCurso ? undefined : rutas}
        flechas={flechas}
        posicion={posicion}
        rutaPropia={rutaPropia}
        incendioPrevio={!s && incendio ? incendio : null}
        alPulsar={pulsar}
        ayuda={
          clic === "incendio"
            ? "Toca el plano donde empieza el incendio"
            : "Toca el plano para ver tu ruta hasta la salida"
        }
      />

      {posicion && rutaPropia.length > 1 && (
        <p className="simulador__tu-ruta">
          <strong>Tu salida:</strong> {salidaPropia ?? "la más cercana"} · unos {Math.round(distanciaPropia)} m caminando
          {posicion.piso > 0 && rutaPropia.some((q) => q.piso === 0) && " (bajando por la escalera)"}
          {incendio && " · la ruta esquiva el incendio"}
        </p>
      )}

      <ul className="simulador__leyenda">
        {LEYENDA.map((l) => (
          <li key={l.tipo}>
            <i className={l.clase} aria-hidden="true" />
            {l.texto}
          </li>
        ))}
        <li>
          <i className="leyenda__persona" aria-hidden="true" />
          Persona
        </li>
        <li>
          <i className="leyenda__cola" aria-hidden="true" />
          En cola en una salida
        </li>
      </ul>

      <div className="simulador__cifras">
        <div className="simulador__cifra">
          <span>{enCurso ? "Tiempo simulado" : "Tiempo de evacuación"}</span>
          <strong>{formatearSegundos(enCurso ? mostrada.tiempo : tiempoTotal)}</strong>
          {modo === "panel" && !enCurso && <small>objetivo {formatearSegundos(objetivo)}</small>}
        </div>
        <div className="simulador__cifra">
          <span>Ya fuera</span>
          <strong>
            {mostrada.fuera}
            <small> / {mostrada.personas.length}</small>
          </strong>
        </div>
        {rejilla.plantas > 1 && (
          <div className="simulador__cifra">
            <span>Planta alta vacía</span>
            <strong>{mostrada.plantaAltaVaciaEn === null ? "—" : formatearSegundos(mostrada.plantaAltaVaciaEn)}</strong>
          </div>
        )}
        <div className="simulador__cifra">
          <span>Recorrido más largo</span>
          <strong>{Math.round(estimacion.recorridoMaximo)} m</strong>
          <small>máx. {RECORRIDO_MAXIMO} m</small>
        </div>
        {(mostrada.atrapadas > 0 || mostrada.afectadas > 0) && (
          <div className="simulador__cifra simulador__cifra--mal">
            <span>Alcanzadas por el fuego</span>
            <strong>{mostrada.afectadas}</strong>
            {mostrada.atrapadas > 0 && <small>{mostrada.atrapadas} sin salir</small>}
          </div>
        )}
      </div>

      <div className="simulador__dos">
        <section>
          <h4>Por cada salida</h4>
          <ul className="simulador__salidas">
            {mostrada.porSalida.map((x) => {
              const total = Math.max(1, ...estimacion.porSalida.map((y) => y.personas));
              const final = estimacion.porSalida[x.indice];
              const critica = !x.perdida && final.ultimaEn !== null && final.ultimaEn === estimacion.tiempoTotal;
              return (
                <li key={x.indice} className={x.perdida ? "perdida" : critica ? "critica" : ""}>
                  <div>
                    <strong>{x.nombre}</strong> <small>{nombreDePlanta(x.piso)}</small>
                    {critica && <em>cuello de botella</em>}
                    {x.perdida && <em>bloqueada por el fuego</em>}
                  </div>
                  <span className="barra">
                    <span style={{ width: `${(final.personas / total) * 100}%` }} />
                  </span>
                  <small>
                    {enCurso ? `${x.personas} fuera · ` : ""}
                    {final.personas} personas · {x.caudal}/min
                    {final.ultimaEn !== null && ` · última a los ${formatearSegundos(final.ultimaEn)}`}
                  </small>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h4>Personas dentro a lo largo del tiempo</h4>
          <Curva muestras={estimacion.muestras} total={estimacion.personas.length} actual={enCurso ? mostrada.tiempo : null} />
          {modo === "panel" && (
            <label className="simulador__objetivo">
              Objetivo de tiempo (s)
              <input type="number" min={30} max={900} step={10} value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value) || 180)} />
            </label>
          )}
        </section>
      </div>

      {modo === "panel" && (
        <section className="simulador__normativa">
          <h4>
            Revisión del plan · {resumen.cumple} cumplen
            {resumen.revisar > 0 && ` · ${resumen.revisar} a revisar`}
            {resumen.noCumple > 0 && ` · ${resumen.noCumple} no cumplen`}
          </h4>
          <ul>
            {comprobaciones.map((c, i) => (
              <li key={i} className={`veredicto--${c.veredicto}`}>
                <span className="veredicto">{c.veredicto === "cumple" ? "✓" : c.veredicto === "revisar" ? "!" : "✕"}</span>
                <div>
                  <strong>{c.titulo}</strong>
                  <p>{c.detalle}</p>
                  <small>{c.referencia}</small>
                </div>
              </li>
            ))}
          </ul>
          <p className="simulador__aviso">
            Revisión <strong>referencial</strong> con los valores habituales del RNE (A.130) y de la NTP 350.043-1. Sirve
            para corregir el plano antes de la inspección; quien certifica es la ITSE con la norma vigente. La simulación
            no modela pánico ni humo denso: compárala con los simulacros reales.
          </p>
        </section>
      )}
    </div>
  );
}

/** La curva de evacuación: cuánta gente queda dentro segundo a segundo. */
function Curva({ muestras, total, actual }: { muestras: { t: number; dentro: number }[]; total: number; actual: number | null }) {
  if (muestras.length < 2 || total === 0) return null;
  const ancho = 320;
  const alto = 120;
  const tMax = Math.max(1, muestras[muestras.length - 1].t);
  const puntos = muestras.map((m) => `${(m.t / tMax) * ancho},${alto - (m.dentro / total) * alto}`).join(" ");
  return (
    <svg viewBox={`0 0 ${ancho} ${alto + 18}`} className="simulador__curva" role="img" aria-label="Personas dentro del local a lo largo del tiempo">
      <polyline points={`0,${alto} ${puntos} ${ancho},${alto}`} className="relleno" />
      <polyline points={puntos} className="linea" />
      {actual !== null && <line x1={(actual / tMax) * ancho} x2={(actual / tMax) * ancho} y1={0} y2={alto} className="ahora" />}
      <text x={0} y={alto + 14}>0 s</text>
      <text x={ancho} y={alto + 14} textAnchor="end">
        {formatearSegundos(tMax)}
      </text>
    </svg>
  );
}
