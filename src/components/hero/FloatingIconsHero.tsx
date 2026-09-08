import { motion } from 'framer-motion';
import {
  BarChart3,
  Target,
  Zap,
  TrendingUp,
  PieChart,
  Activity,
  LineChart,
  DollarSign,
  Eye,
  MousePointer,
  Users,
  Sparkles,
} from 'lucide-react';
import FloatingIcon from './FloatingIcon';
import { Button } from '@/components/ui/button';

const icons = [
  { icon: BarChart3, x: '15%', y: '20%', delay: 0, duration: 18, color: 'text-blue-500' },
  { icon: Target, x: '85%', y: '25%', delay: 2, duration: 22, color: 'text-purple-500' },
  { icon: Zap, x: '10%', y: '70%', delay: 4, duration: 20, color: 'text-yellow-500' },
  { icon: TrendingUp, x: '90%', y: '60%', delay: 1, duration: 24, color: 'text-green-500' },
  { icon: PieChart, x: '20%', y: '45%', delay: 3, duration: 19, color: 'text-pink-500' },
  { icon: Activity, x: '75%', y: '80%', delay: 5, duration: 21, color: 'text-cyan-500' },
  { icon: LineChart, x: '30%', y: '85%', delay: 2, duration: 23, color: 'text-indigo-500' },
  { icon: DollarSign, x: '80%', y: '40%', delay: 4, duration: 20, color: 'text-emerald-500' },
  { icon: Eye, x: '25%', y: '60%', delay: 1, duration: 22, color: 'text-violet-500' },
  { icon: MousePointer, x: '70%', y: '15%', delay: 3, duration: 19, color: 'text-orange-500' },
  { icon: Users, x: '40%', y: '20%', delay: 0, duration: 25, color: 'text-rose-500' },
  { icon: Sparkles, x: '60%', y: '75%', delay: 2, duration: 18, color: 'text-amber-500' },
];

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

export default function FloatingIconsHero({
  title = 'Ad Audit',
  subtitle = 'Intelligent and Automated',
  description = 'Monitor, analyze, and optimize your ad campaigns in real time with AI-powered insights.',
  primaryCta,
  secondaryCta,
}: FloatingIconsHeroProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    },
  } as const;

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Floating icons background */}
      <div className="absolute inset-0 pointer-events-none">
        {icons.map((iconConfig, index) => (
          <FloatingIcon
            key={index}
            icon={iconConfig.icon}
            x={iconConfig.x}
            y={iconConfig.y}
            delay={iconConfig.delay}
            duration={iconConfig.duration}
            color={iconConfig.color}
            size={32}
          />
        ))}
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Radial gradient for depth */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/60 pointer-events-none" />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        {/* Badge */}
        <motion.div variants={itemVariants} className="inline-flex mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Powered by AI
            </span>
          </div>
        </motion.div>

        {/* Main title */}
        <motion.h1
          variants={itemVariants}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4"
        >
          <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
            {title}
          </span>
          <br />
          <span className="bg-gradient-to-r from-primary via-purple-500 to-cyan-500 bg-clip-text text-transparent">
            {subtitle}
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
        >
          {description}
        </motion.p>

        {/* CTAs */}
        {(primaryCta || secondaryCta) && (
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {primaryCta && (
              <Button
                size="lg"
                onClick={primaryCta.onClick}
                className="relative overflow-hidden group px-8"
              >
                {/* Button shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <span className="relative z-10">{primaryCta.text}</span>
              </Button>
            )}

            {secondaryCta && (
              <Button
                size="lg"
                variant="outline"
                onClick={secondaryCta.onClick}
                className="px-8"
              >
                {secondaryCta.text}
              </Button>
            )}
          </motion.div>
        )}

        {/* Stats or features (optional) */}
        <motion.div
          variants={itemVariants}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
        >
          {[
            { label: 'Campaigns Monitored', value: '500+' },
            { label: 'Average Savings', value: '30%' },
            { label: 'Time Saved', value: '10h/wk' },
            { label: 'Real-Time Alerts', value: '24/7' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05 }}
              className="group"
            >
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent group-hover:from-purple-500 group-hover:to-cyan-500 transition-all duration-300">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
