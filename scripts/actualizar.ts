// Corre la tarea programada a mano: `npm run actualizar`.
// Trae partidos y cuotas reales de football-data.co.uk (necesita internet).
import { actualizarTodo } from '../server/actualizar';

console.log(await actualizarTodo());
process.exit(0);
