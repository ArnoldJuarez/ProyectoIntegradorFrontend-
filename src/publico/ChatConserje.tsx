import { useEffect, useRef, useState } from "react";
import { preguntarAlConserje, type TurnoDeChat } from "../api";

/**
 * El conserje: un botón flotante que abre el chat.
 *
 * Contesta con datos de la base en el momento —cartel, precios, horarios—, no
 * de memoria. Si el proveedor de IA no contesta, el backend responde con el
 * teléfono en vez de un error: quien pregunta no tiene por qué saber que hay un
 * modelo detrás.
 *
 * Se mandan solo los últimos diez turnos: la conversación de una web de
 * discoteca no necesita más contexto, y cada turno de más son tokens.
 */
export function ChatConserje() {
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<TurnoDeChat[]>([]);
  const [borrador, setBorrador] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const sesionId = useRef<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [turnos, ocupado]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const mensaje = borrador.trim();
    if (!mensaje || ocupado) return;

    const historial = turnos.slice(-10);
    setTurnos([...turnos, { rol: "usuario", contenido: mensaje }]);
    setBorrador("");
    setOcupado(true);

    try {
      const r = await preguntarAlConserje(mensaje, historial, sesionId.current);
      sesionId.current = r.sesionId;
      setTurnos((t) => [...t, { rol: "asistente", contenido: r.respuesta }]);
    } catch {
      setTurnos((t) => [
        ...t,
        { rol: "asistente", contenido: "Me he quedado sin conexión. Inténtalo otra vez." },
      ]);
    } finally {
      setOcupado(false);
    }
  }

  if (!abierto) {
    return (
      <div className="tw">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="glow-acento eyebrow fixed right-5 bottom-5 z-50 bg-acento px-5 py-3.5 text-on-acento transition hover:brightness-110"
        >
          ¿Dudas? Pregunta
        </button>
      </div>
    );
  }

  return (
    <div className="tw">
      <div className="fixed right-5 bottom-5 z-50 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden border border-line-strong bg-surface text-ink shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="font-display text-xl font-black uppercase">Conserje</p>
            <p className="eyebrow text-muted">Cartel, precios y horarios</p>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar el chat"
            className="text-muted transition hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div ref={lista} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {turnos.length === 0 && (
            <p className="text-sm text-muted">
              Pregúntame qué hay este finde, cuánto cuesta la entrada o a qué hora abrimos.
            </p>
          )}

          {turnos.map((t, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                t.rol === "usuario"
                  ? "self-end bg-acento text-on-acento"
                  : "self-start border border-line bg-raised text-ink-soft"
              }`}
            >
              {t.contenido}
            </div>
          ))}

          {ocupado && (
            <div className="self-start border border-line bg-raised px-3 py-2 text-sm text-muted">
              Mirando el cartel…
            </div>
          )}
        </div>

        <form onSubmit={enviar} className="flex gap-2 border-t border-line p-3">
          <input
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            placeholder="Escribe tu pregunta"
            aria-label="Tu pregunta"
            maxLength={1000}
            className="min-w-0 flex-1 border border-line-strong bg-ground px-3 py-2 text-sm outline-none transition focus:border-acento"
          />
          <button
            type="submit"
            disabled={ocupado || borrador.trim().length === 0}
            className="eyebrow bg-acento px-4 py-2.5 text-on-acento transition hover:brightness-110 disabled:opacity-40"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
