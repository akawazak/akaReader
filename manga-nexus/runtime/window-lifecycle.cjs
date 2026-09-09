'use strict';

const WINDOW_CLOSE_FLUSH_TIMEOUT_MS = 400;

function resolveWindowCloseAction({ isQuitting, closeToTray }) {
  if (isQuitting) return 'allow';
  return closeToTray ? 'hide' : 'quit';
}

module.exports = {
  WINDOW_CLOSE_FLUSH_TIMEOUT_MS,
  resolveWindowCloseAction,
};
