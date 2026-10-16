import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isStaffPortalHost } from '../portal/portalApi';
import { companyInAddress, signedInCompany } from '../utils/companyAddress';

/**
 * On portal.bomizzel.com the address and the sign-in name the same company:
 * signed in with no company in the address, it's added
 * (/agent -> /gleason/agent); signed in to a different company than the
 * address says, they sign in again for this one.
 */
const CompanyAddressGuard: React.FC = () => {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!isStaffPortalHost() || !user) return;
    const theirs = signedInCompany()?.portalName;
    const here = companyInAddress();
    if (!here) {
      if (theirs) {
        window.location.replace(`/${theirs}${window.location.pathname}${window.location.search}`);
      }
      return;
    }
    if (theirs && theirs.toLowerCase() !== here.toLowerCase()) logout();
  }, [user, logout]);

  return null;
};

export default CompanyAddressGuard;
