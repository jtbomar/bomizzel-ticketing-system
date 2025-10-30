import { CustomFieldService } from '../src/services/CustomFieldService';
import { CustomField } from '../src/models/CustomField';
import { Team } from '../src/models/Team';

// Mock the dependencies
jest.mock('../src/models/CustomField');
jest.mock('../src/models/Team');

const mockCustomField = CustomField as jest.Mocked<typeof CustomField>;
const mockTeam = Team as jest.Mocked<typeof Team>;

describe('CustomFieldService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFieldConfiguration', () => {
    it('should validate string field configuration', () => {
      const fieldData = {
        name: 'customer_name',
        label: 'Customer Name',
        type: 'string' as const,
        isRequired: true,
        validation: {
          min: 2,
          max: 100,
        },
      };

      // This should not throw
      expect(() => {
        (CustomFieldService as any).validateFieldConfiguration(fieldData);
      }).not.toThrow();
    });

    it('should validate picklist field configuration', () => {
      const fieldData = {
        name: 'priority_level',
        label: 'Priority Level',
        type: 'picklist' as const,
        options: ['Low', 'Medium', 'High'],
      };

      expect(() => {
        (CustomFieldService as any).validateFieldConfiguration(fieldData);
      }).not.toThrow();
    });

    it('should reject invalid field name', () => {
      const fieldData = {
        name: '123invalid',
        label: 'Invalid Name',
        type: 'string' as const,
      };

      expect(() => {
        (CustomFieldService as any).validateFieldConfiguration(fieldData);
      }).toThrow('Field name must start with a letter');
    });

    it('should reject picklist without options', () => {
      const fieldData = {
        name: 'priority',
        label: 'Priority',
        type: 'picklist' as const,
        options: [],
      };

      expect(() => {
        (CustomFieldService as any).validateFieldConfiguration(fieldData);
      }).toThrow('Picklist fields must have at least one option');
    });
  });

  describe('validateFieldValidation', () => {
    it('should validate numeric field validation rules', () => {
      expect(() => {
        (CustomFieldService as any).validateFieldValidation('integer', {
          min: 1,
          max: 100,
        });
      }).not.toThrow();
    });

    it('should reject invalid min/max for numeric fields', () => {
      expect(() => {
        (CustomFieldService as any).validateFieldValidation('integer', {
          min: 100,
          max: 1,
        });
      }).toThrow('Minimum value cannot be greater than maximum value');
    });

    it('should validate string field validation rules', () => {
      expect(() => {
        (CustomFieldService as any).validateFieldValidation('string', {
          min: 1,
          max: 50,
          pattern: '^[A-Za-z]+$',
        });
      }).not.toThrow();
    });

    it('should reject invalid regex pattern', () => {
      expect(() => {
        (CustomFieldService as any).validateFieldValidation('string', {
          pattern: '[invalid regex',
        });
      }).toThrow('Invalid regex pattern in validation');
    });
  });

  describe('createCustomField', () => {
    it('should create a custom field successfully', async () => {
      const teamId = 'team-123';
      const fieldData = {
        name: 'customer_name',
        label: 'Customer Name',
        type: 'string' as const,
        isRequired: true,
      };

      const mockTeamRecord = { id: teamId, name: 'Test Team' };
      const mockFieldRecord = {
        id: 'field-123',
        team_id: teamId,
        name: fieldData.name,
        label: fieldData.label,
        type: fieldData.type,
        is_required: fieldData.isRequired,
        options: null,
        validation: null,
        order: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeam.findById.mockResolvedValue(mockTeamRecord);
      mockCustomField.findByTeamAndName.mockResolvedValue(null);
      mockCustomField.findByTeam.mockResolvedValue([]);
      mockCustomField.createCustomField.mockResolvedValue(mockFieldRecord);
      mockCustomField.toModel.mockReturnValue({
        id: mockFieldRecord.id,
        teamId: mockFieldRecord.team_id,
        name: mockFieldRecord.name,
        label: mockFieldRecord.label,
        type: mockFieldRecord.type,
        isRequired: mockFieldRecord.is_required,
        options: mockFieldRecord.options,
        validation: mockFieldRecord.validation,
        order: mockFieldRecord.order,
        isActive: mockFieldRecord.is_active,
        createdAt: mockFieldRecord.created_at,
        updatedAt: mockFieldRecord.updated_at,
      });

      const result = await CustomFieldService.createCustomField(teamId, fieldData);

      expect(result).toBeDefined();
      expect(result.name).toBe(fieldData.name);
      expect(result.label).toBe(fieldData.label);
      expect(result.type).toBe(fieldData.type);
      expect(mockCustomField.createCustomField).toHaveBeenCalledWith({
        teamId,
        name: fieldData.name,
        label: fieldData.label,
        type: fieldData.type,
        isRequired: fieldData.isRequired,
        order: 0,
      });
    });

    it('should throw error if team not found', async () => {
      const teamId = 'nonexistent-team';
      const fieldData = {
        name: 'test_field',
        label: 'Test Field',
        type: 'string' as const,
      };

      mockTeam.findById.mockResolvedValue(null);

      await expect(
        CustomFieldService.createCustomField(teamId, fieldData)
      ).rejects.toThrow('Team not found');
    });

    it('should throw error if field name already exists', async () => {
      const teamId = 'team-123';
      const fieldData = {
        name: 'existing_field',
        label: 'Existing Field',
        type: 'string' as const,
      };

      const mockTeamRecord = { id: teamId, name: 'Test Team' };
      const mockExistingField = { id: 'existing-field-id', name: fieldData.name };

      mockTeam.findById.mockResolvedValue(mockTeamRecord);
      mockCustomField.findByTeamAndName.mockResolvedValue(mockExistingField);

      await expect(
        CustomFieldService.createCustomField(teamId, fieldData)
      ).rejects.toThrow('Custom field with name \'existing_field\' already exists for this team');
    });
  });
});