// Punto de entrada de la API en Vercel. vercel.json reescribe /api/* hacia acá.
import { manejar } from '../server/router';

export const maxDuration = 60;

export const GET = manejar;
export const POST = manejar;
export const PUT = manejar;
export const DELETE = manejar;
