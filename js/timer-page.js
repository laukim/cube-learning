import { initPracticeTimer } from "./practice-timer.js?v=splitsauto2";
import { initSmartCube } from "./smart-cube.js?v=cube3d2";
import { initTimesSync } from "./times-sync.js?v=cube2";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
initSmartCube({ timer });
