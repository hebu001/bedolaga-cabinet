export type SubscriptionSelection = Record<number, boolean>;

export function visibleSelectionState(selection: SubscriptionSelection, visibleIds: number[]) {
  const all = visibleIds.length > 0 && visibleIds.every((id) => selection[id]);
  return { all, some: !all && visibleIds.some((id) => selection[id]) };
}

/** Toggle this page/filter only; IDs selected on other pages remain untouched. */
export function toggleVisibleSubscriptions(
  selection: SubscriptionSelection,
  visibleIds: number[],
): SubscriptionSelection {
  const next = { ...selection };
  const { all } = visibleSelectionState(selection, visibleIds);
  for (const id of visibleIds) {
    if (all) delete next[id];
    else next[id] = true;
  }
  return next;
}
