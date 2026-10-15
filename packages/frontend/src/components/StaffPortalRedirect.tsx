import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { customerPortalBase } from '../portal/portalApi';

/**
 * portal.bomizzel.com/<name> is the company's staff sign-in. The bare name
 * goes to /<name>/login; anything deeper is an old customer portal link
 * (tickets, sign-up, password reset...), which now lives on help.bomizzel.com.
 */
const StaffPortalRedirect: React.FC = () => {
  const { slug = '' } = useParams();
  const location = useLocation();
  const rest = location.pathname.replace(/^\/+[^/]+\/?/, '');
  if (!rest) return <Navigate to={`/${slug}/login`} replace />;
  window.location.replace(`${customerPortalBase()}${location.pathname}${location.search}`);
  return null;
};

export default StaffPortalRedirect;
