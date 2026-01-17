import React from 'react';
import '../../App.css';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: string;
  color?: string;
  gradient?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, gradient }) => {
  const cardStyle: React.CSSProperties = gradient
    ? {
        textAlign: 'center',
        background: gradient,
        color: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }
    : {
        textAlign: 'center',
        background: color || '#f5f5f5',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      };

  return (
    <div className="card" style={cardStyle}>
      {icon && <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>}
      <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0', fontWeight: 'bold' }}>{value}</h3>
      <p style={{ margin: 0, fontSize: '1.1rem', opacity: gradient ? 1 : 0.8 }}>{title}</p>
    </div>
  );
};

export default StatsCard;
