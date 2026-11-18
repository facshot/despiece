import './style.css';
import { Viewer } from './engine/Viewer';
import { mountUI } from './engine/ui';
import { MATERIALS } from './materials/library';
import { airConditioner } from './models/air-conditioner';

// Para mostrar otro objeto, importá otro ModelDef y pasalo acá (ver README → "Agregar un modelo").
const MODELS = { [airConditioner.id]: airConditioner };

async function start() {
  const app = document.getElementById('app')!;
  const stage = document.getElementById('stage')!;
  const id = new URLSearchParams(location.search).get('model') ?? airConditioner.id;
  const model = MODELS[id] ?? airConditioner;
  document.title = `${model.name} · Despiece`;

  const viewer = new Viewer(stage, model, MATERIALS);
  await viewer.load();
  mountUI(app, viewer);
  app.classList.add('ready');
  // Expuesto para depurar desde la consola: window.viewer.setExplode(1)
  (window as unknown as { viewer: Viewer }).viewer = viewer;
}

start().catch((err) => {
  console.error(err);
  document.getElementById('stage')!.innerHTML = `<p class="error">No se pudo iniciar el visor 3D: ${String(err.message ?? err)}</p>`;
});
