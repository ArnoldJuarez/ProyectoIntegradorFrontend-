import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_ESTADO,
  aHoraDeSala,
  comoVideo,
  crearArtista,
  crearNoche,
  deHoraDeSala,
  editarNoche,
  imagen,
  quitarPortada,
  quitarVideo,
  subirPortada,
  subirVideo,
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
 *
 * El cartel se carga con la noche. Antes no se cargaba, y guardar cualquier
 * cambio —una falta de ortografía en el título— dejaba la noche sin artistas.
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
  // 0 = ninguna elegida todavía.
  const [salaId, setSalaId] = useState(0);
  const [puertasA, setPuertasA] = useState("");
  const [terminaA, setTerminaA] = useState("");
  const [edadMinima, setEdadMinima] = useState(18);
  const [vestimenta, setVestimenta] = useState("");
  const [estado, setEstado] = useState<EstadoDeEvento>("BORRADOR");
  const [portada, setPortada] = useState("");
  const [video, setVideo] = useState("");
  const [artistaIds, setArtistaIds] = useState<number[]>([]);
  /** Los que se dan de alta desde aquí, para que aparezcan sin recargar las opciones. */
  const [nuevos, setNuevos] = useState<ArtistaParaElegir[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<"portada" | "video" | null>(null);
  const [avisoDePortada, setAvisoDePortada] = useState<string | null>(null);
  const [avisoDeVideo, setAvisoDeVideo] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [generoNuevo, setGeneroNuevo] = useState("");
  const [creandoArtista, setCreandoArtista] = useState(false);

  // Los valores iniciales llegan cuando llega la noche, no en el primer render.
  useEffect(() => {
    if (noche.fase !== "listo" || !noche.datos) return;

    const n = noche.datos;
    setTitulo(n.titulo);
    setDescripcion(n.descripcion ?? "");
    setSalaId(n.salaId);
    setPuertasA(aHoraDeSala(n.puertasA));
    setTerminaA(aHoraDeSala(n.terminaA));
    setEdadMinima(n.edadMinima);
    setVestimenta(n.vestimenta ?? "");
    setEstado(n.estado);
    setPortada(n.portada ?? "");
    setVideo(n.video ?? "");
    setArtistaIds(n.cartel.map((a) => a.id));
  }, [noche]);

  // Al crear, la sala por defecto es la primera (la más grande).
  useEffect(() => {
    if (opciones.fase !== "listo" || editando) return;
    if (!salaId && opciones.datos.salas.length > 0) setSalaId(opciones.datos.salas[0].id);
    // `salaId` no va en las dependencias: solo se fija una vez, y volver a
    // ejecutarlo al cambiarla pisaría lo que el usuario acabe de elegir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opciones, editando]);

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
  const artistas = [...opciones.datos.artistas, ...nuevos].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const sala = salas.find((s) => s.id === salaId);

  /*
   * El flyer y el video se suben en cuanto se eligen, sin esperar a «Guardar»:
   * son archivos aparte de la noche, y el backend ya los deja apuntados en
   * ella. Así el campo de texto refleja la dirección nueva y guardar después no
   * la pisa.
   */
  async function elegirFlyer(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !slug) return;

    setSubiendo("portada");
    setAvisoDePortada(null);
    try {
      const r = await subirPortada(slug, archivo);
      setPortada(r.portada);
      setAvisoDePortada(`Flyer subido (${r.pesoKb} KB tras optimizarlo).`);
      toast.success("Flyer subido");
    } catch (err) {
      setAvisoDePortada(err instanceof ErrorDeApi ? err.message : "No se pudo subir el flyer.");
    } finally {
      setSubiendo(null);
    }
  }

  async function quitarFlyer() {
    if (!slug) return;
    setSubiendo("portada");
    try {
      await quitarPortada(slug);
      setPortada("");
      setAvisoDePortada("Flyer quitado.");
    } catch (err) {
      setAvisoDePortada(err instanceof ErrorDeApi ? err.message : "No se pudo quitar el flyer.");
    } finally {
      setSubiendo(null);
    }
  }

  async function elegirVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !slug) return;

    setSubiendo("video");
    setAvisoDeVideo(`Subiendo ${(archivo.size / 1024 / 1024).toFixed(1)} MB…`);
    try {
      const r = await subirVideo(slug, archivo);
      setVideo(r.video);
      setAvisoDeVideo(`Video subido (${Math.round(r.pesoKb / 1024)} MB).`);
      toast.success("Video subido");
    } catch (err) {
      setAvisoDeVideo(err instanceof ErrorDeApi ? err.message : "No se pudo subir el video.");
    } finally {
      setSubiendo(null);
    }
  }

  async function borrarVideo() {
    if (!slug) return;
    setSubiendo("video");
    try {
      await quitarVideo(slug);
      setVideo("");
      setAvisoDeVideo("Video quitado.");
    } catch (err) {
      setAvisoDeVideo(err instanceof ErrorDeApi ? err.message : "No se pudo quitar el video.");
    } finally {
      setSubiendo(null);
    }
  }

  /** Da de alta un artista sin salir del formulario y lo añade al cartel. */
  async function anadirArtista() {
    if (nombreNuevo.trim().length < 2 || creandoArtista) return;
    setCreandoArtista(true);
    try {
      const a = await crearArtista({ nombre: nombreNuevo.trim(), genero: generoNuevo.trim(), instagram: "", bio: "" });
      setNuevos((previos) => [...previos, { id: a.id, nombre: a.nombre, genero: a.genero }]);
      setArtistaIds((previos) => [...previos, a.id]);
      setNombreNuevo("");
      setGeneroNuevo("");
      toast.success(`${a.nombre} añadido al catálogo y al cartel`);
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo dar de alta el artista.");
    } finally {
      setCreandoArtista(false);
    }
  }

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
      video: video.trim(),
      artistaIds,
    };

    try {
      const guardada = slug ? await editarNoche(slug, datos) : await crearNoche(datos);
      toast.success(slug ? "Cambios guardados" : "Noche creada");
      navegar(`/panel/eventos/${guardada.slug}`);
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo guardar la noche.");
      setGuardando(false);
    }
  }

  const reproduccion = video.trim() ? comoVideo(video.trim()) : null;

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
          <select value={salaId} onChange={(e) => setSalaId(Number(e.target.value))} required>
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

        <div className="campo campo--ancho">
          Portada
          {portada && (
            <img src={imagen(portada)} alt="Flyer de la noche" className="portada-previa" />
          )}
          {editando ? (
            <div className="portada-acciones">
              <label className="boton-secundario">
                {subiendo === "portada" ? "Subiendo…" : portada ? "Cambiar flyer" : "Subir flyer"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={elegirFlyer}
                  disabled={subiendo !== null}
                  hidden
                />
              </label>
              {portada && (
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={quitarFlyer}
                  disabled={subiendo !== null}
                >
                  Quitar
                </button>
              )}
            </div>
          ) : (
            <span className="campo__pista">
              Guarda la noche primero; el flyer y el video se suben desde «Editar».
            </span>
          )}
          {avisoDePortada && <span className="campo__pista">{avisoDePortada}</span>}
          <input
            value={portada}
            onChange={(e) => setPortada(e.target.value)}
            maxLength={500}
            placeholder="o pega una dirección: /fotos/show.webp"
            aria-label="Dirección de la imagen de portada"
          />
          <span className="campo__pista">JPG o PNG hasta 12 MB. Se reescala a 1400 px.</span>
        </div>

        <div className="campo campo--ancho">
          Video <span className="sutil">(opcional)</span>
          {reproduccion?.tipo === "archivo" && (
            <video src={reproduccion.src} className="portada-previa" controls muted playsInline preload="metadata" />
          )}
          {reproduccion?.tipo === "youtube" && (
            <p className="campo__pista">Video de YouTube: se verá en la ficha pública.</p>
          )}
          {editando && (
            <div className="portada-acciones">
              <label className="boton-secundario">
                {subiendo === "video" ? "Subiendo…" : video ? "Cambiar video" : "Subir video"}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={elegirVideo}
                  disabled={subiendo !== null}
                  hidden
                />
              </label>
              {video && (
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={borrarVideo}
                  disabled={subiendo !== null}
                >
                  Quitar
                </button>
              )}
            </div>
          )}
          {avisoDeVideo && <span className="campo__pista">{avisoDeVideo}</span>}
          <input
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            maxLength={500}
            placeholder="o pega un enlace https: YouTube o un .mp4"
            aria-label="Dirección del video"
          />
          <span className="campo__pista">
            MP4 o WebM hasta 80 MB. Un clip corto (15-30 s) carga rápido en el móvil.
          </span>
        </div>

        <fieldset className="campo campo--ancho elegir-cartel">
          <legend>Cartel</legend>
          <p className="campo__pista">
            El primero que marques es el cabeza de cartel. Para ponerle foto o bio, ve a{" "}
            <Link to="/panel/artistas" className="enlace">
              Artistas
            </Link>
            .
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
          <div className="alta-rapida">
            <input
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="¿Uno nuevo? Nombre del artista"
              aria-label="Nombre del artista nuevo"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void anadirArtista();
                }
              }}
            />
            <input
              value={generoNuevo}
              onChange={(e) => setGeneroNuevo(e.target.value)}
              placeholder="Género"
              aria-label="Género del artista nuevo"
              maxLength={60}
            />
            <button
              type="button"
              className="boton-secundario"
              onClick={() => void anadirArtista()}
              disabled={nombreNuevo.trim().length < 2 || creandoArtista}
            >
              {creandoArtista ? "Añadiendo…" : "Añadir al cartel"}
            </button>
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
