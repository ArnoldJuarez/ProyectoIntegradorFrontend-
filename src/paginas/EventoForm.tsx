import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_ESTADO,
  aHoraDeSala,
  crearNoche,
  deHoraDeSala,
  editarNoche,
  verEvento,
  verOpcionesDeProgramacion,
  type ArtistaParaElegir,
  type EstadoDeEvento,
  type SalaParaElegir,
} from "../api";
import { useCarga } from "../datos";

/**
 * Programar una noche: el mismo formulario para crear y para editar.
 *
 * Es el mismo porque los campos son los mismos y separarlos en dos archivos
 * garantiza que uno se quede atrás cuando se añada un campo. Lo que cambia es de
 * dónde salen los valores iniciales y a qué endpoint se envía.
 *
 * Al editar, la **dirección de la noche no cambia** aunque cambie el título: es
 * la URL pública, y los enlaces ya compartidos tienen que seguir funcionando.
 */
const ESTADOS: EstadoDeEvento[] = ["BORRADOR", "PUBLICADO", "AGOTADO", "CANCELADO", "CERRADO"];

export function EventoForm() {
  const { slug } = useParams();
  const editando = Boolean(slug);
  const navegar = useNavigate();

  const opciones = useCarga(verOpcionesDeProgramacion, []);
  // Al crear no hay noche que cargar: se pide `null` y el efecto de abajo no
  // hace nada. Es más simple que un hook condicional, que React no permite.
  const noche = useCarga(() => (slug ? verEvento(slug) : Promise.resolve(null)), [slug]);

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [salaId, setSalaId] = useState("");
  const [puertasA, setPuertasA] = useState("");
  const [terminaA, setTerminaA] = useState("");
  const [edadMinima, setEdadMinima] = useState(18);
  const [vestimenta, setVestimenta] = useState("");
  const [estado, setEstado] = useState<EstadoDeEvento>("BORRADOR");
  const [portada, setPortada] = useState("");
  const [artistaIds, setArtistaIds] = useState<string[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  // Los valores iniciales llegan cuando llega la noche, no en el primer render.
  useEffect(() => {
    if (noche.fase !== "listo" || !noche.datos) return;

    const n = noche.datos;
    setTitulo(n.titulo);
    setDescripcion(n.descripcion ?? "");
    setPuertasA(aHoraDeSala(n.puertasA));
    setTerminaA(aHoraDeSala(n.terminaA));
    setEdadMinima(n.edadMinima);
    setVestimenta(n.vestimenta ?? "");
    setEstado(n.estado);
    setPortada(n.portada ?? "");
  }, [noche]);

  // La sala se resuelve por nombre porque la ficha no trae su id: el DTO del
  // panel enseña el nombre, que es lo que se lee. Cuando llegan las opciones se
  // busca cuál es.
  useEffect(() => {
    if (opciones.fase !== "listo") return;

    if (noche.fase === "listo" && noche.datos) {
      const suya = opciones.datos.salas.find((s) => s.nombre === noche.datos!.sala);
      if (suya) setSalaId(suya.id);
    } else if (!salaId && opciones.datos.salas.length > 0) {
      setSalaId(opciones.datos.salas[0].id);
    }
    // `salaId` no va en las dependencias: solo se fija una vez, y volver a
    // ejecutarlo al cambiarla pisaría lo que el usuario acabe de elegir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opciones, noche]);

  if (opciones.fase === "cargando" || noche.fase === "cargando") {
    return <p className="aviso">Cargando el formulario…</p>;
  }
  if (opciones.fase === "error") {
    return (
      <AvisoDeError
        que="las salas y artistas"
        mensaje={opciones.mensaje}
        estadoHttp={opciones.estadoHttp}
      />
    );
  }
  if (noche.fase === "error") {
    return <AvisoDeError que="la noche" mensaje={noche.mensaje} estadoHttp={noche.estadoHttp} />;
  }

  const salas = opciones.datos.salas;
  const artistas = opciones.datos.artistas;
  const sala = salas.find((s) => s.id === salaId);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setFallo(null);

    const datos = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      salaId,
      // Lo tecleado es hora de sala: la conversión a UTC se hace aquí.
      puertasA: deHoraDeSala(puertasA),
      terminaA: deHoraDeSala(terminaA),
      edadMinima,
      vestimenta: vestimenta.trim(),
      estado,
      portada: portada.trim(),
      artistaIds,
    };

    try {
      const guardada = slug ? await editarNoche(slug, datos) : await crearNoche(datos);
      navegar(`/panel/eventos/${guardada.slug}`);
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo guardar la noche.");
      setGuardando(false);
    }
  }

  return (
    <section>
      <p className="migas">
        <Link to={slug ? `/panel/eventos/${slug}` : "/panel/eventos"} className="enlace">
          ← {slug ? "Volver a la noche" : "Eventos"}
        </Link>
      </p>

      <header className="cabecera">
        <h2>{editando ? "Editar noche" : "Nueva noche"}</h2>
      </header>

      {fallo && <p className="aviso aviso--error">{fallo}</p>}

      <form className="formulario" onSubmit={(e) => void guardar(e)}>
        <label className="campo campo--ancho">
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            minLength={3}
            maxLength={160}
          />
          {editando && (
            <span className="campo__pista">
              La dirección pública sigue siendo <code>/evento/{slug}</code> aunque cambies el
              título: los enlaces ya compartidos tienen que seguir funcionando.
            </span>
          )}
        </label>

        <label className="campo campo--ancho">
          Descripción
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </label>

        <label className="campo">
          Sala
          <select value={salaId} onChange={(e) => setSalaId(e.target.value)} required>
            {salas.map((s: SalaParaElegir) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.aforo} de aforo
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoDeEvento)}
            required
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {NOMBRE_DE_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Puertas (hora de Lima)
          <input
            type="datetime-local"
            value={puertasA}
            onChange={(e) => setPuertasA(e.target.value)}
            required
          />
        </label>

        <label className="campo">
          Cierre (hora de Lima)
          <input
            type="datetime-local"
            value={terminaA}
            onChange={(e) => setTerminaA(e.target.value)}
            required
          />
        </label>

        <label className="campo">
          Edad mínima
          <input
            type="number"
            min={0}
            max={99}
            value={edadMinima}
            onChange={(e) => setEdadMinima(Number(e.target.value))}
            required
          />
        </label>

        <label className="campo">
          Vestimenta
          <input
            value={vestimenta}
            onChange={(e) => setVestimenta(e.target.value)}
            maxLength={120}
            placeholder="Casual elegante"
          />
        </label>

        <label className="campo campo--ancho">
          Portada (dirección de imagen)
          <input
            value={portada}
            onChange={(e) => setPortada(e.target.value)}
            maxLength={500}
            placeholder="/eventos/mi-noche.webp"
          />
          {/*
            La subida de archivos del sistema anterior no está migrada: era un
            formulario multiparte que optimizaba la imagen y la escribía en
            disco, y eso es un problema aparte. Decirlo aquí es mejor que un
            botón de subir que no existe.
          */}
          <span className="campo__pista">
            Por ahora se pega una dirección. La subida de archivos todavía no está migrada.
          </span>
        </label>

        <fieldset className="campo campo--ancho elegir-cartel">
          <legend>Cartel</legend>
          <p className="campo__pista">
            El primero que marques es el cabeza de cartel.
          </p>
          <div className="elegir-cartel__opciones">
            {artistas.map((a: ArtistaParaElegir) => {
              const puesto = artistaIds.indexOf(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={puesto >= 0 ? "artista artista--elegido" : "artista"}
                  onClick={() =>
                    setArtistaIds((previos) =>
                      previos.includes(a.id)
                        ? previos.filter((id) => id !== a.id)
                        : [...previos, a.id],
                    )
                  }
                >
                  {puesto >= 0 && <span className="artista__puesto">{puesto + 1}</span>}
                  <span>{a.nombre}</span>
                  {a.genero && <span className="artista__genero">{a.genero}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        {sala && (
          <p className="campo__pista campo--ancho">
            {sala.nombre} admite {sala.aforo} personas. Las entradas se configuran después de
            guardar, en la ficha de la noche.
          </p>
        )}

        <div className="formulario__acciones">
          <button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear noche"}
          </button>
        </div>
      </form>
    </section>
  );
}
