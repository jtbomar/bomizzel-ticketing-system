import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomFieldInput from '../../components/CustomFieldInput';
import type { CustomFieldDef } from '../../utils/fields';

const field = (type: CustomFieldDef['type'], options: string[] = []): CustomFieldDef => ({
  id: '1',
  key: 'cf_x',
  label: 'X',
  type,
  options,
  isRequired: false,
  helpText: null,
  system: false,
});

describe('CustomFieldInput', () => {
  it('a pick list offers its choices, and still shows a value whose choice was removed', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <CustomFieldInput
        field={field('picklist', ['Hardware', 'Software'])}
        value="Retired"
        onChange={onChange}
        onCommit={onCommit}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      '',
      'Hardware',
      'Software',
      'Retired',
    ]);
    fireEvent.change(select, { target: { value: 'Software' } });
    expect(onChange).toHaveBeenCalledWith('Software');
    expect(onCommit).toHaveBeenCalledWith('Software');
  });

  it('a multi-select adds and removes choices', () => {
    const onCommit = vi.fn();
    render(
      <CustomFieldInput
        field={field('multiselect', ['a', 'b', 'c'])}
        value={['a']}
        onChange={() => undefined}
        onCommit={onCommit}
      />
    );
    fireEvent.click(screen.getByLabelText('c'));
    expect(onCommit).toHaveBeenLastCalledWith(['a', 'c']);
    fireEvent.click(screen.getByLabelText('a'));
    expect(onCommit).toHaveBeenLastCalledWith([]);
  });

  it('text saves when you leave the field, a checkbox straight away', () => {
    const onCommit = vi.fn();
    const { unmount } = render(
      <CustomFieldInput
        field={field('text')}
        value=""
        onChange={() => undefined}
        onCommit={onCommit}
      />
    );
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'SN-1' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(box, { target: { value: 'SN-1' } });
    expect(onCommit).toHaveBeenCalledWith('SN-1');
    unmount();

    render(
      <CustomFieldInput
        field={field('checkbox')}
        value={false}
        onChange={() => undefined}
        onCommit={onCommit}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCommit).toHaveBeenLastCalledWith(true);
  });

  it('uses the right input for numbers, dates and links', () => {
    const { container } = render(
      <>
        <CustomFieldInput field={field('decimal')} value={9.5} onChange={() => undefined} />
        <CustomFieldInput field={field('date')} value="2026-12-01" onChange={() => undefined} />
        <CustomFieldInput field={field('url')} value="" onChange={() => undefined} />
      </>
    );
    const types = Array.from(container.querySelectorAll('input')).map((i) => i.type);
    expect(types).toEqual(['number', 'date', 'url']);
  });
});
