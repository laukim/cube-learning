import { initPracticeTimer } from "./practice-timer.js?v=periods1";
import { initSmartCube } from "./smart-cube.js?v=cube1";
import { initTimesSync } from "./times-sync.js?v=cube1";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
initSmartCube({ timer });
