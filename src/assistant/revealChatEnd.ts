/**
 * Phone only (messages flow in the page, phoneLayout.css): scroll just enough that the
 * newest message ends right above the message field. A short chat that fits on the
 * screen is left alone, so the page does not slide its top under the claude.ai header.
 */
export function revealChatEnd(messageList: HTMLElement) {
  const composer = messageList.parentElement?.querySelector(".rl-composer-bar");
  if (!composer) return;
  const hiddenBelowField = messageList.getBoundingClientRect().bottom - composer.getBoundingClientRect().top;
  if (hiddenBelowField > 0) window.scrollBy({ top: hiddenBelowField });
}
