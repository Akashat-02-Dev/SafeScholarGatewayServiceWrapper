import React from 'react';
import { useAuth } from '../services/authService';

interface FeatureGuardProps {
    featureName: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ featureName, children, fallback = null }) => {
    // Phase 2: Check tenant_features in global state
    // For now we mock the state checking logic. In reality this reads from Redux or AuthContext.
    const { user } = useAuth();
    const tenantFeatures: string[] = user?.tenantFeatures || [];

    const isFeatureEnabled = tenantFeatures.includes(featureName);

    if (!isFeatureEnabled) {
        return fallback;
    }

    return <>{children}</>;
};
