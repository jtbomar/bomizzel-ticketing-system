import React, { useState, useRef, useCallback, useEffect } from 'react';

interface SimpleColorPickerProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
  size?: 'sm' | 'md';
}

const SimpleColorPicker: React.FC<SimpleColorPickerProps> = ({
  selectedColor,
  onColorSelect,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const colorAreaRef = useRef<HTMLDivElement>(null);

  // Get current hex color from selected color
  const getCurrentHex = () => {
    if (selectedColor.startsWith('custom-')) {
      return '#' + selectedColor.replace('custom-', '');
    }
    // Convert preset colors to hex
    const colorMap: { [key: string]: string } = {
      red: '#EF4444', orange: '#F97316', yellow: '#EAB308', green: '#22C55E', blue: '#3B82F6',
      purple: '#A855F7', pink: '#EC4899', teal: '#14B8A6', indigo: '#6366F1', cyan: '#06B6D4',
      emerald: '#10B981', lime: '#84CC16', amber: '#F59E0B', rose: '#F43F5E', violet: '#8B5CF6',
      slate: '#64748B', gray: '#6B7280', zinc: '#71717A', stone: '#78716C', neutral: '#737373'
    };
    return colorMap[selectedColor] || '#3B82F6';
  };

  // Initialize hex input when opening
  useEffect(() => {
    if (isOpen) {
      setHexInput(getCurrentHex());
    }
  }, [isOpen, selectedColor]);



  // Handle dragging in color area
  const handleColorAreaDrag = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!colorAreaRef.current) return;
    
    const rect = colorAreaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    // Convert position to HSL
    const hue = (x / rect.width) * 360;
    const lightness = 100 - (y / rect.height) * 100;
    const saturation = 80; // Fixed saturation for simplicity
    
    // Convert HSL to hex
    const hslToHex = (h: number, s: number, l: number) => {
      h = h / 360;
      s = s / 100;
      l = l / 100;

      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }

      const toHex = (c: number) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const newHex = hslToHex(hue, saturation, lightness);
    setHexInput(newHex);
  }, []);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleColorAreaDrag(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleColorAreaDrag(e);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleColorAreaDrag]);

  // Handle hex input change
  const handleHexChange = (value: string) => {
    setHexInput(value);
  };

  // Apply color selection
  const applyColor = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      const customColorName = `custom-${hexInput.replace('#', '')}`;
      onColorSelect(customColorName);
      setIsOpen(false);
    }
  };

  // Get display info for current color
  const getDisplayInfo = () => {
    const isCustom = selectedColor.startsWith('custom-');
    if (isCustom) {
      return {
        hex: '#' + selectedColor.replace('custom-', ''),
        name: 'Custom',
        style: { backgroundColor: '#' + selectedColor.replace('custom-', '') }
      };
    }
    
    // Preset color
    const presetColors: { [key: string]: { name: string; bg: string; hex: string } } = {
      red: { name: 'Red', bg: 'bg-red-500', hex: '#EF4444' },
      orange: { name: 'Orange', bg: 'bg-orange-500', hex: '#F97316' },
      yellow: { name: 'Yellow', bg: 'bg-yellow-500', hex: '#EAB308' },
      green: { name: 'Green', bg: 'bg-green-500', hex: '#22C55E' },
      blue: { name: 'Blue', bg: 'bg-blue-500', hex: '#3B82F6' },
      purple: { name: 'Purple', bg: 'bg-purple-500', hex: '#A855F7' },
      pink: { name: 'Pink', bg: 'bg-pink-500', hex: '#EC4899' },
      teal: { name: 'Teal', bg: 'bg-teal-500', hex: '#14B8A6' },
      indigo: { name: 'Indigo', bg: 'bg-indigo-500', hex: '#6366F1' },
      cyan: { name: 'Cyan', bg: 'bg-cyan-500', hex: '#06B6D4' },
      emerald: { name: 'Emerald', bg: 'bg-emerald-500', hex: '#10B981' },
      lime: { name: 'Lime', bg: 'bg-lime-500', hex: '#84CC16' },
      amber: { name: 'Amber', bg: 'bg-amber-500', hex: '#F59E0B' },
      rose: { name: 'Rose', bg: 'bg-rose-500', hex: '#F43F5E' },
      violet: { name: 'Violet', bg: 'bg-violet-500', hex: '#8B5CF6' },
      slate: { name: 'Slate', bg: 'bg-slate-500', hex: '#64748B' },
      gray: { name: 'Gray', bg: 'bg-gray-500', hex: '#6B7280' },
      zinc: { name: 'Zinc', bg: 'bg-zinc-500', hex: '#71717A' },
      stone: { name: 'Stone', bg: 'bg-stone-500', hex: '#78716C' },
      neutral: { name: 'Neutral', bg: 'bg-neutral-500', hex: '#737373' }
    };
    
    const preset = presetColors[selectedColor];
    return preset ? {
      hex: preset.hex,
      name: preset.name,
      bgClass: preset.bg
    } : {
      hex: '#6B7280',
      name: 'Gray',
      bgClass: 'bg-gray-500'
    };
  };

  const displayInfo = getDisplayInfo();

  return (
    <div className="relative">
      {/* Color Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <div 
          className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} rounded border border-gray-300 dark:border-gray-500`}
          style={displayInfo.style || {}}
        >
          {displayInfo.bgClass && (
            <div className={`w-full h-full rounded ${displayInfo.bgClass}`} />
          )}
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {displayInfo.name}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {displayInfo.hex}
        </span>
      </button>

      {/* Color Picker Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Picker Panel */}
          <div className="absolute top-full left-0 mt-1 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 w-72">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select Color
            </h4>
            
            {/* Hex Input */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Hex Color Code
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => handleHexChange(e.target.value)}
                  placeholder="#178be4"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div
                  className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput) ? hexInput : '#cccccc' }}
                />
              </div>
            </div>

            {/* Drag Color Area */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Or drag to pick a color
              </label>
              <div
                ref={colorAreaRef}
                className="w-full h-32 cursor-crosshair relative overflow-hidden rounded border border-gray-300 dark:border-gray-600"
                style={{
                  background: 'linear-gradient(to bottom, #ffffff, #000000), linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                  backgroundBlendMode: 'multiply'
                }}
                onMouseDown={handleMouseDown}
              >
                <div className="absolute inset-0 opacity-75" style={{
                  background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
                }} />
                <div className="absolute inset-0" style={{
                  background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%)'
                }} />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Drag anywhere in the color area to select
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyColor}
                disabled={!/^#[0-9A-Fa-f]{6}$/.test(hexInput)}
                className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SimpleColorPicker;