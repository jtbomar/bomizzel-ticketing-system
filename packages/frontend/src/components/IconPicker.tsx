import React, { useState } from 'react';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  type?: 'trophy' | 'badge';
}

const TROPHY_ICONS = [
  '🏆',
  '🥇',
  '🥈',
  '🥉',
  '🎖️',
  '🏅',
  '⭐',
  '🌟',
  '✨',
  '💫',
  '⚡',
  '🚀',
  '🔥',
  '💥',
  '✅',
  '✔️',
  '🎯',
  '🎪',
  '🎨',
  '🎭',
  '💬',
  '📝',
  '📋',
  '📊',
  '📈',
  '🧩',
  '🔧',
  '⚙️',
  '🛠️',
  '🔨',
  '💡',
  '🌈',
  '🎁',
  '🎉',
  '🎊',
  '🏁',
  '🚩',
  '⛳',
  '🎲',
  '🎰',
];

const BADGE_ICONS = [
  '🎖️',
  '🏅',
  '🥇',
  '🥈',
  '🥉',
  '💎',
  '💠',
  '🔷',
  '🔶',
  '🔸',
  '🔹',
  '⭐',
  '🌟',
  '✨',
  '💫',
  '🌠',
  '👑',
  '🦁',
  '🦅',
  '🐝',
  '🌱',
  '🌿',
  '🍀',
  '🌺',
  '🌸',
  '🌼',
  '🌻',
  '🏵️',
  '🎗️',
  '🎀',
  '🔰',
  '⚜️',
  '🛡️',
  '🗡️',
  '🏹',
  '🎯',
  '🎪',
  '🎨',
  '🎭',
  '🎬',
];

const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, type = 'trophy' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const icons = type === 'trophy' ? TROPHY_ICONS : BADGE_ICONS;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder={type === 'trophy' ? '🏆' : '🎖️'}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 text-sm"
        >
          Pick
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Choose an icon</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-10 gap-2 max-h-64 overflow-y-auto">
              {icons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => {
                    onChange(icon);
                    setIsOpen(false);
                  }}
                  className={`text-2xl p-2 rounded hover:bg-gray-100 transition-colors ${
                    value === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                  }`}
                  title={icon}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default IconPicker;
