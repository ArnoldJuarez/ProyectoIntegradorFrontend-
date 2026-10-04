import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verMetricasDeIa, type MetricasDeIa } from "../api";
import { useCarga } from "../datos";

/**
 * Lo que cuesta y lo que acierta la capa de IA.
 *
 * La tabla se parte en dos a propósito: las corridas del banco de pruebas son
 * laboratorio —decenas de ejecuciones contra modelos distintos— y mezclarlas
 * con la operación real arruinaría las dos lecturas.
 */

function Resultado({ e }: { e: MetricasDeIa["ultimas"][number] }) {
  if (e.estado === "COMPLETADA") {
    return (
      <span className="estado estado--publicado">
        {e.propuestas > 0 ? `${e.propuestas} propuesta${e.propuestas > 1 ? "s" : ""}` : "Hecho"}
      </span>
    );
  }
  if (e.estado === "FALLIDA") return <span className="estado estado--agotado">Falló</span>;
  return <span className="estado">{e.estado === "EJECUTANDO" ? "En curso" : "En cola"}</span>;
}

export function MetricasIa() {
  const carga = useCarga(verMetricasDeIa, []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando las métricas…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="las métricas" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const m = carga.datos;

  return (
    <section>
      <header className="cabecera">
        <h2>Métricas de IA</h2>
        <span className="contador">Coste, tiempos y cuánto se acepta lo que propone</span>
      </header>

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{m.ejecuciones}</p>
          <p className="tarjeta__pie">Ejecuciones · sin el banco de pruebas</p>
        </div>
        <div
          className={`tarjeta ${m.tasaDeAceptacion !== null && m.tasaDeAceptacion < 60 ? "tarjeta--alerta" : ""}`}
        >
          <p className="tarjeta__cifra">{m.tasaDeAceptacion === null ? "—" : `${m.tasaDeAceptacion}%`}</p>
          <p className="tarjeta__pie">
            Aceptación ·{" "}
            {m.tasaDeAceptacion === null
              ? "ninguna revisada"
              : `${m.aprobadas} de ${m.revisadas} revisadas`}
          </p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">
            {m.costeCentimos === 0 ? "Gratis" : soles(m.costeCentimos)}
          </p>
          <p className="tarjeta__pie">Coste · {m.tokens.toLocaleString("es-PE")} tokens</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">
            {m.minutosHastaDecidir === null ? "—" : `${m.minutosHastaDecidir} min`}
          </p>
          <p className="tarjeta__pie">Decisión humana · mediana</p>
        </div>
      </div>

      {m.pendientes > 0 && m.revisadas === 0 && (
        <p className="aviso">
          Hay propuestas sin revisar. La tasa de aceptación es lo que dice si esto sirve, y no se
          puede calcular hasta que alguien apruebe o descarte.
        </p>
      )}

      <h3 className="subtitulo">Operación real</h3>
      {m.porAgente.length === 0 ? (
        <p className="sutil">Ningún agente ha corrido todavía.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Agente</th>
                <th className="num">Veces</th>
                <th className="num">Éxito</th>
                <th className="num">Mediana</th>
                <th className="num">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {m.porAgente.map((f) => (
                <tr key={f.agente}>
                  <td>{f.agente}</td>
                  <td className="num">{f.veces}</td>
                  <td className="num">{f.exitoPorcentaje}%</td>
                  <td className="num">{f.mediana}</td>
                  <td className="num sutil">{f.tokensMedios}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="subtitulo">Banco de pruebas</h3>
      {m.bancoDePruebas.length === 0 ? (
        <p className="sutil">Sin corridas de banco: comparan los mismos agentes contra modelos distintos.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Modelo</th>
                <th className="num">Corridas</th>
                <th className="num">Éxito</th>
                <th className="num">Mediana</th>
                <th className="num">Intentos</th>
              </tr>
            </thead>
            <tbody>
              {m.bancoDePruebas.map((f) => (
                <tr key={f.modelo}>
                  <td className="sku">{f.modelo}</td>
                  <td className="num">{f.corridas}</td>
                  <td className="num">{f.exitoPorcentaje}%</td>
                  <td className="num">{f.mediana}</td>
                  <td className="num sutil">{f.intentosMedios}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="subtitulo">Últimas ejecuciones</h3>
      {m.ultimas.length === 0 ? (
        <p className="sutil">Aquí se ve quién lanzó qué y cómo acabó.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Modelo</th>
                <th>Lanzada por</th>
                <th>Cuándo</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {m.ultimas.map((e) => (
                <tr key={e.id}>
                  <td>{e.agente}</td>
                  <td className="sku sutil">{e.modelo ?? "—"}</td>
                  <td>{e.lanzadaPor}</td>
                  <td className="sutil">{horaDeSala(e.cuando)}</td>
                  <td>
                    <Resultado e={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
