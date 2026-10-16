import React from 'react';
import { useLocation } from 'react-router-dom';
import { customerPortalBase } from '../portal/portalApi';
import { companyInAddress } from '../utils/companyAddress';

/**
 * Old customer portal links on portal.bomizzel.com/<name>/... (tickets,
 * sign-up): the customer portal lives on help.bomizzel.com now.
 */
const StaffPortalRedirect: React.FC = () => {
  const location = useLocation();
  window.location.replace(
    `${customerPortalBase()}/${companyInAddress()}${location.pathname}${location.search}`
  );
  return null;
};

export default StaffPortalRedirect;
