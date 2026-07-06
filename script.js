(() => {
  "use strict";

  const SAVE_KEY = "bungeoppang-snow-market-v3";
  const DAY_SECONDS = 105;
  const SLOT_COUNT = 12;
  const MAX_ORDERS = 3;
  const won = new Intl.NumberFormat("ko-KR");

  const recipes = [
    { id: "redbean", name: "팥", short: "팥", color: "#8b3f39", price: 65, unlockCost: 0 },
    { id: "custard", name: "슈크림", short: "슈", color: "#e0a33a", price: 72, unlockCost: 0 },
    { id: "cheese", name: "치즈", short: "치", color: "#f1bd35", price: 82, unlockCost: 240 },
    { id: "sweetpotato", name: "고구마", short: "고", color: "#a864d6", price: 92, unlockCost: 330 },
    { id: "matcha", name: "말차", short: "말", color: "#4b9c63", price: 104, unlockCost: 430 }
  ];

  const upgrades = [
    {
      id: "mold",
      name: "붕어틀 확장",
      meta: "조리칸을 2칸씩 추가",
      icon: "▦",
      base: 180,
      max: 3
    },
    {
      id: "heat",
      name: "고화력 열판",
      meta: "굽는 속도 증가",
      icon: "火",
      base: 160,
      max: 5
    },
    {
      id: "wrap",
      name: "리본 포장",
      meta: "서빙 수익 증가",
      icon: "＋",
      base: 150,
      max: 5
    },
    {
      id: "charm",
      name: "눈꽃 간판",
      meta: "손님 대기시간 증가",
      icon: "★",
      base: 135,
      max: 4
    },
    {
      id: "display",
      name: "온장 진열대",
      meta: "완성품 유지시간 증가",
      icon: "▣",
      base: 190,
      max: 4
    }
  ];

  const customerNames = ["민지", "도윤", "하린", "지후", "서아", "유준", "나윤", "이준", "라온"];
  const customerLooks = [
    { skin: "#ffd0aa", hair: "#433141", coat: "#45bdd1" },
    { skin: "#f1aa7b", hair: "#2f2e38", coat: "#ff647d" },
    { skin: "#ffe0bd", hair: "#e17e38", coat: "#79c763" },
    { skin: "#c78155", hair: "#8fe2d6", coat: "#9668e8" },
    { skin: "#f8c59d", hair: "#614131", coat: "#ff9a34" },
    { skin: "#e8a77d", hair: "#6c89d9", coat: "#54c7b0" }
  ];

  const defaultSave = {
    coins: 520,
    gems: 12,
    day: 1,
    bestRevenue: 0,
    unlockedRecipes: ["redbean", "custard"],
    upgrades: {
      mold: 0,
      heat: 0,
      wrap: 0,
      charm: 0,
      display: 0
    },
    claimedMissions: {}
  };

  const els = {
    dayText: document.querySelector("#dayText"),
    coinsText: document.querySelector("#coinsText"),
    gemsText: document.querySelector("#gemsText"),
    timerText: document.querySelector("#timerText"),
    goalLabel: document.querySelector("#goalLabel"),
    goalFill: document.querySelector("#goalFill"),
    revenueText: document.querySelector("#revenueText"),
    orders: document.querySelector("#orders"),
    comboText: document.querySelector("#comboText"),
    selectedRecipeText: document.querySelector("#selectedRecipeText"),
    heatText: document.querySelector("#heatText"),
    grill: document.querySelector("#grill"),
    recipes: document.querySelector("#recipes"),
    toolButtons: Array.from(document.querySelectorAll(".tool-button")),
    shopButton: document.querySelector("#shopButton"),
    missionsButton: document.querySelector("#missionsButton"),
    newDayButton: document.querySelector("#newDayButton"),
    pauseButton: document.querySelector("#pauseButton"),
    shopSheet: document.querySelector("#shopSheet"),
    missionsSheet: document.querySelector("#missionsSheet"),
    upgradeList: document.querySelector("#upgradeList"),
    recipeShop: document.querySelector("#recipeShop"),
    missionList: document.querySelector("#missionList"),
    daySummary: document.querySelector("#daySummary"),
    summaryStats: document.querySelector("#summaryStats"),
    summaryButton: document.querySelector("#summaryButton"),
    closeButtons: Array.from(document.querySelectorAll(".close-sheet")),
    toast: document.querySelector("#toast")
  };

  const state = {
    save: loadSave(),
    running: true,
    paused: false,
    timeLeft: DAY_SECONDS,
    revenue: 0,
    closedDay: 1,
    closedGoal: 0,
    closedBonus: 0,
    tool: "batter",
    selectedRecipeId: "redbean",
    orders: [],
    orderRenderKey: "__init__",
    slots: createSlots(),
    grillRenderKey: "__init__",
    nextOrderIn: 0.4,
    combo: 1,
    maxCombo: 1,
    lastTick: performance.now(),
    lastRender: 0,
    stats: createStats(),
    missions: []
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!parsed || typeof parsed !== "object") {
        return clone(defaultSave);
      }

      return {
        ...clone(defaultSave),
        ...parsed,
        unlockedRecipes: Array.isArray(parsed.unlockedRecipes)
          ? parsed.unlockedRecipes
          : clone(defaultSave.unlockedRecipes),
        upgrades: {
          ...clone(defaultSave.upgrades),
          ...(parsed.upgrades || {})
        },
        claimedMissions: parsed.claimedMissions || {}
      };
    } catch (error) {
      return clone(defaultSave);
    }
  }

  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
  }

  function createStats() {
    return {
      pieces: 0,
      orders: 0,
      missed: 0,
      burned: 0,
      perfect: 0
    };
  }

  function createSlots() {
    return Array.from({ length: SLOT_COUNT }, (_, index) => ({
      index,
      stage: "empty",
      recipeId: null,
      progress: 0,
      readyAge: 0,
      perfectFront: false
    }));
  }

  function getUpgradeLevel(id) {
    return state.save.upgrades[id] || 0;
  }

  function getCapacity() {
    return Math.min(SLOT_COUNT, 6 + getUpgradeLevel("mold") * 2);
  }

  function getCookRate() {
    return 24 + getUpgradeLevel("heat") * 3.8;
  }

  function getServeBonus() {
    return 1 + getUpgradeLevel("wrap") * 0.09;
  }

  function getPatienceBonus() {
    return 1 + getUpgradeLevel("charm") * 0.12;
  }

  function getReadyWindow() {
    return 7.5 + getUpgradeLevel("display") * 1.25;
  }

  function getGoal() {
    return 720 + (state.save.day - 1) * 145;
  }

  function money(value) {
    return `${won.format(Math.max(0, Math.round(value)))}원`;
  }

  function compactMoney(value) {
    return won.format(Math.max(0, Math.round(value)));
  }

  function formatTime(seconds) {
    const safe = Math.max(0, seconds);
    const minute = Math.floor(safe / 60)
      .toString()
      .padStart(2, "0");
    const rest = Math.floor(safe % 60)
      .toString()
      .padStart(2, "0");
    return `${minute}:${rest}`;
  }

  function getRecipe(id) {
    return recipes.find((recipe) => recipe.id === id) || recipes[0];
  }

  function unlockedRecipes() {
    return recipes.filter((recipe) => state.save.unlockedRecipes.includes(recipe.id));
  }

  function isUnlocked(recipeId) {
    return state.save.unlockedRecipes.includes(recipeId);
  }

  function selectRecipe(recipeId) {
    if (!isUnlocked(recipeId)) {
      openSheet("shopSheet");
      showToast("상점에서 레시피를 해금할 수 있습니다");
      return;
    }
    state.selectedRecipeId = recipeId;
    renderAll();
  }

  function selectTool(tool) {
    state.tool = tool;
    renderTools();
  }

  function setPaused(paused) {
    if (!state.running) {
      return;
    }
    state.paused = paused;
    els.pauseButton.setAttribute("aria-label", paused ? "계속하기" : "일시정지");
    showToast(paused ? "잠시 멈춤" : "영업 재개");
  }

  function performSlotAction(index) {
    if (!state.running || state.paused) {
      return;
    }

    if (index >= getCapacity()) {
      showToast("상점에서 붕어틀을 확장하세요");
      return;
    }

    const slot = state.slots[index];
    const action = slotActions[state.tool];
    if (action) {
      action(slot);
    }
  }

  const slotActions = {
    batter(slot) {
      if (slot.stage !== "empty") {
        showToast("빈 틀을 골라주세요");
        return;
      }
      slot.stage = "batter";
      slot.recipeId = null;
      slot.progress = 0;
      slot.readyAge = 0;
      slot.perfectFront = false;
      renderGrill();
    },
    filling(slot) {
      if (slot.stage !== "batter") {
        showToast("반죽 위에 속을 올릴 수 있습니다");
        return;
      }
      slot.stage = "front";
      slot.recipeId = state.selectedRecipeId;
      slot.progress = 0;
      slot.readyAge = 0;
      renderGrill();
    },
    flip(slot) {
      if (slot.stage !== "front") {
        showToast("앞면을 굽는 붕어빵을 뒤집으세요");
        return;
      }
      if (slot.progress < 72) {
        showToast("조금 더 익혀주세요");
        return;
      }
      if (slot.progress > 116) {
        burnSlot(slot);
        showToast("타기 직전이었습니다");
        renderGrill();
        return;
      }
      slot.perfectFront = slot.progress >= 88 && slot.progress <= 102;
      slot.stage = "back";
      slot.progress = 0;
      renderGrill();
    },
    serve(slot) {
      if (slot.stage === "burnt") {
        cleanBurnt(slot);
        return;
      }
      if (slot.stage !== "ready") {
        showToast("완성된 붕어빵만 서빙할 수 있습니다");
        return;
      }
      serveSlot(slot);
    }
  };

  function updateSlots(delta) {
    state.slots.forEach((slot, index) => {
      if (index >= getCapacity()) {
        return;
      }

      if (slot.stage === "front" || slot.stage === "back") {
        slot.progress += delta * getCookRate();
      }

      if (slot.stage === "front" && slot.progress >= 122) {
        burnSlot(slot);
      }

      if (slot.stage === "back" && slot.progress >= 100) {
        slot.stage = "ready";
        slot.progress = 100;
        slot.readyAge = 0;
      }

      if (slot.stage === "ready") {
        slot.readyAge += delta;
        if (slot.readyAge >= getReadyWindow()) {
          burnSlot(slot);
        }
      }
    });
  }

  function burnSlot(slot) {
    if (slot.stage !== "burnt") {
      state.stats.burned += 1;
      state.combo = 1;
    }
    slot.stage = "burnt";
    slot.progress = 100;
    slot.readyAge = 0;
  }

  function cleanBurnt(slot) {
    resetSlot(slot);
    showToast("탄 붕어빵을 치웠습니다");
    renderAll();
  }

  function resetSlot(slot) {
    slot.stage = "empty";
    slot.recipeId = null;
    slot.progress = 0;
    slot.readyAge = 0;
    slot.perfectFront = false;
  }

  function serveSlot(slot) {
    const recipe = getRecipe(slot.recipeId);
    const order = state.orders.find((item) => item.recipeId === recipe.id);
    const perfect = slot.perfectFront && slot.readyAge <= 3.2;
    let value = recipe.price * getServeBonus();
    let message = "진열 판매";

    if (order) {
      const patienceRatio = Math.max(0, order.patience / order.maxPatience);
      value *= 1 + patienceRatio * 0.38;
      order.remaining -= 1;
      message = `${order.name} 주문 완료`;
      if (order.remaining <= 0) {
        state.orders = state.orders.filter((item) => item.id !== order.id);
        state.stats.orders += 1;
        state.save.gems += order.rush ? 2 : 1;
      }
    } else {
      value *= 0.52;
    }

    if (perfect) {
      value *= 1.18;
      state.stats.perfect += 1;
      message = `${message} · 완벽`;
    }

    value *= state.combo;
    value = Math.round(value);
    state.save.coins += value;
    state.revenue += value;
    state.stats.pieces += 1;
    state.combo = Math.min(3, state.combo + 0.13);
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    resetSlot(slot);
    checkMissionRewards();
    showToast(`${message} +${money(value)}`);
    saveGame();
    renderAll();
  }

  function spawnOrder() {
    if (state.orders.length >= MAX_ORDERS) {
      return;
    }

    const available = unlockedRecipes();
    const recipe = available[Math.floor(Math.random() * available.length)];
    const rush = Math.random() < Math.min(0.34, 0.16 + state.save.day * 0.018);
    const quantity = Math.min(3, 1 + Math.floor(Math.random() * (state.save.day >= 3 ? 3 : 2)));
    const basePatience = rush ? 26 : 37;
    const maxPatience = Math.round((basePatience + Math.random() * 12) * getPatienceBonus());
    const look = customerLooks[Math.floor(Math.random() * customerLooks.length)];

    state.orders.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: customerNames[Math.floor(Math.random() * customerNames.length)],
      recipeId: recipe.id,
      quantity,
      remaining: quantity,
      maxPatience,
      patience: maxPatience,
      rush,
      look
    });
  }

  function updateOrders(delta) {
    for (let index = state.orders.length - 1; index >= 0; index -= 1) {
      const order = state.orders[index];
      order.patience -= delta;
      if (order.patience <= 0) {
        state.orders.splice(index, 1);
        state.stats.missed += 1;
        state.combo = 1;
        showToast(`${order.name} 손님이 떠났습니다`);
      }
    }
  }

  function getOrderDelay() {
    const speedUp = Math.min(2.8, state.save.day * 0.18 + getUpgradeLevel("charm") * 0.2);
    return Math.max(3.6, 6.8 - speedUp + Math.random() * 2.2);
  }

  function buildMissions() {
    const day = state.save.day;
    return [
      {
        id: `orders-${day}`,
        title: `주문 ${Math.min(12, 4 + day)}건`,
        meta: "완료 주문",
        reward: 110 + day * 18,
        get: () => state.stats.orders,
        target: Math.min(12, 4 + day)
      },
      {
        id: `pieces-${day}`,
        title: `붕어빵 ${Math.min(28, 9 + day * 2)}개`,
        meta: "서빙 수량",
        reward: 95 + day * 16,
        get: () => state.stats.pieces,
        target: Math.min(28, 9 + day * 2)
      },
      {
        id: `combo-${day}`,
        title: `콤보 x${Math.min(2.4, 1.4 + day * 0.12).toFixed(1)}`,
        meta: "최고 콤보",
        reward: 2,
        gem: true,
        get: () => state.maxCombo,
        target: Math.min(2.4, 1.4 + day * 0.12)
      }
    ];
  }

  function checkMissionRewards() {
    state.missions.forEach((mission) => {
      if (state.save.claimedMissions[mission.id]) {
        return;
      }
      if (mission.get() >= mission.target) {
        state.save.claimedMissions[mission.id] = true;
        if (mission.gem) {
          state.save.gems += mission.reward;
          showToast(`미션 보상 +${mission.reward}보석`);
        } else {
          state.save.coins += mission.reward;
          showToast(`미션 보상 +${money(mission.reward)}`);
        }
      }
    });
  }

  function buyUpgrade(upgradeId) {
    const upgrade = upgrades.find((item) => item.id === upgradeId);
    const level = getUpgradeLevel(upgradeId);
    if (!upgrade || level >= upgrade.max) {
      return;
    }

    const price = getUpgradePrice(upgrade, level);
    if (state.save.coins < price) {
      showToast("코인이 부족합니다");
      return;
    }

    state.save.coins -= price;
    state.save.upgrades[upgradeId] = level + 1;
    showToast(`${upgrade.name} Lv.${level + 1}`);
    saveGame();
    renderAll();
  }

  function getUpgradePrice(upgrade, level) {
    return Math.round(upgrade.base * Math.pow(1.72, level));
  }

  function buyRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (isUnlocked(recipe.id)) {
      selectRecipe(recipe.id);
      return;
    }
    if (state.save.coins < recipe.unlockCost) {
      showToast("코인이 부족합니다");
      return;
    }
    state.save.coins -= recipe.unlockCost;
    state.save.unlockedRecipes.push(recipe.id);
    state.selectedRecipeId = recipe.id;
    showToast(`${recipe.name} 레시피 해금`);
    saveGame();
    renderAll();
  }

  function startNewDay() {
    state.running = true;
    state.paused = false;
    state.timeLeft = DAY_SECONDS;
    state.revenue = 0;
    state.closedBonus = 0;
    state.tool = "batter";
    state.selectedRecipeId = isUnlocked(state.selectedRecipeId) ? state.selectedRecipeId : "redbean";
    state.orders = [];
    state.orderRenderKey = "__reset__";
    state.slots = createSlots();
    state.grillRenderKey = "__reset__";
    state.nextOrderIn = 0.4;
    state.combo = 1;
    state.maxCombo = 1;
    state.stats = createStats();
    state.missions = buildMissions();
    state.lastTick = performance.now();
    els.daySummary.classList.add("hidden");
    closeSheet("shopSheet");
    closeSheet("missionsSheet");
    renderAll();
  }

  function endDay() {
    if (!state.running) {
      return;
    }

    state.running = false;
    state.paused = false;
    state.closedDay = state.save.day;
    state.closedGoal = getGoal();

    const hitGoal = state.revenue >= state.closedGoal;
    state.closedBonus = hitGoal ? Math.round(120 + state.closedDay * 24) : 0;
    if (hitGoal) {
      state.save.coins += state.closedBonus;
      state.save.gems += 3;
    }

    state.save.bestRevenue = Math.max(state.save.bestRevenue, state.revenue);
    state.save.day += 1;
    saveGame();
    renderSummary(hitGoal);
  }

  function tick(now) {
    const delta = Math.min(0.12, (now - state.lastTick) / 1000);
    state.lastTick = now;

    if (state.running && !state.paused) {
      state.timeLeft = Math.max(0, state.timeLeft - delta);
      state.nextOrderIn -= delta;

      if (state.nextOrderIn <= 0) {
        spawnOrder();
        state.nextOrderIn = getOrderDelay();
      }

      updateOrders(delta);
      updateSlots(delta);
      checkMissionRewards();

      if (state.timeLeft <= 0) {
        endDay();
      }
    }

    if (now - state.lastRender > 130) {
      renderLive();
      state.lastRender = now;
    }

    requestAnimationFrame(tick);
  }

  function renderAll() {
    renderHud();
    renderTools();
    renderRecipes();
    renderOrders(false);
    renderGrill(false);
    renderShop();
    renderMissions();
  }

  function renderLive() {
    renderHud();
    renderOrders(false);
    renderGrill(false);
    renderMissions();
  }

  function renderHud() {
    const goal = getGoal();
    const progress = Math.min(100, (state.revenue / goal) * 100);
    els.dayText.textContent = `DAY ${state.save.day}`;
    els.coinsText.textContent = compactMoney(state.save.coins);
    els.gemsText.textContent = compactMoney(state.save.gems);
    els.timerText.textContent = formatTime(state.timeLeft);
    els.goalLabel.textContent = `목표 ${money(goal)}`;
    els.goalFill.style.width = `${progress}%`;
    els.revenueText.textContent = money(state.revenue);
    els.comboText.textContent = `x${state.combo.toFixed(1)}`;
    els.heatText.textContent = `열판 Lv.${getUpgradeLevel("heat")}`;
    els.selectedRecipeText.textContent = `${getRecipe(state.selectedRecipeId).name} 속`;
  }

  function renderTools() {
    els.toolButtons.forEach((button) => {
      const active = button.dataset.tool === state.tool;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderRecipes() {
    els.recipes.innerHTML = recipes
      .map((recipe) => {
        const unlocked = isUnlocked(recipe.id);
        const active = state.selectedRecipeId === recipe.id;
        return `
          <button class="recipe-button ${active ? "active" : ""} ${unlocked ? "" : "locked"}" type="button" data-recipe="${recipe.id}" aria-pressed="${active}" style="--recipe-color:${recipe.color}">
            <span class="recipe-dot" aria-hidden="true"></span>
            <span>${unlocked ? recipe.name : "잠김"}</span>
          </button>
        `;
      })
      .join("");

    els.recipes.querySelectorAll(".recipe-button").forEach((button) => {
      button.addEventListener("click", () => selectRecipe(button.dataset.recipe));
    });
  }

  function getOrdersRenderKey() {
    return state.orders
      .map((order) => `${order.id}:${order.recipeId}:${order.remaining}:${order.rush ? 1 : 0}`)
      .join("|");
  }

  function updateOrderPatienceBars() {
    state.orders.forEach((order) => {
      const bar = els.orders.querySelector(`[data-order-id="${order.id}"] .patience-bar span`);
      if (!bar) {
        return;
      }
      const patience = Math.max(0, (order.patience / order.maxPatience) * 100);
      bar.style.setProperty("--patience", `${patience}%`);
    });
  }

  function renderOrders(force = false) {
    const nextKey = getOrdersRenderKey();
    if (!force && state.orderRenderKey === nextKey) {
      updateOrderPatienceBars();
      return;
    }

    state.orderRenderKey = nextKey;

    if (state.orders.length === 0) {
      els.orders.innerHTML = `<div class="empty-queue">손님 대기중</div>`;
      return;
    }

    els.orders.innerHTML = state.orders
      .map((order) => {
        const recipe = getRecipe(order.recipeId);
        const patience = Math.max(0, (order.patience / order.maxPatience) * 100);
        return `
          <article class="customer-card" data-order-id="${order.id}" style="--recipe-color:${recipe.color}; --bubble:${order.rush ? "#ff647d" : recipe.color}">
            <div class="speech">
              <span class="mini-fish" aria-hidden="true"></span>
              <span>x${order.remaining}</span>
            </div>
            <div class="person" style="--skin:${order.look.skin}; --hair:${order.look.hair}; --coat:${order.look.coat}" aria-label="${order.name} ${recipe.name} 주문">
              <span class="person-hair" aria-hidden="true"></span>
              <span class="person-head" aria-hidden="true"></span>
              <span class="person-eye left" aria-hidden="true"></span>
              <span class="person-eye right" aria-hidden="true"></span>
              <span class="person-mouth" aria-hidden="true"></span>
            </div>
            <div class="patience-bar" aria-hidden="true"><span style="--patience:${patience}%"></span></div>
          </article>
        `;
      })
      .join("");
  }

  function getGrillRenderKey() {
    const capacity = getCapacity();
    return state.slots
      .map((slot, index) => {
        const locked = index >= capacity ? 1 : 0;
        return `${locked}:${slot.stage}:${slot.recipeId || ""}`;
      })
      .join("|");
  }

  function updateGrillProgress() {
    const capacity = getCapacity();
    state.slots.forEach((slot, index) => {
      const button = els.grill.querySelector(`[data-index="${index}"]`);
      if (!button) {
        return;
      }

      const label = button.querySelector(".slot-label");
      if (label) {
        label.textContent = getSlotLabel(slot, index >= capacity);
      }

      const progress = slot.stage === "ready" || slot.stage === "burnt" ? 100 : Math.min(100, slot.progress);
      const bar = button.querySelector(".slot-progress span");
      if (bar) {
        bar.style.setProperty("--progress", `${progress}%`);
      }
    });
  }

  function renderGrill(force = false) {
    const nextKey = getGrillRenderKey();
    if (!force && state.grillRenderKey === nextKey) {
      updateGrillProgress();
      return;
    }

    state.grillRenderKey = nextKey;
    const capacity = getCapacity();
    els.grill.innerHTML = state.slots
      .map((slot, index) => {
        const locked = index >= capacity;
        const recipe = slot.recipeId ? getRecipe(slot.recipeId) : null;
        const hasFish = slot.stage !== "empty" && !locked;
        const classes = ["mold-slot", slot.stage];
        if (locked) {
          classes.push("locked");
        }
        if (hasFish) {
          classes.push("has-fish");
        }
        const progress = slot.stage === "ready" || slot.stage === "burnt" ? 100 : Math.min(100, slot.progress);
        return `
          <button class="${classes.join(" ")}" type="button" data-index="${index}" aria-label="${getSlotLabel(slot, locked)}" style="--recipe-color:${recipe ? recipe.color : "#8b3f39"}">
            <span class="slot-label">${getSlotLabel(slot, locked)}</span>
            <span class="fish" aria-hidden="true">
              <svg class="fish-svg" viewBox="0 0 180 112" focusable="false">
                <path class="fish-shadow" d="M19 62c13-32 54-48 92-39 24 6 42 19 51 39-11 24-39 39-73 38-36-1-60-15-70-38Z" />
                <path class="fish-tail-svg" d="M124 56c15-21 34-32 50-29-8 16-8 42 0 58-16 3-35-8-50-29Z" />
                <path class="fish-body-svg" d="M13 56c10-30 48-47 86-40 28 5 47 20 57 40-11 23-37 39-70 40-35 1-63-14-73-40Z" />
                <path class="fish-belly" d="M34 71c22 14 61 17 91 3-14 15-35 23-59 21-15-1-25-8-32-24Z" />
                <path class="fish-fin" d="M83 68c14 2 25 8 31 18-17 1-31-5-40-15 2-3 5-4 9-3Z" />
                <path class="fish-mouth-svg" d="M28 54c8-4 16-4 23 0" />
                <path class="fish-gill-svg" d="M64 35c9 12 9 31-1 42" />
                <path class="fish-ridge-svg" d="M74 26c-6 13-6 47 1 63" />
                <path class="fish-ridge-svg" d="M96 25c-5 14-4 47 3 61" />
                <path class="scale scale-one" d="M86 48c9-8 22-8 31 0-9 9-22 9-31 0Z" />
                <path class="scale scale-two" d="M83 62c9-7 21-7 30 0-9 8-21 8-30 0Z" />
                <path class="scale scale-three" d="M107 55c8-7 19-7 27 0-8 8-19 8-27 0Z" />
                <circle class="fish-eye-svg" cx="49" cy="46" r="5" />
                <circle class="fish-eye-shine" cx="47" cy="44" r="1.8" />
              </svg>
            </span>
            ${recipe ? `<span class="filling-badge">${recipe.short}</span>` : ""}
            <span class="slot-progress" aria-hidden="true"><span style="--progress:${progress}%"></span></span>
            <span class="lock-mark" aria-hidden="true">＋</span>
          </button>
        `;
      })
      .join("");

    els.grill.querySelectorAll(".mold-slot").forEach((button) => {
      button.addEventListener("click", () => performSlotAction(Number(button.dataset.index)));
    });
  }

  function getSlotLabel(slot, locked) {
    if (locked) {
      return "확장";
    }
    const labels = {
      empty: "빈틀",
      batter: "반죽",
      front: "앞면",
      back: "뒷면",
      ready: "완성",
      burnt: "탐"
    };
    return labels[slot.stage] || "빈틀";
  }

  function renderShop() {
    els.upgradeList.innerHTML = upgrades
      .map((upgrade) => {
        const level = getUpgradeLevel(upgrade.id);
        const maxed = level >= upgrade.max;
        const price = maxed ? 0 : getUpgradePrice(upgrade, level);
        const disabled = maxed || state.save.coins < price;
        return `
          <button class="shop-item" type="button" data-upgrade="${upgrade.id}" ${disabled ? "disabled" : ""}>
            <span class="shop-icon" aria-hidden="true">${upgrade.icon}</span>
            <span>
              <span class="shop-title">${upgrade.name} Lv.${level}</span>
              <span class="shop-meta">${maxed ? "최대 레벨" : upgrade.meta}</span>
            </span>
            <span class="shop-price">${maxed ? "MAX" : compactMoney(price)}</span>
          </button>
        `;
      })
      .join("");

    els.recipeShop.innerHTML = recipes
      .map((recipe) => {
        const unlocked = isUnlocked(recipe.id);
        const disabled = unlocked || state.save.coins < recipe.unlockCost;
        return `
          <button class="shop-item" type="button" data-recipe-unlock="${recipe.id}" ${disabled ? "disabled" : ""}>
            <span class="shop-icon" aria-hidden="true" style="background:linear-gradient(135deg, ${recipe.color}, #ff9a34)">魚</span>
            <span>
              <span class="shop-title">${recipe.name} 레시피</span>
              <span class="shop-meta">${unlocked ? "해금 완료" : `판매가 ${money(recipe.price)}`}</span>
            </span>
            <span class="shop-price">${unlocked ? "OK" : compactMoney(recipe.unlockCost)}</span>
          </button>
        `;
      })
      .join("");

    els.upgradeList.querySelectorAll("[data-upgrade]").forEach((button) => {
      button.addEventListener("click", () => buyUpgrade(button.dataset.upgrade));
    });
    els.recipeShop.querySelectorAll("[data-recipe-unlock]").forEach((button) => {
      button.addEventListener("click", () => buyRecipe(button.dataset.recipeUnlock));
    });
  }

  function renderMissions() {
    els.missionList.innerHTML = state.missions
      .map((mission) => {
        const value = mission.get();
        const progress = Math.min(100, (value / mission.target) * 100);
        const complete = state.save.claimedMissions[mission.id];
        const reward = mission.gem ? `${mission.reward}보석` : money(mission.reward);
        return `
          <article class="mission-item">
            <span>
              <span class="mission-title">${mission.title}</span>
              <span class="mission-meta">${mission.meta} · ${formatMissionValue(value)} / ${formatMissionValue(mission.target)}</span>
            </span>
            <span class="mission-reward">${complete ? "완료" : reward}</span>
            <span class="mission-progress" aria-hidden="true"><span style="--progress:${progress}%"></span></span>
          </article>
        `;
      })
      .join("");
  }

  function formatMissionValue(value) {
    if (value < 3 && !Number.isInteger(value)) {
      return value.toFixed(1);
    }
    return String(Math.floor(value));
  }

  function renderSummary(hitGoal) {
    const bonusText = hitGoal ? `${money(state.closedBonus)} + 3보석` : "없음";
    els.summaryStats.innerHTML = `
      <div><span>DAY</span><strong>${state.closedDay}</strong></div>
      <div><span>목표</span><strong>${hitGoal ? "달성" : "미달"}</strong></div>
      <div><span>매출</span><strong>${money(state.revenue)}</strong></div>
      <div><span>보너스</span><strong>${bonusText}</strong></div>
      <div><span>주문</span><strong>${state.stats.orders}건</strong></div>
      <div><span>최고 콤보</span><strong>x${state.maxCombo.toFixed(1)}</strong></div>
    `;
    els.daySummary.classList.remove("hidden");
    renderHud();
  }

  function openSheet(id) {
    const sheet = document.querySelector(`#${id}`);
    if (sheet) {
      sheet.classList.remove("hidden");
    }
  }

  function closeSheet(id) {
    const sheet = document.querySelector(`#${id}`);
    if (sheet) {
      sheet.classList.add("hidden");
    }
  }

  let toastTimer = 0;
  function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, 1450);
  }

  function bindEvents() {
    els.toolButtons.forEach((button) => {
      button.addEventListener("click", () => selectTool(button.dataset.tool));
    });
    els.shopButton.addEventListener("click", () => openSheet("shopSheet"));
    els.missionsButton.addEventListener("click", () => openSheet("missionsSheet"));
    els.newDayButton.addEventListener("click", startNewDay);
    els.pauseButton.addEventListener("click", () => setPaused(!state.paused));
    els.summaryButton.addEventListener("click", startNewDay);
    els.closeButtons.forEach((button) => {
      button.addEventListener("click", () => closeSheet(button.dataset.close));
    });
  }

  bindEvents();
  startNewDay();
  requestAnimationFrame(tick);
})();
