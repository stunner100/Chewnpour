// NOTE: This is a BUILD-TIME gate baked in by Vite, not a runtime toggle.
// Changing VITE_MAINTENANCE_MODE in the hosting dashboard has no effect until
// the frontend is rebuilt and redeployed. It also only hides the UI — it does
// NOT block Convex mutations, so it is not sufficient on its own to protect a
// backend during a data migration (that needs a server-side write guard).
export const maintenanceModeEnabled =
    import.meta.env.VITE_MAINTENANCE_MODE === 'true';
