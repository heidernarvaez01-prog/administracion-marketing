import { motion } from 'framer-motion';

interface GlowOrbProps {
  color?: string;
  size?: number;
  blur?: number;
  opacity?: number;
  left?: string;
  top?: string;
  delay?: number;
}

export default function GlowOrb({
  color = 'rgb(59, 130, 246)',
  size = 400,
  blur = 100,
  opacity = 0.3,
  left = '50%',
  top = '50%',
  delay = 0,
}: GlowOrbProps) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left,
        top,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [opacity * 0.5, opacity, opacity * 0.5],
        x: [0, 50, -50, 0],
        y: [0, -50, 50, 0],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    >
      <div
        className="w-full h-full rounded-full"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
        }}
      />
    </motion.div>
  );
}
