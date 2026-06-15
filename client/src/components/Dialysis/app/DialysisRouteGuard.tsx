import React from 'react';
import { useLocation } from 'react-router-dom';
import DialysisForbiddenPage from './DialysisForbiddenPage';
import { canAccessDialysisPath, useDialysisRouteCaps } from './dialysisRouteAccess';

interface Props {
  children: React.ReactNode;
}

const DialysisRouteGuard: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const caps = useDialysisRouteCaps();

  if (!canAccessDialysisPath(location.pathname, caps)) {
    return <DialysisForbiddenPage />;
  }

  return <>{children}</>;
};

export default DialysisRouteGuard;
