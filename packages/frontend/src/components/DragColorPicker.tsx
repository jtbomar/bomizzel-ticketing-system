import React, { useState, useRef, useCallback, useEffect } from 'react';

interface DragColorPickerProps {
  initialColor?: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}



const DragColorPicker: React.FC<DragColorPickerProps> = ({
  initialColor = '#3B82F6',
  onColorChange,
  onClose
}) => {
  // Convert hex to HSL for initial state
  const hexToHsl = (hex: string): HSL => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  };

  // Convert HSL to hex
  const hslToHex = (h: number, s: number, l: number): string => {
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
      r = g = b = l; // achromatic
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

  const initialHsl = hexToHsl(initialColor);
  const [hsl, setHsl] = useState<HSL>(initialHsl);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [isDraggingSL, setIsDraggingSL] = useState(false);

  const hueSliderRef = useRef<HTMLDivElement>(null);
  const slAreaRef = useRef<HTMLDivElement>(null);

  // Update color when HSL changes
  useEffect(() => {
    const hexColor = hslToHex(hsl.h, hsl.s, hsl.l);
    onColorChange(hexColor);
  }, [hsl, onColorChange]);

  // Handle hue slider dragging
  const handleHueMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDraggingHue(true);
    updateHue(e);
  }, []);

  const updateHue = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!hueSliderRef.current) return;
    
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const hue = Math.round((x / rect.width) * 360);
    
    setHsl(prev => ({ ...prev, h: hue }));
  }, []);

  // Handle saturation/lightness area dragging
  const handleSLMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDraggingSL(true);
    updateSL(e);
  }, []);

  const updateSL = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!slAreaRef.current) return;
    
    const rect = slAreaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    const saturation = Math.round((x / rect.width) * 100);
    const lightness = Math.round(100 - (y / rect.height) * 100);
    
    setHsl(prev => ({ ...prev, s: saturation, l: lightness }));
  }, []);

  // Mouse move and up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHue) {
        updateHue(e);
      } else if (isDraggingSL) {
        updateSL(e);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingHue(false);
      setIsDraggingSL(false);
    };

    if (isDraggingHue || isDraggingSL) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingHue, isDraggingSL, updateHue, updateSL]);

  const currentColor = hslToHex(hsl.h, hsl.s, hsl.l);
  const hueColor = hslToHex(hsl.h, 100, 50);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-80">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Drag Color Picker
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Saturation/Lightness Area */}
        <div className="relative">
          <div
            ref={slAreaRef}
            className="w-full h-48 cursor-crosshair relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`
            }}
            onMouseDown={handleSLMouseDown}
          >
            {/* Saturation/Lightness Indicator */}
            <div
              className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg transform -translate-x-2 -translate-y-2 pointer-events-none"
              style={{
                left: `${hsl.s}%`,
                top: `${100 - hsl.l}%`,
                backgroundColor: currentColor
              }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            Drag to adjust saturation and lightness
          </div>
        </div>

        {/* Hue Slider */}
        <div className="relative">
          <div
            ref={hueSliderRef}
            className="w-full h-6 cursor-pointer relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600"
            style={{
              background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
            }}
            onMouseDown={handleHueMouseDown}
          >
            {/* Hue Indicator */}
            <div
              className="absolute w-2 h-full bg-white border border-gray-400 shadow-lg transform -translate-x-1 pointer-events-none"
              style={{
                left: `${(hsl.h / 360) * 100}%`
              }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            Drag to adjust hue
          </div>
        </div>

        {/* Color Preview and Values */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div
              className="w-16 h-16 rounded-lg border border-gray-300 dark:border-gray-600 shadow-inner"
              style={{ backgroundColor: currentColor }}
            />
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Hex:</span>
                  <div className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {currentColor.toUpperCase()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">HSL:</span>
                  <div className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                    {hsl.h}°, {hsl.s}%, {hsl.l}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Manual Hex Input */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Or enter hex color:
            </label>
            <input
              type="text"
              value={currentColor}
              onChange={(e) => {
                const hex = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                  const newHsl = hexToHsl(hex);
                  setHsl(newHsl);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              placeholder="#3B82F6"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onColorChange(currentColor);
              onClose();
            }}
            className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Apply Color
          </button>
        </div>
      </div>
    </div>
  );
};

export default DragColorPicker;