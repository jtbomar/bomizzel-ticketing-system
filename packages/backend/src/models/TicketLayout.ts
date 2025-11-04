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
  fields: CreateLayoutFieldRequest[]; // Custom fields only - title/description/status are always included
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
