// jsdom has no scrolling viewport. Navigation tests spy on this browser API.
if (typeof window !== "undefined") {
  window.scrollTo = () => {};
}

/**
 * jsdom does not implement HTMLDialogElement's modal methods. The source
 * drawer is a native <dialog>, so give the tests just enough of it to assert
 * on rendered content and the open/closed flag.
 */
// Contract tests run in the node environment, where there is no DOM at all.
if (
  typeof HTMLDialogElement !== "undefined" &&
  !HTMLDialogElement.prototype.showModal
) {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}
