import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'glass' | 'solid' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  id?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'glass',
  padding = 'md',
  id,
  ...rest
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const variantClasses = {
    glass: 'glass-panel rounded-2xl transition-all duration-200',
    solid: 'bg-white dark:bg-[#132042] rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-sm transition-all duration-200',
    subtle: 'bg-[#F8FAFC]/90 dark:bg-[#1C2C55]/70 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-none'
  };

  return (
    <div
      id={id}
      className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
