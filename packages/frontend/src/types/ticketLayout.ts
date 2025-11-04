// Frontend types for ticket layout system

export interface TicketLayout {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  layoutConfig: LayoutConfig;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  fields?: LayoutField[];
}

export interface LayoutField {
  id: string;
  layoutId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: FieldType;
  fieldConfig: FieldConfig;
  validationRules?: ValidationRules;
  isRequired: boolean;
  sortOrder: number;
  gridPositionX: number;
  gridPositionY: number;
  gridWidth: number;
  gridHeight: number;
  createdAt: Date;
  updatedAt: Date;
}

export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'rich_text' 
  | 'number' 
  | 'currency' 
  | 'date' 
  | 'datetime' 
  | 'picklist' 
  | 'multi_picklist' 
  | 'checkbox' 
  | 'radio' 
  | 'email' 
  | 'phone' 
  | 'url';

export interface LayoutConfig {
  gridColumns: number;
  gridRows: number;
  theme?: string;
  sections?: LayoutSection[];
}

export interface LayoutSection {
  id: string;
  name: string;
  startX: number;
  startY: number;
  width: number;
  height: number;
  collapsible?: boolean;
  collapsed?: boolean;
}

export interface FieldConfig {
  placeholder?: string;
  defaultValue?: any;
  options?: PicklistOption[];
  currency?: CurrencyConfig;
  dateFormat?: string;
  richTextConfig?: RichTextConfig;
  numberConfig?: NumberConfig;
}

export interface PicklistOption {
  value: string;
  label: string;
  color?: string;
  isDefault?: boolean;
}

export interface CurrencyConfig {
  currency: string; // USD, EUR, etc.
  symbol: string; // $, €, etc.
  precision: number; // decimal places
  thousandsSeparator: string;
  decimalSeparator: string;
}

export interface RichTextConfig {
  toolbar: string[];
  maxLength?: number;
  allowImages?: boolean;
  allowLinks?: boolean;
}

export interface NumberConfig {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  customValidation?: string;
}

export interface TicketLayoutResponse {
  layout: TicketLayout;
  fields: LayoutField[];
}

export interface CreateLayoutRequest {
  name: string;
  description?: string;
  layoutConfig: LayoutConfig;
  isDefault?: boolean;
  fields: CreateLayoutFieldRequest[];
}

export interface CreateLayoutFieldRequest {
  fieldName: string;
  fieldLabel: string;
  fieldType: FieldType;
  fieldConfig: FieldConfig;
  validationRules?: ValidationRules;
  isRequired?: boolean;
  sortOrder: number;
  gridPositionX: number;
  gridPositionY: number;
  gridWidth: number;
  gridHeight: number;
}

// UI-specific types for the layout builder
export interface DraggedField {
  type: FieldType;
  label: string;
  icon: string;
  defaultConfig: FieldConfig;
}

export interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldTemplate {
  type: FieldType;
  label: string;
  icon: string;
  description: string;
  defaultConfig: FieldConfig;
  defaultValidation?: ValidationRules;
  category: 'basic' | 'advanced' | 'specialized';
}

export const FIELD_TEMPLATES: FieldTemplate[] = [
  // Note: text and textarea are excluded as they are core fields (title/description)
  // Status is also a core field but picklist can still be used for other custom fields
  {
    type: 'rich_text',
    label: 'Rich Text Editor',
    icon: '✏️',
    description: 'Formatted text with styling options',
    category: 'advanced',
    defaultConfig: {
      richTextConfig: {
        toolbar: ['bold', 'italic', 'underline', 'link', 'bulletList', 'numberedList'],
        maxLength: 5000,
        allowImages: false,
        allowLinks: true
      }
    }
  },
  {
    type: 'picklist',
    label: 'Dropdown',
    icon: '📋',
    description: 'Single selection dropdown',
    category: 'basic',
    defaultConfig: {
      options: [
        { value: 'option1', label: 'Option 1', isDefault: true },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' }
      ]
    }
  },
  {
    type: 'number',
    label: 'Number',
    icon: '🔢',
    description: 'Numeric input field',
    category: 'basic',
    defaultConfig: {
      numberConfig: {
        min: 0,
        max: 999999,
        step: 1,
        precision: 0
      }
    }
  },
  {
    type: 'currency',
    label: 'Currency',
    icon: '💰',
    description: 'Currency amount input',
    category: 'specialized',
    defaultConfig: {
      currency: {
        currency: 'USD',
        symbol: '$',
        precision: 2,
        thousandsSeparator: ',',
        decimalSeparator: '.'
      }
    }
  },
  {
    type: 'date',
    label: 'Date',
    icon: '📅',
    description: 'Date picker',
    category: 'basic',
    defaultConfig: {
      dateFormat: 'MM/DD/YYYY'
    }
  },
  {
    type: 'datetime',
    label: 'Date & Time',
    icon: '🕐',
    description: 'Date and time picker',
    category: 'basic',
    defaultConfig: {
      dateFormat: 'MM/DD/YYYY HH:mm'
    }
  },
  {
    type: 'picklist',
    label: 'Dropdown',
    icon: '📋',
    description: 'Single selection dropdown',
    category: 'basic',
    defaultConfig: {
      options: [
        { value: 'option1', label: 'Option 1', isDefault: true },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' }
      ]
    }
  },
  {
    type: 'multi_picklist',
    label: 'Multi-Select',
    icon: '☑️',
    description: 'Multiple selection dropdown',
    category: 'advanced',
    defaultConfig: {
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' }
      ]
    }
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: '✅',
    description: 'True/false checkbox',
    category: 'basic',
    defaultConfig: {
      defaultValue: false
    }
  },
  {
    type: 'radio',
    label: 'Radio Buttons',
    icon: '🔘',
    description: 'Single selection from radio buttons',
    category: 'basic',
    defaultConfig: {
      options: [
        { value: 'option1', label: 'Option 1', isDefault: true },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' }
      ]
    }
  },
  {
    type: 'email',
    label: 'Email',
    icon: '📧',
    description: 'Email address input',
    category: 'specialized',
    defaultConfig: {
      placeholder: 'user@example.com'
    },
    defaultValidation: {
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
    }
  },
  {
    type: 'phone',
    label: 'Phone',
    icon: '📞',
    description: 'Phone number input',
    category: 'specialized',
    defaultConfig: {
      placeholder: '(555) 123-4567'
    }
  },
  {
    type: 'url',
    label: 'URL',
    icon: '🔗',
    description: 'Website URL input',
    category: 'specialized',
    defaultConfig: {
      placeholder: 'https://example.com'
    },
    defaultValidation: {
      pattern: '^https?:\\/\\/.+'
    }
  }
];