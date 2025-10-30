import React from 'react';

interface TicketMascotProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const TicketMascot: React.FC<TicketMascotProps> = ({ className = '', size = 'lg' }) => {
  const sizeClasses = {
    sm: 'w-24 h-32',
    md: 'w-32 h-40',
    lg: 'w-48 h-60',
    xl: 'w-64 h-80'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg
        viewBox="0 0 200 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Ticket Body */}
        <rect
          x="50"
          y="80"
          width="100"
          height="120"
          rx="8"
          fill="#ffffff"
          stroke="#e5e7eb"
          strokeWidth="2"
        />
        
        {/* Ticket Lines */}
        <line x1="60" y1="100" x2="140" y2="100" stroke="#d1d5db" strokeWidth="2" />
        <line x1="60" y1="115" x2="130" y2="115" stroke="#d1d5db" strokeWidth="2" />
        <line x1="60" y1="130" x2="135" y2="130" stroke="#d1d5db" strokeWidth="2" />
        <line x1="60" y1="145" x2="125" y2="145" stroke="#d1d5db" strokeWidth="2" />
        
        {/* Ticket Number */}
        <text x="100" y="95" textAnchor="middle" className="fill-gray-600 text-xs font-mono">
          #12345
        </text>
        
        {/* Arms */}
        <g stroke="#fbbf24" strokeWidth="4" strokeLinecap="round">
          {/* Left arm */}
          <line x1="45" y1="120" x2="25" y2="110" />
          <line x1="25" y1="110" x2="15" y2="125" />
          {/* Right arm */}
          <line x1="155" y1="120" x2="175" y2="110" />
          <line x1="175" y1="110" x2="185" y2="125" />
        </g>
        
        {/* Hands */}
        <circle cx="15" cy="125" r="6" fill="#fbbf24" />
        <circle cx="185" cy="125" r="6" fill="#fbbf24" />
        
        {/* Legs */}
        <g stroke="#fbbf24" strokeWidth="4" strokeLinecap="round">
          {/* Left leg */}
          <line x1="70" y1="200" x2="60" y2="230" />
          <line x1="60" y1="230" x2="45" y2="235" />
          {/* Right leg */}
          <line x1="130" y1="200" x2="140" y2="230" />
          <line x1="140" y1="230" x2="155" y2="235" />
        </g>
        
        {/* Feet */}
        <ellipse cx="45" cy="235" rx="8" ry="4" fill="#fbbf24" />
        <ellipse cx="155" cy="235" rx="8" ry="4" fill="#fbbf24" />
        
        {/* Face */}
        {/* Eyes */}
        <circle cx="85" cy="160" r="4" fill="#374151" />
        <circle cx="115" cy="160" r="4" fill="#374151" />
        
        {/* Mouth (sad/hurt expression) */}
        <path
          d="M 90 175 Q 100 170 110 175"
          stroke="#374151"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Bandage on head */}
        <rect
          x="75"
          y="65"
          width="50"
          height="20"
          rx="10"
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth="1"
        />
        
        {/* Bandage cross */}
        <g stroke="#ef4444" strokeWidth="2">
          <line x1="95" y1="70" x2="105" y2="80" />
          <line x1="105" y1="70" x2="95" y2="80" />
        </g>
        
        {/* Small injury marks */}
        <g stroke="#ef4444" strokeWidth="1" opacity="0.6">
          <line x1="65" y1="110" x2="70" y2="115" />
          <line x1="70" y1="110" x2="65" y2="115" />
          <line x1="130" y1="140" x2="135" y2="145" />
          <line x1="135" y1="140" x2="130" y2="145" />
        </g>
        
        {/* Sweat drops (showing distress) */}
        <g fill="#60a5fa" opacity="0.7">
          <ellipse cx="75" cy="150" rx="2" ry="4" />
          <ellipse cx="125" cy="155" rx="2" ry="4" />
        </g>
        
        {/* Speech bubble with "Help!" */}
        <g>
          <ellipse cx="160" cy="50" rx="25" ry="15" fill="#ffffff" stroke="#d1d5db" strokeWidth="1" />
          <path d="M 145 60 L 140 70 L 155 65 Z" fill="#ffffff" stroke="#d1d5db" strokeWidth="1" />
          <text x="160" y="55" textAnchor="middle" className="fill-red-500 text-xs font-bold">
            Help!
          </text>
        </g>
      </svg>
    </div>
  );
};

export default TicketMascot;