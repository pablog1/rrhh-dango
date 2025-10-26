interface StatsCardProps {
  label: string;
  value: string | number;
  variant?: 'blue' | 'red' | 'green' | 'gray';
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses = {
  blue: {
    bg: 'bg-blue-50',
    labelColor: 'text-blue-600',
    valueColor: 'text-blue-900',
  },
  red: {
    bg: 'bg-red-50',
    labelColor: 'text-red-600',
    valueColor: 'text-red-900',
  },
  green: {
    bg: 'bg-green-50',
    labelColor: 'text-green-600',
    valueColor: 'text-green-900',
  },
  gray: {
    bg: 'bg-gray-50',
    labelColor: 'text-gray-600',
    valueColor: 'text-gray-900',
  },
};

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export default function StatsCard({
  label,
  value,
  variant = 'gray',
  size = 'md'
}: StatsCardProps) {
  const colors = variantClasses[variant];

  return (
    <div className={`${colors.bg} rounded-lg p-4`}>
      <p className={`text-sm ${colors.labelColor} font-medium`}>{label}</p>
      <p className={`mt-1 ${sizeClasses[size]} font-bold ${colors.valueColor}`}>
        {value}
      </p>
    </div>
  );
}
