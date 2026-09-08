import { useEffect } from "react";

const PANEL_URL = "/eclan/xhtml/analytics.html";

const Index = () => {
  useEffect(() => {
    window.location.replace(PANEL_URL);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-semibold">Panel de campañas</h1>
        <p className="text-muted-foreground">
          Abriendo el panel…{" "}
          <a className="underline" href={PANEL_URL}>
            entrar ahora
          </a>
        </p>
      </div>
    </main>
  );
};

export default Index;
