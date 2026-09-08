import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { CalendarDays } from 'lucide-react';
import PageHero from '@/components/PageHero';
import './calendar-theme.css';

/**
 * Generic calendar page — styled after the "Aside" template's FullCalendar
 * widget (see src/pages/calendar-theme.css), not wired to any data source
 * yet. Once a concrete use case is defined (campaign windows, report
 * deliveries, etc.) an `events` array built from the relevant table can be
 * passed straight into <FullCalendar events={...} />.
 */
export default function CalendarPage() {
  return (
    <div className="space-y-5 w-full min-w-0">
      <PageHero
        icon={CalendarDays}
        title="Calendario"
        subtitle="Vista de calendario del equipo. Por ahora es un lienzo en blanco — cuando definamos qué debe mostrar (campañas activas, envíos de reportes, etc.) se conecta a esos datos."
      />

      <div className="app-calendar rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale={esLocale}
          height="auto"
          events={[]}
        />
      </div>
    </div>
  );
}
