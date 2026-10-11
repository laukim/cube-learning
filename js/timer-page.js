import { initPracticeTimer } from "./practice-timer.js?v=splitsauto3";
import { initSmartCube } from "./smart-cube.js?v=cube3d2";
import { initTimesSync } from "./times-sync.js?v=cube3";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
initSmartCube({ timer });
