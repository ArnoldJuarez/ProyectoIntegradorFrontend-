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

## Las dos zonas

**Pública** — cualquiera, sin cuenta:

| Ruta | Qué hay |
|---|---|
| `/` | Portada: próxima noche, agenda, promo de cumpleaños, aviso de cartel, el local |
| `/agenda` | Todas las fechas anunciadas, agrupadas por mes |
| `/evento/:slug` | Cartel, horarios, entradas y solicitud de reservado |

**Panel** — pide sesión:

| Ruta | Qué hay |
|---|---|
| `/panel/eventos` | Las noches con su aforo vendido y lo recaudado |
| `/panel/eventos/:slug` | Venta por tipo de entrada |
| `/panel/clientes` | Listado con buscador |
| `/panel/clientes/:id` | Ficha con historial de interacciones |
| `/panel/inventario` | Productos de barra y almacén |

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
  publico/        La web del cliente.
  paginas/        El panel del personal.
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

## Estado

Van 8 pantallas de unas 25. Pendiente: compra de entradas, escáner de puerta,
TPV de barra, caja, segmentos del CRM, el chat del conserje y el local en 3D.
