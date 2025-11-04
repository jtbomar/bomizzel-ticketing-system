import React, { useState } from 'react';
import SimpleColorPicker from '../components/SimpleColorPicker';

const ColorPickerDemo: React.FC = () => {
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [showPicker, setShowPicker] = useState(false);
  const [colorHistory, setColorHistory] = useState<string[]>(['#3B82F6']);

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    if (!colorHistory.includes(color)) {
      setColorHistory((prev) => [color, ...prev].slice(0, 10)); // Keep last 10 colors
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🎨 Simple Color Picker Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Type hex codes or drag in the color area to select colors
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Color Picker Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Color Picker
            </h2>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div
                  className="w-20 h-20 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-inner"
                  style={{ backgroundColor: selectedColor }}
                />
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Selected Color:</div>
                  <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedColor.toUpperCase()}
                  </div>
                  <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {showPicker ? 'Close Picker' : 'Open Color Picker'}
                  </button>
                </div>
              </div>

              {showPicker && (
                <div className="flex justify-center">
                  <SimpleColorPicker
                    selectedColor={`custom-${selectedColor.replace('#', '')}`}
                    onColorSelect={(color) => {
                      const hex = color.startsWith('custom-')
                        ? '#' + color.replace('custom-', '')
                        : color;
                      handleColorChange(hex);
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Features</h2>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Hex Input</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Type hex codes like #178be4 for precise colors
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Drag to Select</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag anywhere in the color area to visually pick colors
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Live Preview</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    See your color selection instantly with hex display
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Compact Design</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Simple, focused interface that's easy to use
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Color History */}
        {colorHistory.length > 1 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Color History
            </h2>
            <div className="flex flex-wrap gap-3">
              {colorHistory.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  onClick={() => setSelectedColor(color)}
                  className="group relative"
                  title={color}
                >
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                  />
                  {color === selectedColor && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            How to Use the Simple Color Picker
          </h2>
          <div className="space-y-2 text-blue-800 dark:text-blue-200">
            <p>
              • <strong>Hex Input:</strong> Type hex codes like #178be4 directly in the input field
            </p>
            <p>
              • <strong>Drag Selection:</strong> Click and drag anywhere in the color area to pick
              colors visually
            </p>
            <p>
              • <strong>Live Preview:</strong> See your color and hex code update in real-time
            </p>
            <p>
              • <strong>Apply:</strong> Click "Apply" to confirm your color selection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPickerDemo;
