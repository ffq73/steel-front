import { loadScenario } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';

const nationsToTest = ['GER', 'RUS', 'FRA', 'GBR', 'AUS'];
for(const nat of nationsToTest){
  const w = loadScenario('ww1', 1914 + nat.charCodeAt(0));
  w.player = nat;
  const rng = makeRng(1914 + nat.charCodeAt(0));
  let day = 0;
  while(!w.over && day < 200){
    day++;
    dayTick(w, rng);
  }
  const result = w.over ? (w.over.win ? '胜利' : '战败') : '时限达成';
  console.log(`- 玩家 ${nat} 通局完成: 历时 ${w.day} 天, 终局: ${result}, 说明: ${w.over ? w.over.text : '战役结束'}`);
}
