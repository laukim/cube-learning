import { initPracticeTimer } from "./practice-timer.js?v=history1";
import { initTimesSync } from "./times-sync.js?v=history1";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
