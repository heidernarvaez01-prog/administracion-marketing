import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FloatingIconProps {
  icon: LucideIcon;
  delay?: number;
  duration?: number;
  x?: string;
  y?: string;
  color?: string;
  size?: number;
}

export default function FloatingIcon({
  icon: Icon,
  delay = 0,
  duration = 20,
  x = '50%',
  y = '50%',
  color = 'text-primary',
  size = 24,
}: FloatingIconProps) {
  return (
    <motion.div
      className={`absolute ${color} opacity-20`}
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.3, 0.15, 0.25, 0],
        scale: [0.8, 1.2, 1, 1.1, 0.9],
        x: [0, 30, -20, 40, 0],
        y: [0, -40, 30, -30, 0],
        rotate: [0, 10, -10, 5, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Icon size={size} />
    </motion.div>
  );
}
