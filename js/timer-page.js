import { initPracticeTimer } from "./practice-timer.js?v=cross1";
import { initTimesSync } from "./times-sync.js?v=cross1";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
