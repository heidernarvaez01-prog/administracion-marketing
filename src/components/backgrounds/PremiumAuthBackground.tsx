import { motion } from 'framer-motion';
import AnimatedMeshGradient from './AnimatedMeshGradient';
import AnimatedGrid from './AnimatedGrid';
import GlowOrb from './GlowOrb';

interface PremiumAuthBackgroundProps {
  variant?: 'mesh' | 'grid' | 'orbs' | 'combined';
}

export default function PremiumAuthBackground({ variant = 'combined' }: PremiumAuthBackgroundProps) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />

      {/* Mesh gradient variant */}
      {(variant === 'mesh' || variant === 'combined') && <AnimatedMeshGradient />}

      {/* Grid variant */}
      {variant === 'grid' && <AnimatedGrid />}

      {/* Orbs variant */}
      {(variant === 'orbs' || variant === 'combined') && (
        <>
          <GlowOrb
            color="rgba(59, 130, 246, 0.4)"
            size={600}
            blur={120}
            opacity={0.3}
            left="20%"
            top="30%"
            delay={0}
          />
          <GlowOrb
            color="rgba(168, 85, 247, 0.3)"
            size={500}
            blur={100}
            opacity={0.25}
            left="75%"
            top="60%"
            delay={1}
          />
          <GlowOrb
            color="rgba(34, 211, 238, 0.25)"
            size={450}
            blur={90}
            opacity={0.2}
            left="50%"
            top="80%"
            delay={2}
          />
        </>
      )}

      {/* Subtle scanline effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 50%, rgba(255, 255, 255, 0.02) 50%)',
          backgroundSize: '100% 4px',
        }}
        animate={{ backgroundPosition: ['0 0', '0 4px'] }}
        transition={{ duration: 0.1, repeat: Infinity, ease: 'linear' }}
      />

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/60" />
    </div>
  );
}
