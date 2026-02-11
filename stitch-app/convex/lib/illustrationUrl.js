/**
 * Resolve a fresh Convex storage URL for a topic illustration.
 * Convex storage URLs are signed and may expire, so callers should hydrate at read-time.
 *
 * @template TStorageId
 * @param {{
 *   illustrationStorageId?: TStorageId,
 *   getUrl: (storageId: TStorageId) => Promise<string | null>
 * }} params
 * @returns {Promise<string | undefined>}
 */
export const resolveIllustrationUrl = async ({ illustrationStorageId, getUrl }) => {
    if (!illustrationStorageId) return undefined;
    try {
        return (await getUrl(illustrationStorageId)) || undefined;
    } catch {
        return undefined;
    }
};
