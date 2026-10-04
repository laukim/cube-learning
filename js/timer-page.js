import { initPracticeTimer } from "./practice-timer.js?v=sync2";
import { initTimesSync } from "./times-sync.js?v=sync2";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
