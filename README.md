# Ssiomama — frontend

La web de la discoteca en React: la parte pública que ve un cliente y el panel
interno del personal.

Consume la API del backend, que vive en **otro repositorio**:
`ssiomama-backend`. Este proyecto no habla con la base de datos ni sabe dónde
está: todo pasa por HTTP.

```
React 19 · Vite · TypeScript · React Router
```

## Qué hace falta instalado

Node.js 20 o superior. Nada más.

Y **el backend corriendo**, o no se ve nada: esta web no tiene datos propios.

## Arrancar

```bash
npm install
npm run dev
```

Queda en <http://localhost:5173>.

Si al abrirlo sale «No se pudo conectar con el backend», te falta arrancar el
otro repositorio. La pantalla te dice el comando.

### Apuntar a otro backend

Por defecto lo busca en `http://localhost:8080`. Para cambiarlo, crea un archivo
`.env.local`:

```
VITE_API_URL=https://donde-este-el-backend
```

Ese archivo no va a git: `*.local` está en el `.gitignore`.

## Las tres zonas

**Pública** — cualquiera, sin cuenta:

| Ruta | Qué hay |
|---|---|
| `/` | Portada: próxima noche con cuenta atrás, más fechas, boxes, el local, artistas, galería, preguntas, cómo llegar |
| `/agenda` | Todas las fechas anunciadas, agrupadas por mes |
| `/evento/:slug` | Cartel, horarios, compra de entradas y solicitud de box |
| `/entradas/:codigo` | Las entradas compradas, con su QR |

En todas las páginas públicas está el **conserje**: un chat que contesta con
datos de la base en el momento (cartel, precios, horario).

**Panel** — pide sesión de dirección o gerencia:

| Ruta | Qué hay |
|---|---|
| `/panel` | Resumen: lo que hay que mirar antes de abrir |
| `/panel/noche` | Torre de control de la noche en curso |
| `/panel/eventos` | Programar noches, tipos de entrada, flyer y listas de invitados |
| `/panel/pedidos` | Pedidos de entradas |
| `/panel/clientes` | Clientes y su historial |
| `/panel/promotores` | Promotores, sus listas de invitados y su comisión |
| `/panel/crm` | Segmentos y campañas |
| `/panel/caja` | Arqueos de caja |
| `/panel/inventario` | Stock, movimientos y proveedores |
| `/panel/local` | Plano 2D, vista 3D y simulación de evacuación |
| `/panel/propuestas` | Lanzar agentes de IA y aprobar o descartar lo que proponen |
| `/panel/ia` | Coste, tiempos y aceptación de la IA |

**Pantallas de turno** — a pantalla completa: `/puerta` (escáner de QR) y
`/barra` (punto de venta).

Cuentas de prueba: `admin@ssiomama.test`, `sala@ssiomama.test` y
`puerta@ssiomama.test`, todas con contraseña `discoteca`. El portero entra al
sistema pero no ve el panel — sirve para comprobar que los permisos funcionan de
verdad.

## Cómo está organizado

```
src/
  api.ts          Todo lo que habla con el backend. Un solo sitio.
  config.ts       Datos del local que NO están en la base (dirección, horario).
  sesion.tsx      Quién está dentro, compartido por toda la app.
  datos.ts        useCarga: el patrón de "pedir y pintar", escrito una vez.
  Aviso.tsx       Traduce un código HTTP a algo que se pueda leer.
  tailwind.css    Tailwind sin reset global, solo dentro de `.tw` (ver abajo).
  publico/        La web del cliente. `portada/` son las piezas de la portada.
  paginas/        El panel del personal.
  panel/          Resumen y torre de control.
  local/          Editor del plano, escena 3D y cálculo de evacuación.
  puerta/ barra/  Las pantallas de turno.
```

**`config.ts` es el único sitio con datos escritos a mano**, y tiene su razón:
lo que el local puede editar desde el panel (aforo, zonas, salas) sale de la
base; lo que solo cambia si cambia el negocio entero (la dirección, el nombre)
va aquí. Si estuviera en los dos sitios habría dos verdades y una mentiría.

Los datos que el local aún no nos ha dado van entre «comillas angulares» y se
enseñan tal cual, para que no se olviden.

## Antes de dar algo por bueno

```bash
npm run build
```

El servidor de desarrollo **solo borra los tipos, no los comprueba**. Ya ha
pasado: código que se veía perfectamente en el navegador y fallaba al compilar.
`npm run build` sí hace la comprobación completa.

## Dos decisiones que conviene no deshacer

**La sesión no se guarda aquí.** Viaja en una cookie `httpOnly` que este código
ni siquiera puede leer, y por eso no hay nada parecido a
`localStorage.setItem("token", ...)`. Es lo que impide que un XSS se lleve la
sesión de un administrador.

**El dinero viaja en céntimos enteros** de punta a punta y solo se divide al
formatearlo, en `soles()`. Operar con el valor ya dividido es como salen los
totales con decimales imposibles.

## El sistema de diseño

Todo sale de `src/estilos/sistema.css`: colores, tipografía, radios, sombras y
curvas de animación. La paleta es la de los flyers de la casa —magenta y
violeta de neón sobre un negro que tira a morado, verde para lo que sale bien—
y la letra, **Unbounded** para la marca y los titulares e **Inter** para todo
lo demás (empaquetadas con `@fontsource`, sin depender de Google).

Las pantallas propias usan CSS con clases en castellano (`App.css`,
`publico.css`, `panel.css`, `barra.css`, `puerta.css`). Las piezas que vinieron
del sistema anterior —la portada, el editor del local, la vista 3D, el conserje
y la bandeja de la IA— usan Tailwind, cuyos colores (`bg-surface`,
`text-acento-text`…) apuntan a los mismos tokens. Tailwind entra **sin su reset
global**, solo dentro de un contenedor `.tw`, y todo él va en `@layer`: si
alguna vez chocan, gana el CSS propio.

### Movimiento

Sigue los criterios de Emil Kowalski (`emil-design-eng`):

- Todo lo que se pulsa se hunde un poco (`scale(0.97)`) en 100-160 ms.
- Solo se anima `transform` y `opacity`; nunca `transition: all`.
- Curvas propias (`--ease-out`), nada de `ease-in`, y nada por encima de 300 ms.
- Los `:hover` van dentro de `@media (hover: hover) and (pointer: fine)`: en el
  móvil no se quedan pegados.
- Lo que se usa decenas de veces por noche (las teclas de la barra, las filas
  de las tablas) casi no se mueve.
- `prefers-reduced-motion` cambia los desplazamientos por fundidos.

### Librerías

- **Sonner** para los avisos de «guardado», «aprobada», «no se pudo».
- **recharts** para las gráficas del resumen, con paleta validada contra la
  superficie oscura (magenta y violeta, distinguibles con daltonismo).
- **lucide-react** para los iconos del menú.

## Estado

**Migrado entero.** Todas las pantallas del sistema anterior están aquí, contra
la API de Spring Boot.

Lo único que no se trajo es el **tema claro**: el sistema anterior tenía un
conmutador día/noche, y aquí la web es solo oscura.
