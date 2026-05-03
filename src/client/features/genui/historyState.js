export function createHistoryState(max = 5) {
  return {
    entries: [],
    index: -1,
    max,
  };
}

export function pushHistory(state, entry) {
  const nextEntries = state.entries.slice(0, state.index + 1);
  nextEntries.push(entry);
  while (nextEntries.length > state.max) nextEntries.shift();
  return {
    ...state,
    entries: nextEntries,
    index: nextEntries.length - 1,
  };
}
