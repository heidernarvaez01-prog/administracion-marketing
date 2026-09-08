import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LogIn, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { FloatingIconsHero } from '@/components/ui/floating-icons-hero-section';
import {
  IconMeta, IconGoogleAds, IconTikTok, IconLinkedIn, IconAnalytics, IconTargeting,
  IconCampaign, IconROI, IconConversion, IconAudience, IconCreative, IconOptimization,
  IconBudget, IconReporting, IconAI, IconAutomation,
} from '@/components/icons/AdIcons';

const adIcons = [
  { id: 1, icon: IconMeta, className: 'top-[10%] left-[10%]' },
  { id: 2, icon: IconGoogleAds, className: 'top-[15%] right-[8%]' },
  { id: 3, icon: IconTikTok, className: 'top-[75%] left-[8%]' },
  { id: 4, icon: IconLinkedIn, className: 'bottom-[8%] right-[12%]' },
  { id: 5, icon: IconAnalytics, className: 'top-[8%] left-[35%]' },
  { id: 6, icon: IconTargeting, className: 'top-[5%] right-[28%]' },
  { id: 7, icon: IconCampaign, className: 'bottom-[12%] left-[28%]' },
  { id: 8, icon: IconROI, className: 'top-[42%] left-[12%]' },
  { id: 9, icon: IconConversion, className: 'top-[70%] right-[20%]' },
  { id: 10, icon: IconAudience, className: 'top-[85%] left-[65%]' },
  { id: 11, icon: IconCreative, className: 'top-[48%] right-[8%]' },
  { id: 12, icon: IconOptimization, className: 'top-[52%] left-[5%]' },
  { id: 13, icon: IconBudget, className: 'top-[6%] left-[58%]' },
  { id: 14, icon: IconReporting, className: 'bottom-[6%] right-[42%]' },
  { id: 15, icon: IconAI, className: 'top-[28%] right-[18%]' },
  { id: 16, icon: IconAutomation, className: 'top-[62%] left-[35%]' },
];

type ActionType = 'invite' | 'recovery' | null;

// Invite / recovery links can arrive in three shapes depending on Supabase
// version: `?code=…` (PKCE), `?token_hash=…&type=…` (OTP verify), or the legacy
// `#access_token=…&type=…` hash. Parse all three, plus surface `?error_description`.
function parseAuthUrl() {
  if (typeof window === 'undefined') return {} as Record<string, string | null>;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const pick = (k: string) => url.searchParams.get(k) ?? hash.get(k);
  return {
    code: url.searchParams.get('code'),
    token_hash: pick('token_hash'),
    type: pick('type'),
    error: pick('error') ?? pick('error_code'),
    error_description: pick('error_description'),
  };
}

export default function AuthPage() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set-password mode (invite / recovery)
  const [actionType, setActionType] = useState<ActionType>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [processingLink, setProcessingLink] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const settingPassword = actionType !== null;

  // Process invite / recovery links once on mount.
  useEffect(() => {
    let cancelled = false;
    const params = parseAuthUrl();

    (async () => {
      try {
        if (params.error_description || params.error) {
          throw new Error(
            decodeURIComponent(params.error_description || params.error || 'Invalid link'),
          );
        }

        const rawType = params.type;
        const inferredType: ActionType =
          rawType === 'recovery' ? 'recovery' : rawType === 'invite' || rawType === 'signup' ? 'invite' : null;

        if (params.token_hash && rawType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: params.token_hash,
            type: rawType as 'invite' | 'recovery' | 'signup' | 'email',
          });
          if (error) throw error;
          if (!cancelled) setActionType(inferredType ?? 'invite');
          window.history.replaceState(null, '', window.location.pathname);
        } else if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
          if (!cancelled) setActionType(inferredType ?? 'invite');
          window.history.replaceState(null, '', window.location.pathname);
        } else if (inferredType) {
          // Legacy hash flow — Supabase auto-hydrates the session from the hash.
          if (!cancelled) setActionType(inferredType);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Link inválido o expirado';
        if (!cancelled) setLinkError(message);
      } finally {
        if (!cancelled) setProcessingLink(false);
      }
    })();

    // Supabase fires PASSWORD_RECOVERY when a recovery link is detected.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !cancelled) setActionType('recovery');
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    // Don't bounce invited/recovery users to the dashboard before they set a password.
    if (!authLoading && user && !settingPassword && !processingLink) navigate('/app', { replace: true });
  }, [user, authLoading, navigate, settingPassword, processingLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (isSignUp) setError('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
    setLoading(false);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setSaved(true);
    setLoading(false);
    window.history.replaceState(null, '', window.location.pathname);
    // Small pause so the success state is visible.
    setTimeout(() => {
      setActionType(null);
      navigate('/app', { replace: true });
    }, 900);
  };

  // Loading state while processing the invite/recovery link.
  if (processingLink) {
    return (
      <FloatingIconsHero icons={adIcons} showContent={false} className="min-h-screen">
        <div className="w-full max-w-sm px-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Loader2 className="h-7 w-7 text-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Verificando tu link…</p>
        </div>
      </FloatingIconsHero>
    );
  }

  // Link was invalid/expired — offer to go back to sign-in.
  if (linkError) {
    return (
      <FloatingIconsHero icons={adIcons} showContent={false} className="min-h-screen">
        <div className="w-full max-w-sm px-4">
          <Card className="backdrop-blur-xl bg-card/70 border-border/50 shadow-2xl p-6 space-y-4 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mx-auto">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Link no válido</h2>
            <p className="text-sm text-muted-foreground">{linkError}</p>
            <p className="text-xs text-muted-foreground">
              El link puede haber expirado o ya fue usado. Pídele a un administrador que te reenvíe la invitación.
            </p>
            <Button onClick={() => { setLinkError(null); }} className="w-full">Ir a inicio de sesión</Button>
          </Card>
        </div>
      </FloatingIconsHero>
    );
  }

  if (settingPassword) {
    return (
      <FloatingIconsHero icons={adIcons} showContent={false} className="min-h-screen">
        <div className="w-full max-w-sm px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              {saved ? <CheckCircle2 className="h-8 w-8 text-success" /> : <Sparkles className="h-8 w-8 text-primary" />}
            </div>
            <h1 className="text-2xl font-bold">
              {actionType === 'invite' ? '¡Bienvenido a Apache Studio!' : 'Nueva contraseña'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {actionType === 'invite'
                ? user?.email
                  ? <>Estás activando <strong>{user.email}</strong>. Elige una contraseña para entrar.</>
                  : 'Elige una contraseña para activar tu cuenta.'
                : 'Elige una nueva contraseña para tu cuenta.'}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <Card className="backdrop-blur-xl bg-card/60 border-border/50 shadow-2xl p-6 space-y-4">
              {saved ? (
                <div className="text-center py-4 space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                  <p className="text-sm font-medium">Contraseña guardada</p>
                  <p className="text-xs text-muted-foreground">Entrando a tu panel…</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Elige tu contraseña</h2>
                  </div>
                  <form onSubmit={handleSetPassword} className="space-y-3">
                    <Input
                      type="password"
                      placeholder="Nueva contraseña (mínimo 8 caracteres)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="bg-background/50"
                    />
                    <Input
                      type="password"
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-background/50"
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando…</> : 'Guardar y entrar'}
                    </Button>
                  </form>
                </>
              )}
            </Card>
          </motion.div>
        </div>
      </FloatingIconsHero>
    );
  }

  if (user) return <Navigate to="/app" replace />;

  return (
    <FloatingIconsHero icons={adIcons} showContent={false} className="min-h-screen">
      <div className="w-full max-w-sm px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 relative"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Sparkles className="h-8 w-8 text-primary" />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 bg-primary/30 blur-xl rounded-2xl"
            />
          </motion.div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Apache Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Plataforma de auditoría de anuncios</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="relative overflow-hidden backdrop-blur-xl bg-card/50 border-border/50 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
            <div className="relative z-10 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <LogIn className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50" />
                <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/50" />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Iniciar sesión'}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center transition-colors duration-200"
              >
                {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
              </button>
            </div>
          </Card>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground mt-6">Plataforma inteligente de auditoría de anuncios</p>
      </div>
    </FloatingIconsHero>
  );
}
