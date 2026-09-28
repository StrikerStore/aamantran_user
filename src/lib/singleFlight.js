/**
 * Collapse overlapping calls into one in-flight task.
 *
 * The builder saves on Next and also when a step tab is clicked. Those can
 * both fire before the first request returns, and each one still sees a new
 * ceremony or name as unsaved — so both create it. A second caller must share
 * the result instead of starting another write.
 */
export function createSingleFlight() {
  let flight = null;
  return function singleFlight(task) {
    if (flight) return flight;
    let tracked;
    tracked = Promise.resolve()
      .then(task)
      .finally(() => {
        if (flight === tracked) flight = null;
      });
    flight = tracked;
    return tracked;
  };
}
