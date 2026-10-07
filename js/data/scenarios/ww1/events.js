/* ============================================================
   data/scenarios/ww1/events.js —— 一战 45 条全量历史与机制事件（v3.0 W1）
   包含马恩河奇迹（D+35±5）、俄国革命链（稳定<25提前触发）等核心史实节点
   ============================================================ */

export const WW1_EVENTS = [
  // —— 1. 开战危机与七月余波 (D1-D15) ——
  {
    id: 'ww1_outbreak',
    day: 1,
    title: '战火燃遍欧陆',
    desc: '萨拉热窝的枪声引发了致命的连锁反应。同盟国与协约国互下通牒，数百万军队开始总动员。',
    important: true,
    run(w){
      return { text: '—— 萨拉热窝危机引爆大战，全欧总动员展开！', kind: 'war' };
    }
  },
  {
    id: 'scrap_of_paper_event',
    day: 5,
    title: '比利时中立被毁',
    desc: '德军第一与第二集团军大举越过比利时边境，英国宣布对德处于战争状态。',
    important: true,
    run(w){
      if(w.nations.GBR && w.nations.GER && !w.nations.GBR.atWarWith.includes('GER')){
        w.nations.GBR.atWarWith.push('GER');
        w.nations.GER.atWarWith.push('GBR');
      }
      return { text: '—— 德军借道比利时，英国以此为由正式参战！', kind: 'war' };
    }
  },
  {
    id: 'liege_siege',
    day: 10,
    title: '列日要塞的殊死抵抗',
    desc: '比利时莱曼将军在列日环形要塞抵抗德军达十余天，为英法调动争取了宝贵时间。',
    important: false,
    run(w){
      const liege = w.hexes.find(h => h.city && h.city.name === '列日');
      if(liege && liege.owner === 'BEL'){
        liege.fort = Math.max(1, liege.fort - 1);
      }
      return { text: '列日要塞装甲炮台遭德军大贝尔莎重炮轰击。', kind: 'war' };
    }
  },
  {
    id: 'battle_of_the_frontiers',
    day: 18,
    title: '边境之战血染洛林',
    desc: '法军身着蓝上衣红军裤发起进攻，在机枪扫射下遭受惨重伤亡，霞飞下令全线退却。',
    important: false,
    run(w){
      if(w.nations.FRA) w.nations.FRA.stability = Math.max(20, w.nations.FRA.stability - 5);
      return { text: '边境之战法军受挫，战线向巴黎方向急剧退缩。', kind: 'war' };
    }
  },
  {
    id: 'tannenberg_trap',
    day: 26,
    title: '坦能堡合围战役',
    desc: '兴登堡与鲁登道夫利用内线铁路机动，在东普鲁士包围并全歼沙俄第二集团军。',
    important: true,
    run(w){
      if(w.nations.RUS){
        w.nations.RUS.equip = Math.max(0, w.nations.RUS.equip - 300);
        w.nations.RUS.stability = Math.max(10, w.nations.RUS.stability - 8);
      }
      return { text: '—— 坦能堡大捷！德军在东线击溃沙俄先锋，萨姆索诺夫自尽。', kind: 'war' };
    }
  },

  // —— 2. 西线相持与堑壕化 (D30-D60) ——
  {
    id: 'marne_miracle',
    day: 35, // 验收关键：D+35±5 触发
    title: '马恩河奇迹与巴黎出租车',
    desc: '加利埃尼将军征调巴黎全部出租车将预备役火速运往马恩河，法军与英国远征军全力反扑，德军后撤！',
    important: true,
    run(w){
      // 法军组织度大幅恢复，西线获得防御加成
      for(const u of w.units){
        if(u.nat === 'FRA' || u.nat === 'GBR'){
          u.org = Math.min(80, u.org + 35);
        }
      }
      if(w.nations.FRA){
        w.nations.FRA.warSupport += 10;
        w.nations.FRA.stability += 8;
      }
      return { text: '★ 马恩河奇迹！法英联军阻滞德军突击，施里芬计划宣告破产！', kind: 'war' };
    }
  },
  {
    id: 'race_to_the_sea',
    day: 48,
    title: '奔向大海与全线堑壕化',
    desc: '双方多次试图迂回对方侧翼均告失败，战线从瑞士边境一路延伸至北海，长达七百公里的堑壕网彻底固化。',
    important: true,
    run(w){
      for(const u of w.units){
        u.entrench = Math.min(0.25, (u.entrench || 0) + 0.10);
      }
      return { text: '—— 奔向大海结束，西线全线进入长期残酷的堑壕消耗战！', kind: 'econ' };
    }
  },
  {
    id: 'ypres_first',
    day: 58,
    title: '第一次伊普尔惨烈战役',
    desc: '德军年轻学生志愿军在朗格马克向英国老兵阵地冲锋，在密集连发机枪下血流成河。',
    important: false,
    run(w){
      return { text: '伊普尔战役双方死伤惨重，战线纹丝不动。', kind: 'war' };
    }
  },
  {
    id: 'christmas_truce',
    day: 75,
    title: '圣诞节前线奇迹停火',
    desc: '圣善夜无名之地，英德士兵走出弹坑互相握手交换香烟，齐唱平安夜，战争展现出罕见的温情一幕。',
    important: false,
    run(w){
      for(const u of w.units){ u.order = null; }
      return { text: '圣诞前线自发非正式停火，士兵在无人地带互致问候。', kind: 'sys' };
    }
  },

  // —— 3. 堑壕地狱与新武器登场 (D80-D150) ——
  {
    id: 'poison_gas_ypres',
    day: 85,
    title: '伊普尔毒气战初现',
    desc: '德军在西线首次打开千只氯气瓶，黄绿色的死神毒雾顺风飘过协约国阵线，守军窒息溃散。',
    important: true,
    run(w){
      for(const u of w.units){
        if(u.nat === 'FRA' && (u.q === 5 || u.q === 6)){
          u.org = Math.max(5, u.org - 30);
        }
      }
      return { text: '⚠️ 毒气战爆发！德军在伊普尔释放氯气，局部战线陷入极大恐慌。', kind: 'war' };
    }
  },
  {
    id: 'gallipoli_landing',
    day: 95,
    title: '加里波利半岛登陆战',
    desc: '英法联军携澳新军团强登达达尼尔海峡，凯末尔率土耳其守军占领高地，将登陆部队压制在海滩。',
    important: true,
    run(w){
      const gal = w.hexes.find(h => h.city && h.city.name === '加里波利');
      if(gal && gal.owner === 'OTT') gal.fort = Math.min(5, gal.fort + 2);
      return { text: '—— 协约国加里波利登陆受挫，澳新军团遭遇顽强阻击。', kind: 'war' };
    }
  },
  {
    id: 'italy_enters_war',
    day: 105,
    title: '意大利签署伦敦条约参战',
    desc: '经协约国领土许诺，意大利撕毁三国同盟协议，正式向奥匈帝国宣战，开辟伊松佐河战线！',
    important: true,
    run(w){
      if(w.nations.ITA && w.nations.AUS){
        if(!w.nations.ITA.atWarWith.includes('AUS')) w.nations.ITA.atWarWith.push('AUS');
        if(!w.nations.AUS.atWarWith.includes('ITA')) w.nations.AUS.atWarWith.push('ITA');
      }
      return { text: '★ 意大利倒戈参战！对奥匈帝国宣战，开辟阿尔卑斯高山战场！', kind: 'war' };
    }
  },
  {
    id: 'lusitania_sunk',
    day: 115,
    title: '卢西塔尼亚号邮轮被击沉',
    desc: '德国U-20号潜艇在爱尔兰海域鱼雷击沉英国客轮，包括128名美国公民在内的一千余人丧生，美国舆论沸腾。',
    important: true,
    run(w){
      if(w.nations.USA) w.nations.USA.warSupport += 25;
      return { text: '卢西塔尼亚号遭潜艇击沉，美德外交关系急剧恶化。', kind: 'war' };
    }
  },
  {
    id: 'gorlice_tarnow',
    day: 125,
    title: '戈尔利采-塔尔努夫大突破',
    desc: '马肯森指挥德奥联军以压倒性火炮轰击撕碎沙俄防线，迫使俄军展开全线大撤退。',
    important: false,
    run(w){
      const warsaw = w.hexes.find(h => h.city && h.city.name === '华沙');
      if(warsaw && warsaw.owner === 'RUS') warsaw.owner = 'GER';
      return { text: '东线德奥联军攻克华沙，俄军放弃波兰全境后撤。', kind: 'war' };
    }
  },
  {
    id: 'bulgaria_enters',
    day: 135,
    title: '保加利亚加入同盟国',
    desc: '为收复马其顿，保加利亚沙皇宣布参战，南北夹击塞尔维亚。',
    important: true,
    run(w){
      if(w.nations.BUL && w.nations.SRB){
        if(!w.nations.BUL.atWarWith.includes('SRB')) w.nations.BUL.atWarWith.push('SRB');
        if(!w.nations.SRB.atWarWith.includes('BUL')) w.nations.SRB.atWarWith.push('BUL');
      }
      return { text: '保加利亚参战！塞尔维亚腹背受敌，陷入空前绝境。', kind: 'war' };
    }
  },
  {
    id: 'verdun_inferno',
    day: 150,
    title: '凡尔登绞肉机爆发',
    desc: '法金汉发起凡尔登战役，意图放干法军血液；贝当誓死固守，数十万年轻士兵在狭小山丘间化为焦土。',
    important: true,
    run(w){
      const verdun = w.hexes.find(h => h.city && h.city.name === '凡尔登');
      if(verdun) verdun.fort = 3;
      return { text: '—— 凡尔登绞肉机启动，德法两军数十万主力展开人类史上最血腥消耗战！', kind: 'war' };
    }
  },
  {
    id: 'jutland_clash',
    day: 160,
    title: '日德兰海战世纪大对决',
    desc: '杰利科与舍尔在北海爆发人类最大规模无畏舰海战，皇家海军保住了远程封锁制海权。',
    important: false,
    run(w){
      return { text: '日德兰海战结束，德国公海舰队未能打破英国海上封锁。', kind: 'war' };
    }
  },
  {
    id: 'brusilov_glory',
    day: 168,
    title: '布鲁西洛夫攻势横扫加里西亚',
    desc: '沙皇俄军在西南战线全线突击，俘虏奥匈四十万部队，迫使德军从西线抽调部队救援。',
    important: true,
    run(w){
      if(w.nations.AUS){
        w.nations.AUS.equip = Math.max(0, w.nations.AUS.equip - 300);
        w.nations.AUS.stability = Math.max(10, w.nations.AUS.stability - 12);
      }
      return { text: '★ 布鲁西洛夫攻势大捷！奥匈帝国前线近乎崩溃，德军火速驰援。', kind: 'war' };
    }
  },
  {
    id: 'somme_tanks_first',
    day: 175,
    title: '索姆河战役与钢铁水柜初登场',
    desc: '黑格在索姆河投入了人类历史上第一批履带坦克，铁甲怪物撕破铁丝网，开启装甲战争时代。',
    important: true,
    run(w){
      if(w.nations.GBR) w.nations.GBR.techs.push('light_tank');
      return { text: '—— 索姆河战役爆发，英国马克I型坦克首度投入实战！', kind: 'war' };
    }
  },
  {
    id: 'romania_entry',
    day: 182,
    title: '罗马尼亚加入协约国',
    desc: '受布鲁西洛夫大捷鼓舞，罗马尼亚宣战同盟国并进军特兰西瓦尼亚。',
    important: false,
    run(w){
      if(w.nations.ROM && w.nations.AUS){
        if(!w.nations.ROM.atWarWith.includes('AUS')) w.nations.ROM.atWarWith.push('AUS');
        if(!w.nations.AUS.atWarWith.includes('ROM')) w.nations.AUS.atWarWith.push('ROM');
      }
      return { text: '罗马尼亚加入协约国，多瑙河战线进一步扩大。', kind: 'war' };
    }
  },

  // —— 4. 俄国革命链（动态判定：稳定 < 25 或 日历到达） ——
  {
    id: 'february_revolution',
    day: 120, // 亦可在稳定度<25时被提前触发
    condition(w){
      const r = w.nations.RUS;
      return r && (r.stability < 25 || w.day >= 185);
    },
    title: '彼得格勒二月革命爆发',
    desc: '罢工工人和起义士兵占领杜马大厦，沙皇尼古拉二世在莫吉廖夫签署退位诏书，罗曼诺夫王朝覆灭！',
    important: true,
    run(w){
      if(w.nations.RUS){
        w.nations.RUS.stability = 20;
        w.nations.RUS.law = 'civilian';
      }
      return { text: '⚠️ 俄罗斯二月革命爆发！沙皇退位，临时政府宣告成立但国内动荡加剧！', kind: 'war' };
    }
  },
  {
    id: 'lenin_returns',
    day: 130,
    condition(w){
      return w.events.some(e => e.id === 'february_revolution') || (w.nations.RUS && w.nations.RUS.stability < 20);
    },
    title: '列宁的密闭列车抵达芬兰车站',
    desc: '德皇情报机关安排列宁穿越欧洲返俄。列宁在装甲车上发表《四月提纲》，号召全部政权归苏维埃！',
    important: true,
    run(w){
      if(w.nations.RUS){
        w.nations.RUS.stability = Math.max(5, w.nations.RUS.stability - 10);
      }
      return { text: '列宁发表《四月提纲》，苏维埃运动席卷全俄工人与前线士兵！', kind: 'war' };
    }
  },
  {
    id: 'october_revolution',
    day: 140,
    condition(w){
      return w.events.some(e => e.id === 'lenin_returns') || (w.nations.RUS && w.nations.RUS.stability < 15);
    },
    title: '阿芙乐尔号炮响：十月革命胜利',
    desc: '布尔什维克赤卫队攻占冬宫，克伦斯基逃亡，列宁在全俄苏维埃大会宣布苏维埃政权诞生！',
    important: true,
    run(w){
      if(w.nations.RUS){
        w.nations.RUS.name = '苏维埃俄国';
        w.nations.RUS.stability = 60;
        w.nations.RUS.warSupport = 10; // 反战思潮登顶
      }
      return { text: '★ 十月革命胜利！苏维埃工农政府宣告成立，准备与同盟国谈判停战！', kind: 'war' };
    }
  },
  {
    id: 'brest_litovsk_treaty',
    day: 155,
    condition(w){
      return w.events.some(e => e.id === 'october_revolution');
    },
    title: '布列斯特-立陶夫斯克和约签订',
    desc: '托洛茨基签署布列斯特条约，苏俄正式退出一战，割让波兰、波罗的海与乌克兰，德军东线兵力得以西调！',
    important: true,
    run(w){
      if(w.nations.RUS){
        w.nations.RUS.atWarWith = [];
        w.nations.RUS.capitulated = true;
      }
      // 德军在西线获得组织与经验加成
      if(w.nations.GER){
        w.nations.GER.equip += 600;
        w.nations.GER.mil += 3;
      }
      return { text: '★ 苏俄签署布列斯特和约退出战争！德军百万东线老兵全速转调西线！', kind: 'war' };
    }
  },

  // —— 5. 美国参战与终局 (D160-D200) ——
  {
    id: 'zimmermann_telegram',
    day: 165,
    title: '齐默尔曼密电公之于众',
    desc: '英国军情处截获德国外长密电，密电唆使墨西哥向美国宣战以收复德克萨斯。美国公众震怒。',
    important: true,
    run(w){
      if(w.nations.USA) w.nations.USA.warSupport += 30;
      return { text: '齐默尔曼电报曝光，美国民意彻底倒向协约国阵营。', kind: 'war' };
    }
  },
  {
    id: 'usa_declares_war',
    day: 172,
    title: '美国正式对德宣战',
    desc: '威尔逊总统在国会发表演说，美国以全副工农业产能加入对德同盟，天平发生不可逆转倾斜！',
    important: true,
    run(w){
      if(w.nations.USA && w.nations.GER){
        if(!w.nations.USA.atWarWith.includes('GER')) w.nations.USA.atWarWith.push('GER');
        if(!w.nations.GER.atWarWith.includes('USA')) w.nations.GER.atWarWith.push('USA');
        w.nations.USA.mil += 5;
        w.nations.USA.law = 'war';
      }
      return { text: '★ 美利坚合众国参战！无穷尽的工业与生力军跨越大西洋！', kind: 'war' };
    }
  },
  {
    id: 'spring_offensive_1918',
    day: 180,
    title: '鲁登道夫春季攻势',
    desc: '德军突击队在皮卡第发动猛攻撕开英法接合部，巴黎遭受克虏伯超远程大炮轰击。',
    important: true,
    run(w){
      for(const u of w.units){
        if(u.nat === 'GER') u.atk = (u.atk || 6) + 2;
      }
      return { text: '德军春季攻势全线展开，西线迎来战争以来最大危机。', kind: 'war' };
    }
  },
  {
    id: 'przemysl_first_siege',
    day: 42,
    title: '普热梅希尔要塞初次围城',
    desc: '俄军包围奥匈帝国最强大的加里西亚要塞，双方在暴风雪中展开炮击战。',
    important: false,
    run(w){ return { text: '普热梅希尔要塞被俄军重兵包围，奥匈守军依托暗堡坚守。', kind: 'war' }; }
  },
  {
    id: 'lodz_maneuver',
    day: 52,
    title: '洛兹机动作战',
    desc: '德军第九集团军在波兰中部发动机动侧翼包抄，阻滞了沙俄进军西里西亚的企图。',
    important: false,
    run(w){ return { text: '洛兹战役德俄两军激烈胶着，双方战线在波兰平原拉平。', kind: 'war' }; }
  },
  {
    id: 'falkland_islands_battle',
    day: 62,
    title: '福克兰群岛海战',
    desc: '英国皇家海军战列巡洋舰截击德国施佩伯爵东亚分舰队，清除南大西洋威胁。',
    important: false,
    run(w){ return { text: '福克兰群岛海战皇家海军获胜，大洋航路安全得以强化。', kind: 'econ' }; }
  },
  {
    id: 'dogger_bank_clash',
    day: 70,
    title: '多格尔沙洲海战',
    desc: '贝蒂与希佩尔在北海爆发战列巡洋舰前哨战，布吕歇尔号装甲巡洋舰沉没。',
    important: false,
    run(w){ return { text: '多格尔沙洲海战结束，德军暂敛公海舰队锐气。', kind: 'war' }; }
  },
  {
    id: 'carpathian_winter_hell',
    day: 80,
    title: '喀尔巴阡冬季血战',
    desc: '奥匈军在零下三十度严寒中试图解救普热梅希尔要塞，成千上万伤员冻死在雪崩与雪原上。',
    important: false,
    run(w){
      if(w.nations.AUS) w.nations.AUS.equip = Math.max(0, w.nations.AUS.equip - 100);
      return { text: '喀尔巴阡冰雪战役极其惨烈，奥匈解围企图受挫。', kind: 'war' };
    }
  },
  {
    id: 'przemysl_falls',
    day: 90,
    title: '普热梅希尔要塞陷落',
    desc: '弹尽粮绝之际，奥匈守军引爆弹药库向俄军投降，十二万精锐官兵沦为俘虏。',
    important: true,
    run(w){
      const prz = w.hexes.find(h => h.city && h.city.name === '普热梅希尔');
      if(prz) prz.owner = 'RUS';
      return { text: '—— 普热梅希尔要塞弹尽投降，俄军进占加里西亚门户！', kind: 'war' };
    }
  },
  {
    id: 'second_ypres_clash',
    day: 98,
    title: '第二次伊普尔防毒面具普及',
    desc: '加拿大军团用浸湿尿液的毛巾抵抗毒气并顽强守住阵地，第一代军用防毒面具迅速配发全军。',
    important: false,
    run(w){ return { text: '前线紧急配发浸药防毒面罩，化学毒气威慑力大幅削弱。', kind: 'econ' }; }
  },
  {
    id: 'vardar_valley_clash',
    day: 110,
    title: '瓦尔达尔河谷战线',
    desc: '同盟国军队沿瓦尔达尔河南推，建立牢固的马其顿封锁线。',
    important: false,
    run(w){ return { text: '同盟国在巴尔干建立起坚不可摧的南部防守屏障。', kind: 'war' }; }
  },
  {
    id: 'kut_siege_starvation',
    day: 128,
    title: '美索不达米亚库特围城',
    desc: '一万三千名英印部队在底格里斯河畔被奥斯曼军队彻底包围并陷入粮荒。',
    important: false,
    run(w){ return { text: '美索不达米亚库特围城白热化，英军救援部队受挫。', kind: 'war' }; }
  },
  {
    id: 'kut_surrender_event',
    day: 142,
    title: '库特英军全员投降',
    desc: '汤森德将军率全体被围官兵向土耳其军队投降，大英帝国在中东遭受前所未有的声誉重创。',
    important: true,
    run(w){
      if(w.nations.GBR) w.nations.GBR.stability = Math.max(20, w.nations.GBR.stability - 6);
      return { text: '—— 库特英军投降！奥斯曼帝国赢得美索不达米亚战役辉煌胜利！', kind: 'war' };
    }
  },
  {
    id: 'arab_revolt_outbreak',
    day: 152,
    title: '汉志阿拉伯大起义',
    desc: '麦加谢里夫侯赛因鸣枪宣布起义，阿拉伯游击队在劳伦斯协助下切断汉志铁路。',
    important: true,
    run(w){
      if(w.nations.OTT) w.nations.OTT.stability = Math.max(10, w.nations.OTT.stability - 10);
      return { text: '阿拉伯半岛爆发大起义，奥斯曼后方补给线陷入瘫痪！', kind: 'war' };
    }
  },
  {
    id: 'caporetto_breakthrough_event',
    day: 162,
    title: '卡波雷托世纪大突破',
    desc: '德奥联军使用胡蒂尔突击战术加毒气奇袭，一举击溃意大利第二军团，俘虏官兵近三十万。',
    important: true,
    run(w){
      if(w.nations.ITA){
        w.nations.ITA.stability = Math.max(10, w.nations.ITA.stability - 15);
        w.nations.ITA.equip = Math.max(0, w.nations.ITA.equip - 200);
      }
      return { text: '★ 卡波雷托大突破！德奥联军重任意军，意军后撤至皮亚韦河重组防线。', kind: 'war' };
    }
  },
  {
    id: 'passchendaele_mud',
    day: 170,
    title: '帕斯尚尔泥泞血战',
    desc: '连日暴雨将法兰德斯化为无底泥潭，步兵只能在浮木小径上摸索前进，滑入弹坑即被活活溺死。',
    important: false,
    run(w){ return { text: '帕斯尚尔战役陷入无休止泥泞，双方官兵身心俱疲。', kind: 'war' }; }
  },
  {
    id: 'montello_ridge_stand',
    day: 174,
    title: '皮亚韦河蒙特罗山脊战役',
    desc: '意军依靠法英援军挫败奥匈最后的大举进攻，彻底守住威尼斯门户。',
    important: false,
    run(w){ return { text: '意军在皮亚韦河挡住奥匈最后攻势，战线归于相持。', kind: 'war' }; }
  },
  {
    id: 'cambrai_tank_mass',
    day: 176,
    title: '康布雷坦克大兵团突击',
    desc: '四百余辆坦克在没有常规漫长炮轰下横扫兴登堡防线，全英国教堂钟声为此欢鸣。',
    important: true,
    run(w){ return { text: '★ 康布雷坦克集群突破！机械化铁流震撼德军统帅部。', kind: 'war' }; }
  },
  {
    id: 'black_day_german_army',
    day: 188,
    title: '德意志陆军黑日（亚眠战役）',
    desc: '澳加军团在坦克掩护下闪电突破，鲁登道夫称之为"德意志帝国陆军历史上最黑暗的一天"。',
    important: true,
    run(w){
      if(w.nations.GER) w.nations.GER.stability = Math.max(10, w.nations.GER.stability - 18);
      return { text: '—— 亚眠大突破！德军士气彻底崩溃，大批前线部队放弃抵抗！', kind: 'war' };
    }
  },
  {
    id: 'kiel_mutiny_event',
    day: 195,
    title: '基尔军港水兵起义',
    desc: '公海舰队水兵拒绝执行绝望的自杀性出击命令，红色旗帜在军舰桅杆上升起，革命蔓延全国。',
    important: true,
    run(w){
      if(w.nations.GER){
        w.nations.GER.stability = 5;
        w.nations.GER.warSupport = 10;
      }
      return { text: '⚠️ 基尔水兵起义！十一月革命席卷柏林，德皇宣布退位流亡！', kind: 'war' };
    }
  },
  {
    id: 'armistice_compiègne',
    day: 200,
    title: '康边森林停战协定',
    desc: '同盟国同盟瓦解，德皇退位流亡，停战协议在康边森林福煦元帅的车厢内签署。十一月十一日十一时，欧陆枪炮声停息。',
    important: true,
    run(w){
      w.over = { win: true, text: '康边森林停战协议签订，历时四年的一战落下帷幕，十一月的枪炮归于平静。' };
      return { text: '★ 停战协定签署！大战终局，欧洲大地重获和平。', kind: 'war' };
    }
  }
];

export function checkWW1Events(world){
  const results = [];
  for(const ev of WW1_EVENTS){
    if(world._triggeredEvents && world._triggeredEvents.has(ev.id)) continue;
    let match = false;
    if(ev.condition){
      match = ev.condition(world);
    } else if(ev.day != null && world.day >= ev.day){
      match = true;
    }
    if(match){
      world._triggeredEvents = world._triggeredEvents || new Set();
      world._triggeredEvents.add(ev.id);
      const res = ev.run(world);
      results.push({ ...res, important: ev.important, day: world.day });
    }
  }
  return results;
}
