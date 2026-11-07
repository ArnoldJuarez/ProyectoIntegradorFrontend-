import { useState } from "react";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  borrarArtista,
  crearArtista,
  editarArtista,
  horaDeSala,
  imagen,
  quitarFotoDeArtista,
  subirFotoDeArtista,
  verArtistas,
  type ArtistaEnCatalogo,
} from "../api";
import { useCarga } from "../datos";

/**
 * El catálogo de artistas: quién puede salir en un cartel.
 *
 * Antes solo se podía elegir entre los que ya estaban en la base. Ahora se dan
 * de alta aquí (o desde el propio formulario de la noche), con su foto, su
 * Instagram y una bio corta que sale en la ficha pública.
 */
export function Artistas() {
  const [version, setVersion] = useState(0);
  const carga = useCarga(verArtistas, [version]);
  const [abierto, setAbierto] = useState<number | "nuevo" | null>(null);
  const [filtro, setFiltro] = useState("");
  const recargar = () => setVersion((v) => v + 1);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el catálogo…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="los artistas" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const texto = filtro.trim().toLowerCase();
  const artistas = carga.datos.filter(
    (a) => !texto || a.nombre.toLowerCase().includes(texto) || (a.genero ?? "").toLowerCase().includes(texto),
  );

  return (
    <section>
      <header className="cabecera">
        <h2>Artistas</h2>
        <div className="cabecera__acciones">
          <span className="contador">{carga.datos.length} en el catálogo</span>
          {abierto !== "nuevo" && (
            <button type="button" className="boton" onClick={() => setAbierto("nuevo")}>
              Nuevo artista
            </button>
          )}
        </div>
      </header>

      {abierto === "nuevo" && (
        <FichaDeArtista
          alGuardar={() => {
            setAbierto(null);
            recargar();
          }}
          alCancelar={() => setAbierto(null)}
        />
      )}

      <input
        className="buscador"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar por nombre o género"
        aria-label="Buscar artistas"
      />

      <div className="catalogo">
        {artistas.map((a) =>
          abierto === a.id ? (
            <FichaDeArtista
              key={a.id}
              inicial={a}
              alGuardar={() => {
                setAbierto(null);
                recargar();
              }}
              alCancelar={() => setAbierto(null)}
            />
          ) : (
            <article key={a.id} className="catalogo__item">
              <div className="catalogo__foto">
                {a.imagen ? <img src={imagen(a.imagen)} alt="" /> : <span aria-hidden="true">{a.nombre[0]}</span>}
              </div>
              <div className="catalogo__datos">
                <p className="catalogo__nombre">{a.nombre}</p>
                <p className="sutil">
                  {a.genero ?? "Sin género"}
                  {a.instagram && ` · @${a.instagram}`}
                </p>
                <p className="sutil">
                  {a.noches === 0
                    ? "Todavía no ha tocado en la casa"
                    : `${a.noches} ${a.noches === 1 ? "noche" : "noches"}${
                        a.ultimaNoche ? ` · la última el ${horaDeSala(a.ultimaNoche, { dateStyle: "medium" })}` : ""
                      }`}
                </p>
              </div>
              <button type="button" className="boton-secundario" onClick={() => setAbierto(a.id)}>
                Editar
              </button>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

/** Alta y edición con el mismo formulario; la foto solo cuando el artista ya existe. */
function FichaDeArtista({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial?: ArtistaEnCatalogo;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [genero, setGenero] = useState(inicial?.genero ?? "");
  const [instagram, setInstagram] = useState(inicial?.instagram ?? "");
  const [bio, setBio] = useState(inicial?.bio ?? "");
  const [foto, setFoto] = useState(inicial?.imagen ?? null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setFallo(null);
    const datos = { nombre: nombre.trim(), genero: genero.trim(), instagram: instagram.trim(), bio: bio.trim() };
    try {
      if (inicial) {
        await editarArtista(inicial.id, datos);
        toast.success("Artista actualizado");
      } else {
        await crearArtista(datos);
        toast.success(`${datos.nombre} entra al catálogo`);
      }
      alGuardar();
    } catch (err) {
      setFallo(err instanceof ErrorDeApi ? err.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !inicial) return;
    try {
      const r = await subirFotoDeArtista(inicial.id, archivo);
      setFoto(r.imagen);
      toast.success("Foto subida");
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo subir la foto.");
    }
  }

  async function quitarFoto() {
    if (!inicial) return;
    await quitarFotoDeArtista(inicial.id);
    setFoto(null);
  }

  async function borrar() {
    if (!inicial || !window.confirm(`¿Quitar a ${inicial.nombre} del catálogo?`)) return;
    try {
      await borrarArtista(inicial.id);
      toast.success("Artista borrado");
      alGuardar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo borrar.");
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}
      <div className="tipo-form__campos">
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={80} autoFocus />
        </label>
        <label>
          Género
          <input value={genero} onChange={(e) => setGenero(e.target.value)} maxLength={60} placeholder="Reguetón · Crossover" />
        </label>
        <label>
          Instagram
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} maxLength={120} placeholder="djbeto.aqp" />
        </label>
        <label className="tipo-form__ancho">
          Bio
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} maxLength={1000} />
        </label>
        {inicial && (
          <div className="tipo-form__ancho">
            Foto
            <div className="portada-acciones">
              {foto && <img src={imagen(foto)} alt="" className="catalogo__miniatura" />}
              <label className="boton-secundario">
                {foto ? "Cambiar foto" : "Subir foto"}
                <input type="file" accept="image/jpeg,image/png" onChange={(e) => void elegirFoto(e)} hidden />
              </label>
              {foto && (
                <button type="button" className="boton-secundario" onClick={() => void quitarFoto()}>
                  Quitar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {inicial && inicial.noches > 0 && (
        <p className="campo__pista">
          Ha tocado en {inicial.noches} {inicial.noches === 1 ? "noche" : "noches"}: no se puede borrar sin quitarlo de
          esa historia.
        </p>
      )}
      <div className="tipo-form__acciones">
        {inicial && inicial.noches === 0 && (
          <button type="button" className="boton--peligro" onClick={() => void borrar()}>
            Borrar
          </button>
        )}
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Dar de alta"}
        </button>
      </div>
    </form>
  );
}
