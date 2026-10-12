import { initPracticeTimer } from "./practice-timer.js?v=llcalm1";
import { initSmartCube } from "./smart-cube.js?v=lllive1";
import { initTimesSync } from "./times-sync.js?v=llcalm1";

let sync;
const timer = initPracticeTimer({
  isActive: () => true,
  onRecordsChanged: (event) => sync?.handleLocalChange(event),
});
sync = initTimesSync({
  onSynced: () => timer?.refresh?.(),
});
initSmartCube({ timer });
