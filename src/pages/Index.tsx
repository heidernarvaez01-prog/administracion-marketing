import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// La interfaz real es Eclan (public/eclan/xhtml), no esta app React — ver
// CLAUDE.md. Antes "/" mandaba directo a analytics.html; ahora respeta la
// sesión (mismo proyecto de Supabase que usa AuditClient en Eclan).
const LOGIN_URL = "/eclan/xhtml/page-login.html";
const APP_URL = "/eclan/xhtml/clientes.html";

const Index = () => {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      window.location.replace(session ? APP_URL : LOGIN_URL);
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-semibold">Apache 360</h1>
        <p className="text-muted-foreground">
          Entrando…{" "}
          <a className="underline" href={LOGIN_URL}>
            entrar ahora
          </a>
        </p>
      </div>
    </main>
  );
};

export default Index;
