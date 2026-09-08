import { FaFacebook, FaTwitter, FaLinkedin, FaInstagram } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface SocialCardProps {
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram';
  metricLeft: string;
  metricRight: string;
  valueLeft: string;
  valueRight: string;
  index: number;
}

const platformConfig = {
  facebook: {
    icon: FaFacebook,
    gradient: 'bg-facebook-gradient',
    name: 'Facebook',
  },
  twitter: {
    icon: FaTwitter,
    gradient: 'bg-twitter-gradient',
    name: 'Twitter',
  },
  linkedin: {
    icon: FaLinkedin,
    gradient: 'bg-linkedin-gradient',
    name: 'LinkedIn',
  },
  instagram: {
    icon: FaInstagram,
    gradient: 'bg-instagram-gradient',
    name: 'Instagram',
  },
};

export function SocialCard({ platform, metricLeft, metricRight, valueLeft, valueRight, index }: SocialCardProps) {
  const config = platformConfig[platform];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className={`relative overflow-hidden rounded-lg ${config.gradient} text-white shadow-lg hover:shadow-xl transition-shadow`}
    >
      {/* Decorative background icon */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
        <Icon className="w-24 h-24" />
      </div>

      {/* Decorative wave SVG */}
      <svg
        className="absolute bottom-0 left-0 w-full opacity-20"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        style={{ height: '60px' }}
      >
        <path
          d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
          fill="currentColor"
        />
      </svg>

      <div className="relative p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">{config.name}</span>
        </div>

        <div className="flex items-center justify-around mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{valueLeft}</div>
            <div className="text-xs opacity-90 mt-1 uppercase tracking-wide">{metricLeft}</div>
          </div>
          <div className="h-12 w-px bg-white/30" />
          <div className="text-center">
            <div className="text-2xl font-bold">{valueRight}</div>
            <div className="text-xs opacity-90 mt-1 uppercase tracking-wide">{metricRight}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function SocialCards() {
  const socialData = [
    {
      platform: 'facebook' as const,
      metricLeft: 'Friends',
      metricRight: 'Feeds',
      valueLeft: '89K',
      valueRight: '459',
    },
    {
      platform: 'twitter' as const,
      metricLeft: 'Followers',
      metricRight: 'Tweets',
      valueLeft: '973K',
      valueRight: '1.792',
    },
    {
      platform: 'linkedin' as const,
      metricLeft: 'Contacts',
      metricRight: 'Feeds',
      valueLeft: '500+',
      valueRight: '292',
    },
    {
      platform: 'instagram' as const,
      metricLeft: 'Followers',
      metricRight: 'Posts',
      valueLeft: '2.6M',
      valueRight: '1.869',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {socialData.map((data, index) => (
        <SocialCard key={data.platform} {...data} index={index} />
      ))}
    </div>
  );
}
