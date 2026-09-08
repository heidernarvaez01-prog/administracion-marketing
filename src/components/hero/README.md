# Floating Icons Hero Section

Componente de hero section premium con iconos flotantes animados, inspirado en 21st.dev, Linear y Stripe.

## Componentes

### FloatingIcon
Icono individual animado con movimiento flotante y rotación.

**Props:**
```typescript
interface FloatingIconProps {
  icon: LucideIcon;        // Icono de lucide-react
  delay?: number;          // Delay antes de iniciar animación (segundos)
  duration?: number;       // Duración del loop (segundos)
  x?: string;              // Posición horizontal (%, px, etc)
  y?: string;              // Posición vertical (%, px, etc)
  color?: string;          // Clase de color Tailwind
  size?: number;           // Tamaño del icono (px)
}
```

### FloatingIconsHero
Sección hero completa con iconos flotantes de fondo y contenido centrado.

**Props:**
```typescript
interface FloatingIconsHeroProps {
  title?: string;
  subtitle?: string;
  description?: string;
  primaryCta?: {
    text: string;
    onClick: () => void;
  };
  secondaryCta?: {
    text: string;
    onClick: () => void;
  };
}
```

## Uso

### Básico
```tsx
import { FloatingIconsHero } from '@/components/hero';

function LandingPage() {
  return (
    <FloatingIconsHero
      title="Tu Título"
      subtitle="Tu Subtítulo"
      description="Tu descripción"
    />
  );
}
```

### Con CTAs
```tsx
import { FloatingIconsHero } from '@/components/hero';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <FloatingIconsHero
      title="Auditoría Publicitaria"
      subtitle="Inteligente y Automatizada"
      description="Monitorea tus campañas en tiempo real"
      primaryCta={{
        text: 'Comenzar Ahora',
        onClick: () => navigate('/auth'),
      }}
      secondaryCta={{
        text: 'Ver Demo',
        onClick: () => navigate('/demo'),
      }}
    />
  );
}
```

### Personalizar Iconos
Edita el array `icons` en `FloatingIconsHero.tsx`:

```tsx
const icons = [
  { 
    icon: BarChart3,     // Cualquier icono de lucide-react
    x: '15%',            // Posición horizontal
    y: '20%',            // Posición vertical
    delay: 0,            // Delay en segundos
    duration: 18,        // Duración del loop
    color: 'text-blue-500' // Color Tailwind
  },
  // ... más iconos
];
```

## Características

✨ **12 iconos flotantes** con animaciones independientes  
🎨 **Gradientes en títulos** con efecto premium  
🎭 **Animaciones Framer Motion** con stagger y spring physics  
💫 **Shimmer effect** en botones primarios  
📊 **Stats section** con 4 métricas animadas  
🌐 **Grid overlay** sutil en fondo  
🎯 **Radial gradient** para profundidad  
📱 **Responsive** mobile-first  

## Animaciones

- **Iconos flotantes:** Movimiento x/y, rotación, scale y opacity en loop infinito
- **Contenido:** Stagger animation (aparece secuencialmente)
- **Títulos:** Gradient text con clip-path
- **Botones:** Shimmer horizontal loop + hover effects
- **Stats:** Hover scale y gradient transition

## Performance

- GPU-accelerated animations (transform, opacity)
- 60 FPS en todos los dispositivos
- Lazy loading de iconos
- Animaciones optimizadas con Framer Motion

## Demo

Visita: `http://localhost:8081/hero-demo`

## Personalización

### Colores
Modifica los colores en el array `icons` usando clases Tailwind:
- `text-blue-500`, `text-purple-500`, `text-pink-500`, etc.

### Cantidad de iconos
Agrega/elimina objetos en el array `icons`

### Stats
Modifica el array de stats en la sección final del componente

### Backgrounds
Ajusta los gradientes y overlays en el JSX del componente

## Dependencias

- `framer-motion` ✅ Instalado
- `lucide-react` ✅ Instalado
- `@radix-ui/react-slot` ✅ Instalado
- `class-variance-authority` ✅ Instalado

## Ejemplos de Iconos Disponibles

```tsx
import {
  BarChart3, Target, Zap, TrendingUp, PieChart,
  Activity, LineChart, DollarSign, Eye, MousePointer,
  Users, Sparkles, Rocket, Shield, Lock, Globe,
  // ... todos los iconos de lucide-react
} from 'lucide-react';
```

## Estructura de Archivos

```
src/components/hero/
├── FloatingIcon.tsx          # Icono flotante individual
├── FloatingIconsHero.tsx     # Hero section completa
├── index.ts                  # Exports
└── README.md                 # Esta documentación
```
