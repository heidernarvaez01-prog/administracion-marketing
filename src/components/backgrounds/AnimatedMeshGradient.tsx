import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface GradientOrb {
  id: number;
  initialX: number;
  initialY: number;
  color: string;
  size: number;
  duration: number;
}

export default function AnimatedMeshGradient() {
  const [orbs] = useState<GradientOrb[]>([
    {
      id: 1,
      initialX: 10,
      initialY: 20,
      color: 'rgba(59, 130, 246, 0.4)', // blue-500
      size: 600,
      duration: 20,
    },
    {
      id: 2,
      initialX: 70,
      initialY: 60,
      color: 'rgba(168, 85, 247, 0.4)', // purple-500
      size: 500,
      duration: 25,
    },
    {
      id: 3,
      initialX: 40,
      initialY: 80,
      color: 'rgba(34, 211, 238, 0.3)', // cyan-500
      size: 450,
      duration: 22,
    },
    {
      id: 4,
      initialX: 80,
      initialY: 10,
      color: 'rgba(99, 102, 241, 0.3)', // indigo-500
      size: 400,
      duration: 18,
    },
  ]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated gradient orbs */}
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full blur-3xl opacity-60"
          style={{
            width: orb.size,
            height: orb.size,
            background: orb.color,
            left: `${orb.initialX}%`,
            top: `${orb.initialY}%`,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            x: [0, 100, -50, 150, 0],
            y: [0, -80, 120, -60, 0],
            scale: [1, 1.2, 0.9, 1.1, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Radial gradient overlay for vignette */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/80" />
    </div>
  );
}
