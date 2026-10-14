import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Menu, FileText, Network, CalendarClock } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// --- Portado desde Ad-Audit-Platform (login con prioridad + resto de la
// plantilla, montado bajo /app). El código queda tal cual en el repo, pero
// "/" (Index.tsx) y casi todo "/app"/"/app/*" (AdAuditThemeScope, más
// abajo) ya no renderizan esta app React — redirigen a Eclan
// (page-login.html o clientes.html, según haya sesión). La interfaz real
// es Eclan. Dos rutas siguen siendo React de verdad: /app/auth (único
// lugar que sabe procesar los links de invitación/recuperación — Eclan no
// tiene ese paso todavía) y /app/unsubscribe (link público de los
// correos); ambas usan AuthThemeScope, que sigue aplicando la clase
// .ad-audit-theme igual que antes. ---
import { useAuth } from "@/hooks/useAuth";
import AppSidebar from "@/components/AppSidebar";
import NotificationCenter from "@/components/NotificationCenter";
import ClientPicker from "@/components/ClientPicker";
import WeeklyReportPage from "@/pages/WeeklyReportPage";
import ClientsPage from "@/pages/ClientsPage";
import AuditPage from "@/pages/AuditPage";
import AuditDetailPage from "@/pages/AuditDetailPage";
import AuthPage from "@/pages/AuthPage";
import BriefPage from "@/pages/BriefPage";
import ClusterPage from "@/pages/ClusterPage";
import AskAIPage from "@/pages/AskAIPage";
import CalendarPage from "@/pages/CalendarPage";
import AlertsPage from "@/pages/AlertsPage";
import AdminPage from "@/pages/AdminPage";
import HowItWorksPage from "@/pages/HowItWorksPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import logo from "@/assets/apache-studio-logo.png.asset.json";

const queryClient = new QueryClient();

/** La interfaz que ve el cliente es Eclan (public/eclan/xhtml), no esta app
 *  React — ver CLAUDE.md. /app es el elemento compartido de TODA esa rama
 *  de rutas (auth, admin, clientes, auditoría, etc.); en vez de montar el
 *  Outlet y dejar entrar a las páginas React, redirige a Eclan: a
 *  page-login.html si no hay sesión, a clientes.html si ya la hay (mismo
 *  proyecto de Supabase, misma sesión en localStorage que usa AuditClient
 *  en Eclan). El código de las páginas de /app queda en el repo tal cual,
 *  sin borrar — solo deja de ser alcanzable por navegación normal. */
function AdAuditThemeScope() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    window.location.replace(user ? "/eclan/xhtml/clientes.html" : "/eclan/xhtml/page-login.html");
  }, [user, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Aplica el theme "Aside" (colores/tipografía) para las dos rutas de /app
 *  que todavía renderizan React de verdad (AuthPage, UnsubscribePage) —
 *  mismo useEffect que antes tenía AdAuditThemeScope para toda la rama.
 *  La clase va en <html> (no en un div anidado) porque tanto los charts de
 *  ECharts (src/lib/echarts-theme.ts lee
 *  getComputedStyle(document.documentElement)) como el contenido de Radix
 *  que hace portal (Select/Dialog/Sheet/Tooltip/Toast, que se montan en
 *  document.body, fuera del árbol de React) necesitan que las variables
 *  CSS vivan en la raíz del documento, no en un descendiente — igual que
 *  .dark, que useTheme() también aplica sobre <html>. Ver src/index.css —
 *  clase .ad-audit-theme. */
function AuthThemeScope({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("ad-audit-theme");
    return () => {
      document.documentElement.classList.remove("ad-audit-theme");
    };
  }, []);

  return <>{children}</>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex">
        <AppSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-12 flex items-center justify-between px-3 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Abrir menú">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[240px] border-r-0">
              <div onClick={() => setMobileOpen(false)} className="h-full">
                <AppSidebar forceExpanded hideToggle />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo.url} alt="Apache Studio" className="h-6 w-6 object-contain" />
            <span className="text-sm font-semibold truncate">Apache Studio</span>
          </div>
          <div className="w-8" />
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto min-w-0">{children}</main>
      </div>
      <NotificationCenter />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/app/auth" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Sitio existente — sin cambios */}
          <Route path="/" element={<Index />} />

          {/* Únicos dos caminos de /app que SÍ se renderizan de verdad:
              /app/auth procesa los links de invitación/recuperación
              (verifyOtp/exchangeCodeForSession + updateUser — Eclan no
              tiene ese paso todavía) y /app/unsubscribe es el link público
              de los correos. Van FUERA de <AdAuditThemeScope> (si quedaran
              anidados ahí, nunca se montarían), pero con AuthThemeScope
              para conservar el theme "Aside" que ya tenían. */}
          <Route path="/app/auth" element={<AuthThemeScope><AuthPage /></AuthThemeScope>} />
          <Route path="/app/unsubscribe" element={<AuthThemeScope><UnsubscribePage /></AuthThemeScope>} />

          {/* Ad-Audit-Platform, portado completo bajo /app */}
          <Route path="/app" element={<AdAuditThemeScope />}>
            <Route index element={<RequireAuth><AppShell><ClientsPage /></AppShell></RequireAuth>} />
            <Route path="client/:clientId" element={<RequireAuth><AppShell><AuditPage /></AppShell></RequireAuth>} />
            <Route path="audit/:id" element={<RequireAuth><AppShell><AuditDetailPage /></AppShell></RequireAuth>} />
            <Route
              path="brief"
              element={
                <RequireAuth>
                  <AppShell>
                    <ClientPicker
                      title="Brief de marca"
                      subtitle="La historia de cada marca: quiénes son, qué venden y a quién le hablan. Alimenta las estrategias de IA."
                      basePath="/app/brief"
                      icon={FileText}
                      mode="brief"
                    />
                  </AppShell>
                </RequireAuth>
              }
            />
            <Route path="brief/:clientId" element={<RequireAuth><AppShell><BriefPage /></AppShell></RequireAuth>} />
            <Route
              path="clusters"
              element={
                <RequireAuth>
                  <AppShell>
                    <ClientPicker
                      title="Clusters de proyección"
                      subtitle="Estrategias completas de marketing con IA para cada cliente, construidas desde su brief y los resultados reales de campaña."
                      basePath="/app/clusters"
                      icon={Network}
                      mode="clusters"
                    />
                  </AppShell>
                </RequireAuth>
              }
            />
            <Route path="clusters/:clientId" element={<RequireAuth><AppShell><ClusterPage /></AppShell></RequireAuth>} />
            <Route
              path="weekly-report"
              element={
                <RequireAuth>
                  <AppShell>
                    <ClientPicker
                      title="Reporte semanal de rendimiento"
                      subtitle="Un resumen claro de cómo les fue a las campañas de cada cliente esta semana, entregado a su correo cada lunes."
                      basePath="/app/weekly-report"
                      icon={CalendarClock}
                      mode="weekly"
                    />
                  </AppShell>
                </RequireAuth>
              }
            />
            <Route path="weekly-report/:clientId" element={<RequireAuth><AppShell><WeeklyReportPage /></AppShell></RequireAuth>} />
            <Route path="ask" element={<RequireAuth><AppShell><AskAIPage /></AppShell></RequireAuth>} />
            <Route path="calendar" element={<RequireAuth><AppShell><CalendarPage /></AppShell></RequireAuth>} />
            <Route path="alerts" element={<RequireAuth><AppShell><AlertsPage /></AppShell></RequireAuth>} />
            <Route path="admin" element={<RequireAuth><AppShell><AdminPage /></AppShell></RequireAuth>} />
            <Route path="how-it-works" element={<RequireAuth><AppShell><HowItWorksPage /></AppShell></RequireAuth>} />
            <Route path="*" element={<AppShell><NotFound /></AppShell>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
