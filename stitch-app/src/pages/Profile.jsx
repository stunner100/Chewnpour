import { Navigate } from 'react-router-dom';

/**
 * Legacy Profile route cut over to settings.
 * Keep this module as a hard redirect so old imports/deep links never hit Convex again.
 */
const Profile = () => <Navigate to="/dashboard/settings#profile" replace />;

export default Profile;
