import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffPortalRedirect from '../../components/StaffPortalRedirect';
import { customerPortalBase, isPortalHost, isStaffPortalHost } from '../../portal/portalApi';
import { companyInAddress, onBomizzelSite } from '../../utils/companyAddress';

// portal.bomizzel.com/<company>/... = that company's staff desk;
// help.bomizzel.com/<company> = its customers' portal
const at = (hostname: string, pathname = '/') => {
  const replace = vi.fn();
  vi.stubGlobal('location', { ...window.location, hostname, pathname, replace });
  return replace;
};

describe('portal hosts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tells the staff desk host from the customer portal host', () => {
    at('portal.bomizzel.com');
    expect(isStaffPortalHost()).toBe(true);
    expect(isPortalHost()).toBe(false);
    expect(customerPortalBase()).toBe('https://help.bomizzel.com');

    at('help.bomizzel.com');
    expect(isPortalHost()).toBe(true);
    expect(isStaffPortalHost()).toBe(false);
    expect(customerPortalBase()).toBe('');

    at('www.bomizzel.com');
    expect(isPortalHost()).toBe(false);
    expect(isStaffPortalHost()).toBe(false);
    expect(onBomizzelSite()).toBe(true);
    at('localhost');
    expect(onBomizzelSite()).toBe(false);
  });
});

describe('the company in the address', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is the first part of the path on the staff desk host', () => {
    at('portal.bomizzel.com', '/gleason/agent');
    expect(companyInAddress()).toBe('gleason');
    at('portal.bomizzel.com', '/gleason');
    expect(companyInAddress()).toBe('gleason');
  });

  it("is never one of the app's own pages, or on another host", () => {
    at('portal.bomizzel.com', '/agent');
    expect(companyInAddress()).toBe('');
    at('portal.bomizzel.com', '/login');
    expect(companyInAddress()).toBe('');
    at('portal.bomizzel.com', '/');
    expect(companyInAddress()).toBe('');
    at('www.bomizzel.com', '/gleason/agent');
    expect(companyInAddress()).toBe('');
  });
});

describe('old customer portal links', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('move to help.bomizzel.com', () => {
    const replace = at('portal.bomizzel.com', '/gleason/tickets/abc');
    render(
      <MemoryRouter initialEntries={['/tickets/abc?x=1']}>
        <Routes>
          <Route path="/tickets/*" element={<StaffPortalRedirect />} />
        </Routes>
      </MemoryRouter>
    );
    expect(replace).toHaveBeenCalledWith('https://help.bomizzel.com/gleason/tickets/abc?x=1');
  });
});
