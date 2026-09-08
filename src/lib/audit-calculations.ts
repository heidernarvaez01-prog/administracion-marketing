import { countBusinessDays, countRemainingBusinessDays, countElapsedBusinessDays } from './business-days';

type TipoCalendario = 'corridos' | 'lun_vie' | 'lun_sab';

// Map tipo_calendario to the lab_days format used by business-days lib
function toLabDays(tipo: TipoCalendario): 'mon_fri' | 'mon_sat' | 'all' {
  switch (tipo) {
    case 'lun_vie': return 'mon_fri';
    case 'lun_sab': return 'mon_sat';
    case 'corridos': return 'all';
  }
}

export interface AuditMetrics {
  diasTotales: number;
  diasTranscurridos: number;
  diasRestantes: number;
  diasLaboralesRestantes: number;
  gastoActual: number;
  porcentajeGastado: number;
  presupuestoRestante: number;
  presupuestoDiarioIdeal: number;
  gastoEsperado: number;
  gastoDiarioActual: number;
  porcentajeTiempo: number;
  pacingStatus: 'OK' | 'SUBGASTANDO' | 'SOBREGASTANDO';
  pacingPct: number;
}

export function calculateAuditMetrics(
  presupuestoTotal: number,
  fechaInicio: string,
  fechaFin: string,
  tipoCalendario: TipoCalendario,
  gastoActual: number,
): AuditMetrics {
  const today = new Date();
  const labDays = toLabDays(tipoCalendario);

  const diasTotales = countBusinessDays(fechaInicio, fechaFin, labDays);
  const diasTranscurridos = countElapsedBusinessDays(fechaInicio, today, labDays);
  const diasRestantes = countRemainingBusinessDays(today, fechaFin, labDays);
  const diasLaboralesRestantes = diasRestantes;

  const porcentajeGastado = presupuestoTotal > 0 ? (gastoActual / presupuestoTotal) * 100 : 0;
  const presupuestoRestante = presupuestoTotal - gastoActual;
  const presupuestoDiarioIdeal = diasLaboralesRestantes > 0 ? presupuestoRestante / diasLaboralesRestantes : 0;

  // Expected spend based on elapsed time proportion
  const gastoEsperado = diasTotales > 0 ? (diasTranscurridos / diasTotales) * presupuestoTotal : 0;
  const gastoDiarioActual = diasTranscurridos > 0 ? gastoActual / diasTranscurridos : 0;
  const porcentajeTiempo = diasTotales > 0 ? (diasTranscurridos / diasTotales) * 100 : 0;

  // Pacing: compare actual vs expected
  const pacingPct = gastoEsperado > 0 ? ((gastoActual - gastoEsperado) / gastoEsperado) * 100 : 0;

  let pacingStatus: 'OK' | 'SUBGASTANDO' | 'SOBREGASTANDO' = 'OK';
  if (pacingPct > 10) {
    pacingStatus = 'SOBREGASTANDO';
  } else if (pacingPct < -10) {
    pacingStatus = 'SUBGASTANDO';
  }

  return {
    diasTotales,
    diasTranscurridos,
    diasRestantes,
    diasLaboralesRestantes,
    gastoActual,
    porcentajeGastado,
    presupuestoRestante,
    presupuestoDiarioIdeal,
    gastoEsperado,
    gastoDiarioActual,
    porcentajeTiempo,
    pacingStatus,
    pacingPct,
  };
}

export function getTipoCalendarioLabel(tipo: TipoCalendario): string {
  switch (tipo) {
    case 'corridos': return 'Todos los días';
    case 'lun_vie': return 'Lunes a viernes';
    case 'lun_sab': return 'Lunes a sábado';
  }
}
