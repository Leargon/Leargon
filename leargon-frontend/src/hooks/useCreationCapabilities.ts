import { useGetCreationCapabilities } from '../api/generated/creation/creation';
import type { CreatableItemType } from '../api/generated/model/creatableItemType';
import type { CreationCapabilitiesResponse } from '../api/generated/model/creationCapabilitiesResponse';

/**
 * What the current user may create, as decided by the backend creation policy (`GET /creation/capabilities`).
 *
 * The "New" buttons use this instead of re-deriving roles in the browser: whether someone may create an
 * item depends on realms (domain / bounded-context / unit ownership), not just on roles, and only the
 * backend knows those.
 */
export function useCreationCapabilities() {
  const { data: response, isLoading } = useGetCreationCapabilities();
  const items = (response?.data as CreationCapabilitiesResponse | undefined)?.items ?? [];
  const find = (itemType: CreatableItemType) => items.find((item) => item.itemType === itemType);

  return {
    /** The user may create this item type somewhere (top level or inside a realm they own). */
    canCreate: (itemType: CreatableItemType) => find(itemType)?.canCreate ?? false,
    /** The user may create this item type at top level / unplaced (admin or methodology editor). */
    canCreateUnplaced: (itemType: CreatableItemType) => find(itemType)?.canCreateUnplaced ?? false,
    isLoading,
  };
}

/** Shorthand for list panels: may the current user create an item of [itemType] anywhere? */
export function useCanCreate(itemType: CreatableItemType): boolean {
  return useCreationCapabilities().canCreate(itemType);
}

export default useCreationCapabilities;
