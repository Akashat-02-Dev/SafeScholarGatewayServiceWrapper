import { useAuth } from '../services/authService';
import type { MeResponse } from '../services/authService';

interface FeatureGuardProps {
    featureName: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ featureName, children, fallback = null }) => {
    // Phase 2: Check tenant_features in global state
    // For now we mock the state checking logic. In reality this reads from Redux or AuthContext.
    const { me } = useAuth();
    const tenantFeatures: string[] = (me as (MeResponse & { tenantFeatures?: string[] }) | null)?.tenantFeatures || [];

    const isFeatureEnabled = tenantFeatures.includes(featureName);

    if (!isFeatureEnabled) {
        return fallback;
    }

    return <>{children}</>;
};
