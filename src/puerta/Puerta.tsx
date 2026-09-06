import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ErrorDeApi,
  NOMBRE_DE_RECHAZO,
  escanearEntrada,
  horaDeSala,
  verNocheDePuerta,
  type EstadoDeLaNoche,
  type ResultadoDeEscaneo,
} from "../api";
import { Login } from "../Login";
import { useSesion } from "../sesion";
import "./puerta.css";

/**
 * El control de puerta.
 *
 * Va fuera de `/panel` y no dentro, y no es una cuestión de organización: un
 * portero **no tiene permiso** sobre ninguna ruta del panel. Metida ahí, la
 * navegación le enseñaría cinco enlaces que le responden 403 y una pantalla que
 * sí puede usar. Aparte, además, porque se usa de pie y con una mano.
 *
 * Los roles que entran aquí son los mismos que acepta el backend: dirección y
 * gerencia cubren la puerta cuando el portero se va a cenar.
 */
const ROLES_DE_PUERTA = ["DIRECCION", "GERENCIA", "PUERTA"];

/**
 * Cada cuánto se refresca el aforo por su cuenta.
 *
 * Un minuto, no cinco segundos: la cifra que de verdad cambia con cada escaneo
 * se actualiza al escanear. Esto solo cubre lo que escanea **otra** puerta.
 */
const REFRESCO_MS = 60_000;

/** Cuánto se queda el resultado en pantalla antes de borrarse solo. */
const RESULTADO_MS = 8_000;

export function Puerta() {
  const { estado, entrar, salir } = useSesion();

  if (estado.fase === "comprobando") {
    return <p className="puerta__aviso">Comprobando la sesión…</p>;
  }

  if (estado.fase === "error") {
    return (
      <div className="puerta__aviso puerta__aviso--mal">
        <p>No se pudo hablar con el backend.</p>
        <p className="puerta__pista">{estado.mensaje}</p>
      </div>
    );
  }

  if (estado.fase === "fuera") {
    return (
      <div className="puerta puerta--login">
        <Login alEntrar={entrar} />
      </div>
    );
  }

  if (!ROLES_DE_PUERTA.includes(estado.usuario.rol)) {
    return (
      <div className="puerta__aviso puerta__aviso--mal">
        <p>La puerta es para dirección, gerencia y personal de acceso.</p>
        <p className="puerta__pista">
          Tu cuenta es de {estado.usuario.rol.toLowerCase()}.{" "}
          <Link to="/panel">Ir al panel</Link>
        </p>
      </div>
    );
  }

  return <Escaner portero={estado.usuario.nombre} alSalir={salir} />;
}

// ─────────────────────────────────────────────────────────────────

function Escaner({ portero, alSalir }: { portero: string; alSalir: () => Promise<void> }) {
  const [noche, setNoche] = useState<EstadoDeLaNoche | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [comprobando, setComprobando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDeEscaneo | null>(null);

  /*
   * El lector de QR de una puerta no es una cámara: es un aparato que se
   * comporta como un teclado —teclea el código y pulsa Intro—. Por eso el
   * escáner de esta pantalla es un campo de texto con el foco puesto, y por eso
   * hay que devolvérselo después de cada lectura: si el foco se pierde, el
   * siguiente código se teclea en ninguna parte y parece que el lector se ha
   * roto.
   */
  const campo = useRef<HTMLInputElement>(null);

  const refrescar = useCallback(async () => {
    try {
      setNoche(await verNocheDePuerta());
      setFallo(null);
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo cargar la noche.");
    }
  }, []);

  useEffect(() => {
    void refrescar();
    const reloj = setInterval(() => void refrescar(), REFRESCO_MS);
    return () => clearInterval(reloj);
  }, [refrescar]);

  // El resultado se borra solo. Dejarlo fijo es cómo se acaba dando por buena
  // la lectura anterior cuando la siguiente no llegó a registrarse.
  useEffect(() => {
    if (!resultado) return;
    const reloj = setTimeout(() => setResultado(null), RESULTADO_MS);
    return () => clearTimeout(reloj);
  }, [resultado]);

  async function leer(evento: React.FormEvent) {
    evento.preventDefault();
    const leido = codigo.trim();
    if (!leido || comprobando) return;

    // Se vacía antes de la petición, no después: el siguiente de la cola ya
    // está pasando su móvil y el campo tiene que estar listo.
    setCodigo("");
    setComprobando(true);

    try {
      const r = await escanearEntrada(leido);
      setResultado(r);
      // Solo se recuentan las que pasan: un rechazo no cambia el aforo.
      if (r.ok) void refrescar();
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo comprobar la entrada.");
    } finally {
      setComprobando(false);
      campo.current?.focus();
    }
  }

  return (
    <div className="puerta">
      <header className="puerta__cabecera">
        <div>
          <p className="puerta__marca">
            <span className="puerta__latido" /> Puerta
          </p>
          <h1>{noche?.hayNoche ? noche.titulo : "Sin evento"}</h1>
          {noche?.hayNoche && (
            <p className="puerta__sala">
              {noche.sala} · puertas {horaDeSala(noche.puertasA!, { timeStyle: "short" })}
              {!noche.enCurso && <span className="puerta__proxima"> · aún no abre</span>}
            </p>
          )}
        </div>

        <div className="puerta__quien">
          <span>{portero}</span>
          <button type="button" onClick={() => void alSalir()}>
            Salir
          </button>
        </div>
      </header>

      {fallo && <p className="puerta__aviso puerta__aviso--mal">{fallo}</p>}

      {noche?.hayNoche && noche.enCurso && <Aforo noche={noche} />}

      <form className="puerta__lector" onSubmit={(e) => void leer(e)}>
        <input
          ref={campo}
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Escanea o teclea el código"
          // Un lector rápido puede disparar el corrector del móvil y cambiar
          // caracteres del código. Aquí eso lo convierte en una entrada falsa.
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
        />
        <button type="submit" disabled={comprobando || !codigo.trim()}>
          {comprobando ? "…" : "Comprobar"}
        </button>
      </form>

      {resultado && <Veredicto resultado={resultado} />}

      {noche?.hayNoche && noche.enCurso && <Ultimos noche={noche} />}
    </div>
  );
}

// ─────────────────────── Trozos de la pantalla ───────────────────────

/** Cuánta gente hay dentro, contra lo emitido y contra el aforo legal. */
function Aforo({ noche }: { noche: EstadoDeLaNoche }) {
  const porcentaje = noche.aforoDeLaSala
    ? Math.min(100, Math.round((noche.dentro / noche.aforoDeLaSala) * 100))
    : 0;

  return (
    <section className="aforo">
      <div className="aforo__cifras">
        <div>
          <p className="aforo__numero">{noche.dentro}</p>
          <p className="aforo__pie">dentro</p>
        </div>
        <div>
          {/* Emitidas, no vendidas: las anuladas y devueltas no van a
              presentarse en la puerta, así que no son el objetivo. */}
          <p className="aforo__numero aforo__numero--suave">{noche.emitidas}</p>
          <p className="aforo__pie">emitidas</p>
        </div>
        <div>
          <p className="aforo__numero aforo__numero--suave">{noche.aforoDeLaSala}</p>
          <p className="aforo__pie">aforo</p>
        </div>
      </div>

      <div className="aforo__barra">
        <span style={{ width: `${porcentaje}%` }} />
      </div>

      {noche.porPuerta.length > 0 && (
        <ul className="aforo__puertas">
          {noche.porPuerta.map((p) => (
            <li key={p.puerta}>
              <span>{p.puerta}</span>
              <strong>{p.personas}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * El veredicto, en grande.
 *
 * El color lo decide el motivo y no el texto: «ya entró» es ámbar y no rojo
 * porque casi siempre es un malentendido —un QR reenviado a un amigo—, mientras
 * que una entrada falsa sí es otra cosa. Reaccionar igual a las dos es lo que
 * hace que se discuta en la puerta.
 */
function Veredicto({ resultado }: { resultado: ResultadoDeEscaneo }) {
  const tono = resultado.ok ? "bien" : resultado.motivo === "REPETIDA" ? "ojo" : "mal";

  return (
    <section className={`veredicto veredicto--${tono}`} role="status" aria-live="assertive">
      <p className="veredicto__titulo">
        {resultado.ok ? "Adelante" : NOMBRE_DE_RECHAZO[resultado.motivo ?? "FALSA"]}
      </p>

      {resultado.titular && <p className="veredicto__titular">{resultado.titular}</p>}

      {/*
        Cuando pasa, el mensaje del backend es «Adelante.» y el título ya lo
        dice: repetirlo debajo solo ocupa el sitio donde se mira el tipo de
        entrada. En un rechazo el mensaje es lo único que explica el porqué.
      */}
      {!resultado.ok && <p className="veredicto__mensaje">{resultado.mensaje}</p>}

      {resultado.ok && (
        <p className="veredicto__extra">
          {resultado.tipoDeEntrada}
          {resultado.consumicionesIncluidas > 0 &&
            ` · ${resultado.consumicionesIncluidas} ${
              resultado.consumicionesIncluidas === 1 ? "consumición" : "consumiciones"
            }`}
        </p>
      )}
    </section>
  );
}

/** Los últimos que pasaron. Sirve para comprobar el que acabas de escanear. */
function Ultimos({ noche }: { noche: EstadoDeLaNoche }) {
  if (noche.ultimos.length === 0) {
    return <p className="puerta__aviso">Todavía no ha entrado nadie.</p>;
  }

  return (
    <section className="ultimos">
      <h2>Últimos accesos</h2>
      <ul>
        {noche.ultimos.map((a) => (
          <li key={`${a.cuando}-${a.titular ?? ""}`}>
            <span className="ultimos__hora">{horaDeSala(a.cuando, { timeStyle: "short" })}</span>
            <span className="ultimos__quien">{a.titular ?? "Sin titular"}</span>
            <span className="ultimos__tipo">{a.tipoDeEntrada}</span>
            {a.puerta && <span className="ultimos__puerta">{a.puerta}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
