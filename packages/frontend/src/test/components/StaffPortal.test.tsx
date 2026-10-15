import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffPortalRedirect from '../../components/StaffPortalRedirect';
import { customerPortalBase, isPortalHost, isStaffPortalHost } from '../../portal/portalApi';

// portal.bomizzel.com = a company's staff sign-in; help.bomizzel.com = its customers' portal
const onHost = (hostname: string) => {
  const replace = vi.fn();
  vi.stubGlobal('location', { ...window.location, hostname, replace });
  return replace;
};

describe('portal hosts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tells the staff sign-in host from the customer portal host', () => {
    onHost('portal.bomizzel.com');
    expect(isStaffPortalHost()).toBe(true);
    expect(isPortalHost()).toBe(false);
    expect(customerPortalBase()).toBe('https://help.bomizzel.com');

    onHost('help.bomizzel.com');
    expect(isPortalHost()).toBe(true);
    expect(isStaffPortalHost()).toBe(false);
    expect(customerPortalBase()).toBe('');

    onHost('www.bomizzel.com');
    expect(isPortalHost()).toBe(false);
    expect(isStaffPortalHost()).toBe(false);
    expect(customerPortalBase()).toBe('https://help.bomizzel.com');
  });
});

describe('StaffPortalRedirect', () => {
  let replace: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    replace = onHost('portal.bomizzel.com');
  });
  afterEach(() => vi.unstubAllGlobals());

  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:slug/login" element={<div>staff sign-in</div>} />
          <Route path="/:slug/*" element={<StaffPortalRedirect />} />
        </Routes>
      </MemoryRouter>
    );

  it('sends the bare company address to its staff sign-in', () => {
    const { getByText } = at('/gleason');
    expect(getByText('staff sign-in')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends old customer links on to help.bomizzel.com', () => {
    at('/gleason/tickets/abc?x=1');
    expect(replace).toHaveBeenCalledWith('https://help.bomizzel.com/gleason/tickets/abc?x=1');
  });
});
