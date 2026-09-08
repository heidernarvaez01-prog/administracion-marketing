// Plataformas (fuentes / "connectors") que esperamos encontrar en la
// respuesta de Windsor.ai.
//
// `id` DEBE coincidir exactamente con el valor que Windsor.ai devuelve en
// los campos "datasource" / "source" para esa fuente (es el nombre técnico
// del connector, ej. "facebook", "google_ads", "tiktok_ads").
// `nombre` es solo para mostrar en el dashboard de Eclan.
//
// Confirmado con datos reales de la cuenta (muestra de prueba, last_90d):
// 6.381 filas, 100% con datasource = "facebook" (2 cuentas: "Kemmerling" y
// "Clínica Hacienda Metamorfosis"). Por eso hoy solo hay una plataforma
// activa en este array.
//
// Para conectar una plataforma nueva en el futuro: agrega UNA línea acá.
// No hace falta tocar index.ts — windsor-metrics recorre este array,
// busca cada `id` dentro de la respuesta de Windsor y arma el resto
// automáticamente (clicks, spend, impressions, cpc, cpm, conectado).

export interface Plataforma {
  /** Debe coincidir con el campo "datasource" que envía Windsor.ai */
  id: string;
  /** Nombre para mostrar en el dashboard (Eclan) */
  nombre: string;
}

export const PLATAFORMAS: Plataforma[] = [
  { id: "facebook", nombre: "Facebook Ads" },

  // Ejemplos listos para descomentar cuando conectes la plataforma en
  // Windsor.ai (usa el nombre exacto del connector, ver
  // https://windsor.ai/data-sources/):
  // { id: "google_ads", nombre: "Google Ads" },
  // { id: "tiktok_ads", nombre: "TikTok Ads" },
  // { id: "linkedin_ads", nombre: "LinkedIn Ads" },
  // { id: "instagram", nombre: "Instagram" },
  // { id: "twitter_ads", nombre: "Twitter / X Ads" },
];
