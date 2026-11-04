import { useState } from "react";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_ROL,
  cambiarClave,
  darDeAlta,
  editarPersona,
  soles,
  verEquipo,
  verOpcionesDePersonal,
  type PersonaDelEquipo,
  type Rol,
} from "../api";
import { useCarga } from "../datos";

/**
 * El equipo: quién trabaja en la casa, con qué rol entra al sistema y quién
 * trae gente con código de promotor.
 *
 * Solo dirección ve esta pantalla: quien reparte roles puede darse cualquier
 * permiso. La contraseña nunca se enseña; se pone al dar de alta o se cambia
 * aparte.
 */
export function Personal() {
  const [version, setVersion] = useState(0);
  const equipo = useCarga(verEquipo, [version]);
  const opciones = useCarga(verOpcionesDePersonal, []);
  const [abierto, setAbierto] = useState<string | null>(null);
  const recargar = () => setVersion((v) => v + 1);

  if (equipo.fase === "cargando" || opciones.fase === "cargando") return <p className="aviso">Cargando el equipo…</p>;
  if (equipo.fase === "error") {
    return <AvisoDeError que="el personal" mensaje={equipo.mensaje} estadoHttp={equipo.estadoHttp} />;
  }
  if (opciones.fase === "error") return <p className="aviso aviso--error">{opciones.mensaje}</p>;

  const activos = equipo.datos.filter((p) => p.activo);

  return (
    <section>
      <header className="cabecera">
        <h2>Personal</h2>
        <div className="cabecera__acciones">
          <span className="contador">
            {activos.length} activos · {activos.filter((p) => p.conAcceso).length} con acceso al sistema
          </span>
          {abierto !== "nuevo" && (
            <button type="button" className="boton" onClick={() => setAbierto("nuevo")}>
              Dar de alta
            </button>
          )}
        </div>
      </header>

      {abierto === "nuevo" && (
        <FichaDePersona
          opciones={opciones.datos}
          alGuardar={() => {
            setAbierto(null);
            recargar();
          }}
          alCancelar={() => setAbierto(null)}
        />
      )}

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Rol</th>
              <th>Puesto</th>
              <th className="num">Sueldo / hora</th>
              <th>Promotor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {equipo.datos.map((p) =>
              abierto === p.id ? (
                <tr key={p.id}>
                  <td colSpan={6}>
                    <FichaDePersona
                      inicial={p}
                      opciones={opciones.datos}
                      alGuardar={() => {
                        setAbierto(null);
                        recargar();
                      }}
                      alCancelar={() => setAbierto(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className={p.activo ? undefined : "fila--apagada"}>
                  <td>
                    <strong>{p.nombre}</strong>
                    {!p.activo && <span className="estado estado--cancelado"> De baja</span>}
                    <br />
                    <span className="sutil">{p.email ?? "sin cuenta"}{p.conAcceso ? " · entra al sistema" : ""}</span>
                  </td>
                  <td>{NOMBRE_DE_ROL[p.rol]}</td>
                  <td>{p.puesto ?? <span className="sutil">—</span>}</td>
                  <td className="num">{p.sueldoPorHoraCentimos > 0 ? soles(p.sueldoPorHoraCentimos) : <span className="sutil">—</span>}</td>
                  <td>
                    {p.codigoDePromotor ? (
                      <span className="etiqueta">
                        {p.codigoDePromotor} · {p.comisionPorcentaje}%
                        {p.bonoPorInvitadoCentimos > 0 && ` + ${soles(p.bonoPorInvitadoCentimos)}/invitado`}
                      </span>
                    ) : (
                      <span className="sutil">—</span>
                    )}
                  </td>
                  <td className="acciones">
                    <button type="button" className="boton-secundario" onClick={() => setAbierto(p.id)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FichaDePersona({
  inicial,
  opciones,
  alGuardar,
  alCancelar,
}: {
  inicial?: PersonaDelEquipo;
  opciones: { roles: Rol[]; puestos: { id: string; nombre: string }[] };
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [rol, setRol] = useState<Rol>(inicial?.rol ?? "PERSONAL");
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [puestoId, setPuestoId] = useState(inicial?.puestoId ?? "");
  const [sueldo, setSueldo] = useState(inicial ? String(inicial.sueldoPorHoraCentimos / 100) : "0");
  const [codigo, setCodigo] = useState(inicial?.codigoDePromotor ?? "");
  const [comision, setComision] = useState(inicial?.comisionPorcentaje != null ? String(inicial.comisionPorcentaje) : "");
  const [bono, setBono] = useState(inicial ? String(inicial.bonoPorInvitadoCentimos / 100) : "0");
  const [clave, setClave] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setFallo(null);
    const datos = {
      nombre: nombre.trim(),
      email: email.trim(),
      rol,
      activo,
      puestoId: puestoId || null,
      sueldoPorHoraCentimos: Math.round(Number(sueldo || 0) * 100),
      codigoDePromotor: codigo.trim(),
      comisionPorcentaje: comision ? Number(comision) : null,
      bonoPorInvitadoCentimos: codigo.trim() ? Math.round(Number(bono || 0) * 100) : 0,
    };
    try {
      if (inicial) {
        await editarPersona(inicial.id, datos);
        if (clave) await cambiarClave(inicial.id, clave);
        toast.success(clave ? "Ficha y contraseña actualizadas" : "Ficha actualizada");
      } else {
        await darDeAlta({ ...datos, clave: clave || undefined });
        toast.success(`${datos.nombre} dado de alta`);
      }
      alGuardar();
    } catch (err) {
      setFallo(err instanceof ErrorDeApi ? err.message : "No se pudo guardar.");
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
          Rol
          <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {opciones.roles.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_DE_ROL[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Puesto
          <select value={puestoId} onChange={(e) => setPuestoId(e.target.value)}>
            <option value="">Sin puesto</option>
            {opciones.puestos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sueldo por hora (S/)
          <input type="number" min={0} step="0.50" value={sueldo} onChange={(e) => setSueldo(e.target.value)} />
        </label>
        <label>
          Correo (para entrar)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} placeholder="Sin correo no entra al sistema" />
        </label>
        <label>
          {inicial ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
        </label>
        <label>
          Código de promotor
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={20} placeholder="Opcional: PIERO" />
        </label>
        <label>
          Comisión (%)
          <input type="number" min={0} max={50} value={comision} onChange={(e) => setComision(e.target.value)} disabled={!codigo.trim()} />
        </label>
        <label>
          Pago por invitado que entra (S/)
          <input
            type="number"
            min={0}
            max={1000}
            step="0.50"
            value={bono}
            onChange={(e) => setBono(e.target.value)}
            disabled={!codigo.trim()}
            title="Se le paga por cada persona de sus listas que pasa por la puerta. 0 si solo cobra porcentaje."
          />
        </label>
        {inicial && (
          <label className="casilla">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Activo (si lo desactivas, su sesión se cierra en la siguiente petición)
          </label>
        )}
      </div>
      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit">{inicial ? "Guardar cambios" : "Dar de alta"}</button>
      </div>
    </form>
  );
}
