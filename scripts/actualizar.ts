// Corre la tarea programada a mano: `npm run actualizar`.
// Con API_FOOTBALL_KEY usa datos reales; sin ella (solo en desarrollo), simulados.
import { actualizarTodo } from '../server/actualizar';

console.log(await actualizarTodo());
process.exit(0);
