import React, { useState, useRef } from 'react';
import {
  TicketLayout,
  FieldType,
  FIELD_TEMPLATES,
  CreateLayoutFieldRequest,
} from '../types/ticketLayout';

interface TicketLayoutBuilderProps {
  layout?: TicketLayout;
  onSave: (layoutData: any) => void;
  onCancel: () => void;
}

const TicketLayoutBuilder: React.FC<TicketLayoutBuilderProps> = ({ layout, onSave, onCancel }) => {
  const [layoutName, setLayoutName] = useState(layout?.name || '');
  const [layoutDescription, setLayoutDescription] = useState(layout?.description || '');
  const [isDefault, setIsDefault] = useState(layout?.isDefault || false);
  const [gridColumns] = useState(12);
  const [gridRows] = useState(20);
  const [fields, setFields] = useState<CreateLayoutFieldRequest[]>(
    layout?.fields?.map((field) => ({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      fieldConfig: field.fieldConfig,
      validationRules: field.validationRules,
      isRequired: field.isRequired,
      sortOrder: field.sortOrder,
      gridPositionX: field.gridPositionX,
      gridPositionY: field.gridPositionY,
      gridWidth: field.gridWidth,
      gridHeight: field.gridHeight,
    })) || []
  );
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [draggedFieldType, setDraggedFieldType] = useState<FieldType | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Group field templates by category
  const fieldsByCategory = FIELD_TEMPLATES.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, typeof FIELD_TEMPLATES>
  );

  const handleDragStart = (fieldType: FieldType) => {
    setDraggedFieldType(fieldType);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedFieldType || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellWidth = rect.width / gridColumns;
    const cellHeight = 60; // Fixed row height

    const gridX = Math.floor(x / cellWidth);
    const gridY = Math.floor(y / cellHeight);

    // Find the field template
    const template = FIELD_TEMPLATES.find((t) => t.type === draggedFieldType);
    if (!template) return;

    // Prevent adding core fields that are always included
    if (draggedFieldType === 'text' || draggedFieldType === 'textarea') {
      alert(
        'Title and Description fields are always included and cannot be added as custom fields. Status is also included by default.'
      );
      return;
    }

    // Check if position is available
    const isPositionAvailable = !fields.some(
      (field) =>
        gridX >= field.gridPositionX &&
        gridX < field.gridPositionX + field.gridWidth &&
        gridY >= field.gridPositionY &&
        gridY < field.gridPositionY + field.gridHeight
    );

    if (!isPositionAvailable) return;

    // Create new field
    const newField: CreateLayoutFieldRequest = {
      fieldName: `field_${Date.now()}`,
      fieldLabel: template.label,
      fieldType: template.type,
      fieldConfig: { ...template.defaultConfig },
      validationRules: template.defaultValidation ? { ...template.defaultValidation } : undefined,
      isRequired: false,
      sortOrder: fields.length,
      gridPositionX: Math.max(0, Math.min(gridX, gridColumns - 2)),
      gridPositionY: Math.max(0, Math.min(gridY, gridRows - 1)),
      gridWidth: 2, // Default width
      gridHeight: 1, // Default height
    };

    setFields((prev) => [...prev, newField]);
    setSelectedField(fields.length);
    setDraggedFieldType(null);
  };

  const handleFieldClick = (index: number) => {
    setSelectedField(index);
  };

  const handleFieldUpdate = (index: number, updates: Partial<CreateLayoutFieldRequest>) => {
    setFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...updates } : field)));
  };

  const handleFieldDelete = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setSelectedField(null);
  };

  const handleSave = () => {
    if (!layoutName.trim()) {
      alert('Please enter a layout name');
      return;
    }

    const layoutData = {
      name: layoutName,
      description: layoutDescription,
      isDefault,
      layoutConfig: {
        gridColumns,
        gridRows,
        theme: 'default',
      },
      fields,
    };

    onSave(layoutData);
  };

  const renderGrid = () => {
    const gridCells = [];

    // Create grid background
    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < gridColumns; x++) {
        gridCells.push(
          <div
            key={`${x}-${y}`}
            className="border border-gray-200 bg-gray-50"
            style={{
              gridColumn: x + 1,
              gridRow: y + 1,
              minHeight: '60px',
            }}
          />
        );
      }
    }

    return gridCells;
  };

  const renderFields = () => {
    return fields.map((field, index) => (
      <div
        key={index}
        className={`
          border-2 rounded-lg p-3 cursor-pointer transition-all
          ${
            selectedField === index
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }
        `}
        style={{
          gridColumn: `${field.gridPositionX + 1} / span ${field.gridWidth}`,
          gridRow: `${field.gridPositionY + 1} / span ${field.gridHeight}`,
          minHeight: '60px',
        }}
        onClick={() => handleFieldClick(index)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">
              {FIELD_TEMPLATES.find((t) => t.type === field.fieldType)?.icon || '📝'}
            </span>
            <div>
              <div className="font-medium text-sm">{field.fieldLabel}</div>
              <div className="text-xs text-gray-500">{field.fieldType}</div>
            </div>
          </div>
          {field.isRequired && <span className="text-red-500 text-xs">*</span>}
        </div>
      </div>
    ));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Field Palette */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Field Library</h3>
          <p className="text-sm text-gray-600">Drag fields onto the layout</p>
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            <strong>Note:</strong> Title, Description, and Status are always included and cannot be
            removed. You can still add custom dropdown fields for other purposes.
          </div>
        </div>

        {Object.entries(fieldsByCategory).map(([category, templates]) => (
          <div key={category} className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 capitalize">{category} Fields</h4>
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.type}
                  draggable
                  onDragStart={() => handleDragStart(template.type)}
                  className="flex items-center p-3 border border-gray-200 rounded-lg cursor-move hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-lg mr-3">{template.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{template.label}</div>
                    <div className="text-xs text-gray-500">{template.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Layout Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                placeholder="Layout Name"
                className="w-full text-lg font-semibold border-none outline-none"
              />
              <input
                type="text"
                value={layoutDescription}
                onChange={(e) => setLayoutDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full text-sm text-gray-600 border-none outline-none mt-1"
              />
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Default Layout</span>
              </label>
              <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Layout
              </button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Fixed Fields Section */}
          <div className="mb-4 p-4 bg-gray-50 border border-gray-300 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Required Fields (Always Included)
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center p-3 bg-white border border-gray-200 rounded-lg">
                <span className="text-lg mr-3">📝</span>
                <div>
                  <div className="font-medium text-sm">Title</div>
                  <div className="text-xs text-gray-500">Single line text - Required</div>
                </div>
                <span className="ml-auto text-red-500 text-xs">Required</span>
              </div>
              <div className="flex items-center p-3 bg-white border border-gray-200 rounded-lg">
                <span className="text-lg mr-3">📄</span>
                <div>
                  <div className="font-medium text-sm">Description</div>
                  <div className="text-xs text-gray-500">Multi-line text - Required</div>
                </div>
                <span className="ml-auto text-red-500 text-xs">Required</span>
              </div>
              <div className="flex items-center p-3 bg-white border border-gray-200 rounded-lg">
                <span className="text-lg mr-3">🏷️</span>
                <div>
                  <div className="font-medium text-sm">Status</div>
                  <div className="text-xs text-gray-500">Dropdown selection - Required</div>
                </div>
                <span className="ml-auto text-red-500 text-xs">Required</span>
              </div>
            </div>
          </div>

          {/* Custom Fields Grid */}
          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Custom Fields Layout</h3>
          </div>
          <div
            ref={gridRef}
            className="relative border border-gray-300 rounded-lg bg-white"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 60px)`,
              minHeight: `${gridRows * 60}px`,
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {renderGrid()}
            {renderFields()}
          </div>
        </div>
      </div>

      {/* Field Properties Panel */}
      {selectedField !== null && (
        <FieldPropertiesPanel
          field={fields[selectedField]}
          onUpdate={(updates) => handleFieldUpdate(selectedField, updates)}
          onDelete={() => handleFieldDelete(selectedField)}
          onClose={() => setSelectedField(null)}
        />
      )}
    </div>
  );
};

// Field Properties Panel Component
interface FieldPropertiesPanelProps {
  field: CreateLayoutFieldRequest;
  onUpdate: (updates: Partial<CreateLayoutFieldRequest>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const FieldPropertiesPanel: React.FC<FieldPropertiesPanelProps> = ({
  field,
  onUpdate,
  onDelete,
  onClose,
}) => {
  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Field Properties</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Properties */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Field Label</label>
          <input
            type="text"
            value={field.fieldLabel}
            onChange={(e) => onUpdate({ fieldLabel: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
          <input
            type="text"
            value={field.fieldName}
            onChange={(e) => onUpdate({ fieldName: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            pattern="[a-zA-Z][a-zA-Z0-9_]*"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used for data storage (letters, numbers, underscore only)
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="required"
            checked={field.isRequired}
            onChange={(e) => onUpdate({ isRequired: e.target.checked })}
            className="mr-2"
          />
          <label htmlFor="required" className="text-sm font-medium text-gray-700">
            Required Field
          </label>
        </div>

        {/* Field-specific configuration */}
        {field.fieldType === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
            <input
              type="text"
              value={field.fieldConfig.placeholder || ''}
              onChange={(e) =>
                onUpdate({
                  fieldConfig: { ...field.fieldConfig, placeholder: e.target.value },
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        )}

        {field.fieldType === 'picklist' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
            <div className="space-y-2">
              {field.fieldConfig.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...(field.fieldConfig.options || [])];
                      newOptions[index] = { ...option, label: e.target.value };
                      onUpdate({
                        fieldConfig: { ...field.fieldConfig, options: newOptions },
                      });
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => {
                      const newOptions = field.fieldConfig.options?.filter((_, i) => i !== index);
                      onUpdate({
                        fieldConfig: { ...field.fieldConfig, options: newOptions },
                      });
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [
                    ...(field.fieldConfig.options || []),
                    { value: `option_${Date.now()}`, label: 'New Option' },
                  ];
                  onUpdate({
                    fieldConfig: { ...field.fieldConfig, options: newOptions },
                  });
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Option
              </button>
            </div>
          </div>
        )}

        {/* Position and Size */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Position & Size</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500">X Position</label>
              <input
                type="number"
                value={field.gridPositionX}
                onChange={(e) => onUpdate({ gridPositionX: parseInt(e.target.value) })}
                min="0"
                max="11"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Y Position</label>
              <input
                type="number"
                value={field.gridPositionY}
                onChange={(e) => onUpdate({ gridPositionY: parseInt(e.target.value) })}
                min="0"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Width</label>
              <input
                type="number"
                value={field.gridWidth}
                onChange={(e) => onUpdate({ gridWidth: parseInt(e.target.value) })}
                min="1"
                max="12"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Height</label>
              <input
                type="number"
                value={field.gridHeight}
                onChange={(e) => onUpdate({ gridHeight: parseInt(e.target.value) })}
                min="1"
                max="5"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Delete Button */}
        <div className="border-t pt-4">
          <button
            onClick={onDelete}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Delete Field
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketLayoutBuilder;
