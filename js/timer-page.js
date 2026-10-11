import { initPracticeTimer } from "./practice-timer.js?v=postsolve1";
import { initSmartCube } from "./smart-cube.js?v=postsolve1";
import { initTimesSync } from "./times-sync.js?v=pllcube1";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
initSmartCube({ timer });
