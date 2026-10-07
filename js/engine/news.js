/* ============================================================
   engine/news.js —— 新闻快报与号外报纸系统 (v4.0 §4.3 / P4)
   管理全球滚动快讯队列与战役历史重大节点号外头条
   ============================================================ */

import { addTension } from './tension.js';
import { SCENARIO_A_EVENTS } from '../data/events40.js';

export function initNews(world){
  world.newsFeed = world.newsFeed || [];
  world.seenEvents = world.seenEvents || [];
  world.pendingNewspaper = world.pendingNewspaper || null;
}

export function pushNews(world, headline, category = 'mil'){
  initNews(world);
  world.newsFeed.unshift({
    day: world.day,
    headline,
    category
  });
  if(world.newsFeed.length > 50) world.newsFeed.pop();
}

/**
 * 每日检查并触发剧本历史动态事件与号外报纸
 */
export function checkDailyEvents(world){
  initNews(world);
  if(world.scenario !== 'A') return;

  for(const ev of SCENARIO_A_EVENTS){
    if(ev.day === world.day && !world.seenEvents.includes(ev.id)){
      world.seenEvents.push(ev.id);

      if(ev.tensionAdd){
        addTension(world, ev.tensionAdd, ev.title);
      }

      pushNews(world, `【战地快讯】${ev.title}`, 'urgent');

      // 重要节点弹出号外报纸
      const isExtra = [0, 3, 8, 17, 26, 33, 40].includes(ev.day);
      if(isExtra){
        world.pendingNewspaper = {
          id: ev.id,
          day: world.day,
          date: `1939年9月${world.day + 1}日`,
          paperName: '柏林日报 · 战时特刊 EXTRA',
          headline: ev.title,
          desc: ev.desc,
          choices: ev.choices || [{ text: '知悉战况。', effect: {} }]
        };
        // 自动暂停战局
        world.speed = 0;
      }
    }
  }
}
