import { APP_EVENTS } from "../../../constants/events";

export function dispatchBranchRefreshEvents() {
  window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
  window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
  window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
}
