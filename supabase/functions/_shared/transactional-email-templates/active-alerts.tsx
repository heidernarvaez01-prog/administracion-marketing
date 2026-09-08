import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Apache Studio Ad Audit'

interface AlertItem {
  campaign: string
  account: string
  platform?: string | null
  level: 'critical' | 'warning' | 'ok'
  message: string
  spend: number
  budget: number
  spendPct: number
  timePct: number
}

interface ActiveAlertsProps {
  recipientName?: string
  criticalCount?: number
  warningCount?: number
  alerts?: AlertItem[]
}

const ActiveAlertsEmail = ({
  recipientName,
  criticalCount = 0,
  warningCount = 0,
  alerts = [],
}: ActiveAlertsProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>
      {criticalCount} alertas críticas y {warningCount} advertencias activas
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Resumen de alertas de pacing</Heading>
        <Text style={text}>
          {recipientName ? `Hola ${recipientName}, ` : 'Hola, '}
          este es el resumen de alertas activas en tus campañas auditadas.
        </Text>

        <Section style={statsRow}>
          <Text style={statCritical}>{criticalCount} críticas</Text>
          <Text style={statWarning}>{warningCount} advertencias</Text>
        </Section>

        <Hr style={hr} />

        {alerts.length === 0 ? (
          <Text style={text}>No hay alertas activas en este momento. 🎉</Text>
        ) : (
          alerts.map((a, i) => (
            <Section key={i} style={alertBox}>
              <Text style={alertTitle}>
                {a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟡' : '🟢'}{' '}
                {a.campaign}
              </Text>
              <Text style={alertMeta}>
                {a.account} · {a.platform ?? '—'}
              </Text>
              <Text style={alertMsg}>{a.message}</Text>
              <Text style={alertMeta}>
                ${a.spend.toLocaleString()} / ${a.budget.toLocaleString()} ·{' '}
                {a.spendPct}% gasto · {a.timePct}% tiempo
              </Text>
            </Section>
          ))
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Enviado por {SITE_NAME}. Configura tus preferencias de alertas en la app.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ActiveAlertsEmail,
  subject: (data: Record<string, any>) => {
    const c = data.criticalCount ?? 0
    const w = data.warningCount ?? 0
    if (c > 0) return `🔴 ${c} alertas críticas de pacing`
    if (w > 0) return `🟡 ${w} advertencias de pacing`
    return 'Resumen de alertas de pacing'
  },
  displayName: 'Alertas activas de pacing',
  previewData: {
    recipientName: 'Equipo',
    criticalCount: 2,
    warningCount: 1,
    alerts: [
      {
        campaign: 'Campaña Q4 - Conversiones',
        account: 'Cuenta Demo',
        platform: 'Meta',
        level: 'critical',
        message: 'Sobre-ejecución del 25% (gasto 75% vs tiempo 50%)',
        spend: 7500,
        budget: 10000,
        spendPct: 75,
        timePct: 50,
      },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.5', margin: '0 0 16px' }
const statsRow = { margin: '12px 0' }
const statCritical = { display: 'inline-block', marginRight: '12px', padding: '6px 12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }
const statWarning = { display: 'inline-block', padding: '6px 12px', backgroundColor: '#fef3c7', color: '#a16207', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '20px 0' }
const alertBox = { padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', margin: '0 0 10px', borderLeft: '3px solid #2563eb' }
const alertTitle = { fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }
const alertMeta = { fontSize: '12px', color: '#64748b', margin: '2px 0' }
const alertMsg = { fontSize: '13px', color: '#1e293b', margin: '4px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '20px 0 0' }
