(() => {
  "use strict";

  const SAVE_KEY = "bungeoppang-snow-market-v5";
  const DAY_SECONDS = 60;
  const SLOT_COUNT = 12;
  const MAX_ORDERS = 3;
  const BATTER_COST = 6;
  const BATTER_SET_PROGRESS = 14;
  const BATTER_BURN_PROGRESS = 76;
  const FRONT_FLIP_PROGRESS = 72;
  const FRONT_GOLDEN_MIN = 88;
  const FRONT_GOLDEN_MAX = 104;
  const FRONT_BURN_PROGRESS = 122;
  const READY_PERFECT_SECONDS = 3.2;
  const won = new Intl.NumberFormat("ko-KR");

  const recipes = [
    { id: "redbean", name: "팥", short: "팥", color: "#8b3f39", price: 65, cost: 14, unlockCost: 0 },
    { id: "custard", name: "슈크림", short: "슈", color: "#e0a33a", price: 72, cost: 17, unlockCost: 0 },
    { id: "cheese", name: "치즈", short: "치", color: "#f1bd35", price: 82, cost: 22, unlockCost: 240 },
    { id: "sweetpotato", name: "고구마", short: "고", color: "#a864d6", price: 92, cost: 26, unlockCost: 330 },
    { id: "matcha", name: "말차", short: "말", color: "#4b9c63", price: 104, cost: 30, unlockCost: 430 }
  ];

  const customerTypes = {
    normal: {
      label: "",
      patience: 1,
      pay: 1,
      tip: 1,
      drain: 0
    },
    rush: {
      label: "급함",
      patience: 0.72,
      pay: 1.08,
      tip: 1.18,
      drain: 0
    },
    vip: {
      label: "귀빈",
      patience: 0.86,
      pay: 1.62,
      tip: 1.45,
      drain: 0
    },
    trouble: {
      label: "진상",
      patience: 0.58,
      pay: 0.72,
      tip: 0.45,
      drain: 0.28
    }
  };

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
      meta: "속도 증가, 타이밍 난도 상승",
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
  const defaultSave = {
    coins: 0,
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
    introScreen: document.querySelector("#introScreen"),
    startGameButton: document.querySelector("#startGameButton"),
    introDayText: document.querySelector("#introDayText"),
    introBestText: document.querySelector("#introBestText"),
    dayText: document.querySelector("#dayText"),
    coinsText: document.querySelector("#coinsText"),
    timerText: document.querySelector("#timerText"),
    goalLabel: document.querySelector("#goalLabel"),
    goalFill: document.querySelector("#goalFill"),
    revenueText: document.querySelector("#revenueText"),
    orders: document.querySelector("#orders"),
    comboText: document.querySelector("#comboText"),
    displayCase: document.querySelector("#displayCase"),
    grill: document.querySelector("#grill"),
    recipes: document.querySelector("#recipes"),
    missionsButton: document.querySelector("#missionsButton"),
    musicButton: document.querySelector("#musicButton"),
    pauseButton: document.querySelector("#pauseButton"),
    missionsSheet: document.querySelector("#missionsSheet"),
    upgradeList: document.querySelector("#upgradeList"),
    recipeShop: document.querySelector("#recipeShop"),
    shopCoinsText: document.querySelector("#shopCoinsText"),
    missionList: document.querySelector("#missionList"),
    daySummary: document.querySelector("#daySummary"),
    summaryResultsView: document.querySelector("#summaryResultsView"),
    summaryShopView: document.querySelector("#summaryShopView"),
    summaryStats: document.querySelector("#summaryStats"),
    summaryBackButton: document.querySelector("#summaryBackButton"),
    summaryShopButton: document.querySelector("#summaryShopButton"),
    summaryButton: document.querySelector("#summaryButton"),
    closeButtons: Array.from(document.querySelectorAll(".close-sheet")),
    toast: document.querySelector("#toast")
  };

  const state = {
    save: loadSave(),
    running: false,
    paused: false,
    timeLeft: DAY_SECONDS,
    revenue: 0,
    closedDay: 1,
    closedGoal: 0,
    closedBonus: 0,
    closedReason: "time",
    selectedRecipeId: "redbean",
    orders: [],
    orderRenderKey: "__init__",
    displayStock: [],
    nextDisplayId: 1,
    slots: createSlots(),
    grillRenderKey: "__init__",
    nextOrderIn: 0.4,
    combo: 1,
    maxCombo: 1,
    lastTick: performance.now(),
    lastRender: 0,
    lastCustomerSprite: -1,
    stats: createStats(),
    missions: [],
    musicEnabled: true,
    music: {
      context: null,
      gain: null,
      timer: 0,
      step: 0
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clampNumber(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return min;
    }
    return Math.max(min, Math.min(max, numeric));
  }

  function loadSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!parsed || typeof parsed !== "object") {
        return clone(defaultSave);
      }

      const safeParsed = { ...parsed };
      delete safeParsed.gems;
      delete safeParsed.reputation;

      return {
        ...clone(defaultSave),
        ...safeParsed,
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
      perfect: 0,
      cost: 0,
      waste: 0
    };
  }

  function createSlots() {
    return Array.from({ length: SLOT_COUNT }, (_, index) => ({
      index,
      stage: "empty",
      recipeId: null,
      progress: 0,
      readyAge: 0,
      perfectFront: false,
      cost: 0
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

  function getBatterRate() {
    return getCookRate() * 0.82;
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
    return 430 + (state.save.day - 1) * 95;
  }

  function money(value) {
    return `${won.format(Math.max(0, Math.round(value)))}원`;
  }

  function compactMoney(value) {
    return won.format(Math.max(0, Math.round(value)));
  }

  function spendMaterial(slot, amount) {
    state.stats.cost += amount;
    slot.cost += amount;
    return true;
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
      showToast("영업 종료 후 상점에서 해금할 수 있습니다");
      return;
    }
    state.selectedRecipeId = recipeId;
    renderAll();
  }

  function ensureMusic() {
    if (state.music.context || (!window.AudioContext && !window.webkitAudioContext)) {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.music.context = new AudioContextClass();
    state.music.gain = state.music.context.createGain();
    state.music.gain.gain.value = 0.05;
    state.music.gain.connect(state.music.context.destination);
  }

  function playTone(frequency, duration, type = "sine", volume = 0.14) {
    const { context, gain } = state.music;
    if (!context || !gain || context.state !== "running") {
      return;
    }

    const oscillator = context.createOscillator();
    const noteGain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(volume, now + 0.018);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(noteGain);
    noteGain.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function playMusicStep() {
    if (!state.musicEnabled || state.paused) {
      return;
    }

    const melody = [659, 784, 880, 784, 659, 587, 659, 523];
    const bass = [196, 196, 220, 220, 174, 174, 196, 196];
    const step = state.music.step % melody.length;
    playTone(melody[step], 0.18, "triangle", step % 2 ? 0.1 : 0.13);
    if (step % 2 === 0) {
      playTone(bass[step], 0.24, "sine", 0.07);
    }
    state.music.step += 1;
  }

  function startMusic() {
    if (!state.musicEnabled) {
      return;
    }
    ensureMusic();
    if (!state.music.context) {
      return;
    }
    state.music.context.resume();
    if (!state.music.timer) {
      playMusicStep();
      state.music.timer = window.setInterval(playMusicStep, 260);
    }
    updateMusicButton();
  }

  function stopMusic() {
    if (state.music.timer) {
      window.clearInterval(state.music.timer);
      state.music.timer = 0;
    }
    if (state.music.context && state.music.context.state === "running") {
      state.music.context.suspend();
    }
    updateMusicButton();
  }

  function toggleMusic() {
    state.musicEnabled = !state.musicEnabled;
    if (state.musicEnabled) {
      startMusic();
      showToast("BGM 켜짐");
    } else {
      stopMusic();
      showToast("BGM 꺼짐");
    }
  }

  function updateMusicButton() {
    els.musicButton.classList.toggle("is-muted", !state.musicEnabled);
    els.musicButton.setAttribute("aria-label", state.musicEnabled ? "배경음악 끄기" : "배경음악 켜기");
  }

  function setPaused(paused) {
    if (!state.running) {
      return;
    }
    state.paused = paused;
    els.pauseButton.setAttribute("aria-label", paused ? "계속하기" : "일시정지");
    if (paused) {
      stopMusic();
    } else {
      startMusic();
    }
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
    if (slot.stage === "empty") {
      pourBatter(slot);
      return;
    }
    if (slot.stage === "batter") {
      addFilling(slot);
      return;
    }
    if (slot.stage === "front") {
      flipSlot(slot);
      return;
    }
    if (slot.stage === "back") {
      showToast("뒷면이 익는 중입니다");
      return;
    }
    if (slot.stage === "ready") {
      collectSlot(slot);
      return;
    }
    if (slot.stage === "burnt") {
      cleanBurnt(slot);
    }
  }

  function pourBatter(slot) {
    spendMaterial(slot, BATTER_COST);
    slot.stage = "batter";
    slot.recipeId = null;
    slot.progress = 0;
    slot.readyAge = 0;
    slot.perfectFront = false;
    renderAll();
  }

  function addFilling(slot) {
    if (slot.progress < BATTER_SET_PROGRESS) {
      showToast("반죽이 아직 자리 잡는 중입니다");
      return;
    }
    if (slot.progress >= BATTER_BURN_PROGRESS) {
      burnSlot(slot);
      showToast("반죽만 익어버렸습니다");
      renderAll();
      return;
    }

    const recipe = getRecipe(state.selectedRecipeId);
    spendMaterial(slot, recipe.cost);
    slot.stage = "front";
    slot.recipeId = state.selectedRecipeId;
    slot.progress = 0;
    slot.readyAge = 0;
    slot.perfectFront = false;
    renderAll();
  }

  function flipSlot(slot) {
    if (slot.progress < FRONT_FLIP_PROGRESS) {
      showToast("조금 더 익혀주세요");
      return;
    }
    if (slot.progress > FRONT_BURN_PROGRESS - 6) {
      burnSlot(slot);
      showToast("타기 직전이었습니다");
      renderAll();
      return;
    }
    slot.perfectFront = slot.progress >= FRONT_GOLDEN_MIN && slot.progress <= FRONT_GOLDEN_MAX;
    slot.stage = "back";
    slot.progress = 0;
    renderGrill();
  }

  function updateSlots(delta) {
    state.slots.forEach((slot, index) => {
      if (index >= getCapacity()) {
        return;
      }

      if (slot.stage === "batter") {
        slot.progress += delta * getBatterRate();
      }

      if (slot.stage === "front" || slot.stage === "back") {
        slot.progress += delta * getCookRate();
      }

      if (slot.stage === "batter" && slot.progress >= BATTER_BURN_PROGRESS) {
        burnSlot(slot);
      }

      if (slot.stage === "front" && slot.progress >= FRONT_BURN_PROGRESS) {
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
      state.stats.waste += slot.cost;
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
    slot.cost = 0;
  }

  function getOrderTotalRemaining(order) {
    return order.items.reduce((total, item) => total + item.remaining, 0);
  }

  function findMatchingOrder(recipeId) {
    return state.orders.find((order) =>
      order.items.some((item) => item.recipeId === recipeId && item.remaining > 0)
    );
  }

  function getCustomerType(id) {
    return customerTypes[id] || customerTypes.normal;
  }

  function chooseCustomerType() {
    const day = state.save.day;
    const roll = Math.random();
    const troubleChance = day >= 4 ? Math.min(0.16, 0.04 + day * 0.01) : 0;
    const vipChance = day >= 3 ? Math.min(0.18, 0.05 + day * 0.012) : 0;
    const rushChance = Math.min(0.34, 0.15 + day * 0.018);

    if (roll < troubleChance) {
      return "trouble";
    }
    if (roll < troubleChance + vipChance) {
      return "vip";
    }
    if (roll < troubleChance + vipChance + rushChance) {
      return "rush";
    }
    return "normal";
  }

  function buildOrderItems(available, customerTypeId = "normal") {
    const day = state.save.day;
    const typeBonus = customerTypeId === "vip" && day >= 4 ? 1 : 0;
    const maxQuantity = Math.min(4, (day < 3 ? 1 : day < 5 ? 2 : 3) + typeBonus);
    const totalQuantity = maxQuantity === 1 ? 1 : 1 + Math.floor(Math.random() * maxQuantity);
    const canMix = day >= 4 && totalQuantity >= 2 && available.length >= 2;
    const shouldMix = canMix && Math.random() < Math.min(0.72, 0.28 + day * 0.06);
    const counts = new Map();

    if (shouldMix) {
      for (let index = 0; index < totalQuantity; index += 1) {
        const recipe = available[Math.floor(Math.random() * available.length)];
        counts.set(recipe.id, (counts.get(recipe.id) || 0) + 1);
      }
      if (counts.size === 1 && available.length > 1) {
        const firstId = Array.from(counts.keys())[0];
        const other = available.find((recipe) => recipe.id !== firstId);
        counts.set(firstId, counts.get(firstId) - 1);
        counts.set(other.id, 1);
      }
    } else {
      const recipe = available[Math.floor(Math.random() * available.length)];
      counts.set(recipe.id, totalQuantity);
    }

    return Array.from(counts.entries())
      .filter(([, quantity]) => quantity > 0)
      .map(([recipeId, quantity]) => ({ recipeId, quantity, remaining: quantity }));
  }

  function getOrderLine(order, useRemaining = true) {
    return order.items
      .filter((item) => (useRemaining ? item.remaining : item.quantity) > 0)
      .map((item) => `${getRecipe(item.recipeId).name}붕 ${useRemaining ? item.remaining : item.quantity}개`)
      .join(", ");
  }

  function getOrderSpeech(order) {
    const line = `${getOrderLine(order, true)} 주세요!`;
    if (order.type === "vip") {
      return `${line} 잘 부탁해요`;
    }
    if (order.type === "trouble") {
      return `${line} 빨리요`;
    }
    return line;
  }

  function findDisplayStockIndex(recipeId) {
    return state.displayStock.findIndex((item) => item.recipeId === recipeId);
  }

  function collectSlot(slot) {
    const recipe = getRecipe(slot.recipeId);
    state.displayStock.push({
      id: state.nextDisplayId,
      recipeId: recipe.id,
      perfect: slot.perfectFront && slot.readyAge <= READY_PERFECT_SECONDS,
      cost: slot.cost
    });
    state.nextDisplayId += 1;
    resetSlot(slot);
    showToast(`${recipe.name}붕 진열 완료`);
    renderAll();
  }

  function serveOrderFromDisplay(orderId) {
    if (!state.running || state.paused) {
      return;
    }

    const order = state.orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }

    const canServeAll = order.items.every((item) => {
      const stockCount = state.displayStock.filter((stockItem) => stockItem.recipeId === item.recipeId).length;
      return stockCount >= item.remaining;
    });

    if (!canServeAll) {
      showToast("진열대에 주문한 붕어빵이 없습니다");
      return;
    }

    let servedCount = 0;
    let totalValue = 0;
    let comboHit = false;
    let completed = false;
    const servedName = order.name;

    order.items.forEach((item) => {
      while (item.remaining > 0) {
        const result = serveOneDisplayItem(item.recipeId, order);
        if (!result) {
          return;
        }
        servedCount += 1;
        totalValue += result.value;
        comboHit = comboHit || result.comboHit;
        completed = result.completed;
      }
    });

    if (servedCount <= 0) {
      return;
    }

    state.maxCombo = Math.max(state.maxCombo, state.combo);
    checkMissionRewards();
    saveGame();
    renderAll();
    showToast(`${servedName} ${servedCount}개 전달${completed ? " · 주문 완료" : ""}${comboHit ? " · 콤보" : ""} +${money(totalValue)}`);
  }

  function serveDisplayItem(recipeId, orderId = null) {
    if (!state.running || state.paused) {
      return;
    }

    const stockIndex = findDisplayStockIndex(recipeId);
    if (stockIndex < 0) {
      return;
    }

    const stockItem = state.displayStock[stockIndex];
    const recipe = getRecipe(stockItem.recipeId);
    const order = orderId
      ? state.orders.find((item) => item.id === orderId && item.items.some((orderItem) => orderItem.recipeId === recipe.id && orderItem.remaining > 0))
      : findMatchingOrder(recipe.id);
    if (!order) {
      showToast(`${recipe.name}붕을 찾는 손님이 없습니다`);
      return;
    }

    const result = serveOneDisplayItem(recipe.id, order);
    if (!result) {
      return;
    }

    state.maxCombo = Math.max(state.maxCombo, state.combo);
    checkMissionRewards();
    saveGame();
    renderAll();
    showToast(`${result.message} +${money(result.value)}`);
  }

  function serveOneDisplayItem(recipeId, order) {
    const stockIndex = findDisplayStockIndex(recipeId);
    if (stockIndex < 0 || !order) {
      return null;
    }

    const stockItem = state.displayStock[stockIndex];
    const recipe = getRecipe(stockItem.recipeId);
    const target = order.items.find((item) => item.recipeId === recipe.id && item.remaining > 0);
    if (!target) {
      return null;
    }

    state.displayStock.splice(stockIndex, 1);
    const perfect = stockItem.perfect;
    const materialCost = stockItem.cost;
    let value = recipe.price * getServeBonus();
    let message = `${recipe.name} 전달`;
    let patienceRatio = 0;
    let comboQualified = false;

    const profile = getCustomerType(order.type);
    patienceRatio = Math.max(0, order.patience / order.maxPatience);
    value *= profile.pay;
    value *= 1 + patienceRatio * 0.38 * profile.tip;
    target.remaining -= 1;
    message = `${order.name} ${recipe.name} 전달`;
    let completed = false;
    if (getOrderTotalRemaining(order) <= 0) {
      state.orders = state.orders.filter((item) => item.id !== order.id);
      state.stats.orders += 1;
      message = `${order.name} 주문 완료`;
      completed = true;
    }

    if (perfect) {
      value *= 1.18;
      state.stats.perfect += 1;
      message = `${message} · 완벽`;
    }

    comboQualified = Boolean(order && perfect && patienceRatio >= 0.55 && order.type !== "trouble");
    if (comboQualified) {
      value *= state.combo;
      state.combo = Math.min(5, state.combo * 1.08 + 0.16);
      message = `${message} · 콤보`;
    } else {
      state.combo = 1;
    }

    value = Math.round(value);
    state.save.coins += Math.max(0, value - materialCost);
    state.revenue += value;
    state.stats.pieces += 1;
    return {
      value,
      message,
      comboHit: comboQualified,
      completed
    };
  }

  function spawnOrder() {
    if (state.orders.length >= MAX_ORDERS) {
      return;
    }

    const available = unlockedRecipes();
    const type = chooseCustomerType();
    const profile = getCustomerType(type);
    const items = buildOrderItems(available, type);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const basePatience = type === "rush" ? 27 : type === "trouble" ? 30 : 38;
    const maxPatience = Math.round(
      (basePatience + Math.random() * 12 + totalQuantity * 4) * profile.patience * getPatienceBonus()
    );
    let spriteIndex = Math.floor(Math.random() * 9);
    if (spriteIndex === state.lastCustomerSprite) {
      spriteIndex = (spriteIndex + 1 + Math.floor(Math.random() * 8)) % 9;
    }
    state.lastCustomerSprite = spriteIndex;

    state.orders.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: customerNames[Math.floor(Math.random() * customerNames.length)],
      items,
      maxPatience,
      patience: maxPatience,
      type,
      rush: type === "rush",
      spriteIndex
    });
  }

  function updateOrders(delta) {
    const troubleDrain = state.orders.reduce((total, order) => total + getCustomerType(order.type).drain, 0);
    for (let index = state.orders.length - 1; index >= 0; index -= 1) {
      const order = state.orders[index];
      const drain = delta + (order.type === "trouble" ? 0 : delta * troubleDrain);
      order.patience -= drain;
      if (order.patience <= 0) {
        state.orders.splice(index, 1);
        state.stats.missed += 1;
        state.combo = 1;
        showToast(`${order.name} 손님이 떠났습니다`);
      }
    }
  }

  function getOrderDelay() {
    const speedUp = Math.min(3.4, state.save.day * 0.22 + getUpgradeLevel("charm") * 0.12);
    return Math.max(2.9, 7.2 - speedUp + Math.random() * 2);
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
        reward: 140 + day * 20,
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
        state.save.coins += mission.reward;
        showToast(`미션 보상 +${money(mission.reward)}`);
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
    state.closedReason = "time";
    state.selectedRecipeId = isUnlocked(state.selectedRecipeId) ? state.selectedRecipeId : "redbean";
    state.orders = [];
    state.orderRenderKey = "__reset__";
    state.displayStock = [];
    state.nextDisplayId = 1;
    state.slots = createSlots();
    state.grillRenderKey = "__reset__";
    state.nextOrderIn = 0.4;
    state.combo = 1;
    state.maxCombo = 1;
    state.stats = createStats();
    state.missions = buildMissions();
    state.lastTick = performance.now();
    els.introScreen.classList.add("hidden");
    els.daySummary.classList.add("hidden");
    closeSheet("missionsSheet");
    renderAll();
  }

  function renderIntro() {
    els.introDayText.textContent = `DAY ${state.save.day}`;
    els.introBestText.textContent = `최고 ${money(state.save.bestRevenue)}`;
  }

  function startGame() {
    renderIntro();
    startNewDay();
    startMusic();
  }

  function endDay(reason = "time") {
    if (!state.running) {
      return;
    }

    state.running = false;
    state.paused = false;
    state.closedDay = state.save.day;
    state.closedGoal = getGoal();
    state.closedReason = reason;

    const hitGoal = state.revenue >= state.closedGoal;
    state.closedBonus = hitGoal ? Math.round(120 + state.closedDay * 24) : 0;
    if (hitGoal) {
      state.save.coins += state.closedBonus;
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
        endDay("time");
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
    renderRecipes();
    renderOrders(false);
    renderDisplayCase();
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
    els.coinsText.textContent = money(state.revenue);
    els.timerText.textContent = formatTime(state.timeLeft);
    els.goalLabel.textContent = `목표 ${money(goal)}`;
    els.goalFill.style.width = `${progress}%`;
    els.revenueText.textContent = money(state.revenue);
    els.comboText.textContent = `x${state.combo.toFixed(1)}`;
  }

  function renderRecipes() {
    els.recipes.innerHTML = recipes
      .map((recipe) => {
        const unlocked = isUnlocked(recipe.id);
        const active = state.selectedRecipeId === recipe.id;
        return `
          <button class="recipe-button recipe-${recipe.id} ${active ? "active" : ""} ${unlocked ? "" : "locked"}" type="button" data-recipe="${recipe.id}" aria-pressed="${active}" style="--recipe-color:${recipe.color}">
            <span class="recipe-dot" aria-hidden="true">
              <span class="filling-mark filling-${recipe.id}"></span>
            </span>
            <span class="recipe-name">${unlocked ? `${recipe.name}붕` : "잠김"}</span>
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
      .map((order) => {
        const itemsKey = order.items
          .map((item) => `${item.recipeId}:${item.remaining}`)
          .join(",");
        return `${order.id}:${itemsKey}:${order.type}:${order.rush ? 1 : 0}`;
      })
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

  function getSlotProgressPercent(slot) {
    if (slot.stage === "ready" || slot.stage === "burnt") {
      return 100;
    }
    if (slot.stage === "batter") {
      return Math.min(100, (slot.progress / BATTER_BURN_PROGRESS) * 100);
    }
    return Math.min(100, slot.progress);
  }

  function getSlotBand(slot) {
    if (slot.stage === "empty") {
      return "empty";
    }
    if (slot.stage === "batter") {
      return slot.progress >= BATTER_SET_PROGRESS ? "fill-ready" : "batter";
    }
    if (slot.stage === "front") {
      if (slot.progress < FRONT_FLIP_PROGRESS) {
        return "undercooked";
      }
      if (slot.progress <= FRONT_GOLDEN_MAX) {
        return "golden";
      }
      return "over";
    }
    if (slot.stage === "back") {
      return slot.progress >= 88 ? "golden" : "undercooked";
    }
    return slot.stage;
  }

  function updateSlotBandClass(button, slot) {
    Array.from(button.classList)
      .filter((className) => className.startsWith("band-"))
      .forEach((className) => button.classList.remove(className));
    button.classList.add(`band-${getSlotBand(slot)}`);
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
        const primaryRecipe = getRecipe(order.items[0].recipeId);
        const profile = getCustomerType(order.type);
        const patience = Math.max(0, (order.patience / order.maxPatience) * 100);
        const itemChips = order.items
          .filter((item) => item.remaining > 0)
          .map((item) => {
            const recipe = getRecipe(item.recipeId);
            return `
              <span class="order-chip recipe-${recipe.id}" style="--recipe-color:${recipe.color}" title="${recipe.name}붕 ${item.remaining}개">
                <span class="mini-fish" aria-hidden="true">
                  <span class="filling-mark filling-${recipe.id}"></span>
                </span>
                <span class="count-badge">x${item.remaining}</span>
              </span>
            `;
          })
          .join("");
        return `
          <article class="customer-card customer-${order.type}" data-order-id="${order.id}" style="--recipe-color:${primaryRecipe.color}; --bubble:${order.type === "rush" ? "#ff647d" : primaryRecipe.color}">
            <div class="speech">
              ${profile.label ? `<span class="customer-tag">${profile.label}</span>` : ""}
              <span class="speech-text">${getOrderSpeech(order)}</span>
              <span class="order-chips" aria-hidden="true">${itemChips}</span>
            </div>
            <div class="person sprite-${order.spriteIndex}" aria-label="${order.name} ${getOrderLine(order, true)} 주문"></div>
            <div class="patience-bar" aria-hidden="true"><span style="--patience:${patience}%"></span></div>
          </article>
        `;
      })
      .join("");

    els.orders.querySelectorAll(".customer-card").forEach((card) => {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.addEventListener("click", () => serveOrderFromDisplay(card.dataset.orderId));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          serveOrderFromDisplay(card.dataset.orderId);
        }
      });
    });
  }

  function renderDisplayCase() {
    if (state.displayStock.length === 0) {
      els.displayCase.innerHTML = `<span class="display-empty">진열대 비어있음</span>`;
      return;
    }

    const grouped = recipes
      .map((recipe) => {
        const stock = state.displayStock.filter((item) => item.recipeId === recipe.id);
        return {
          recipe,
          count: stock.length,
          perfect: stock.some((item) => item.perfect)
        };
      })
      .filter((item) => item.count > 0);

    els.displayCase.innerHTML = grouped
      .map(({ recipe, count, perfect }) => {
        return `
          <button class="display-item recipe-${recipe.id} ${perfect ? "perfect" : ""}" type="button" data-recipe="${recipe.id}" style="--recipe-color:${recipe.color}" aria-label="${recipe.name}붕 ${count}개">
            <span class="display-fish" aria-hidden="true">
              <span class="display-fish-sprite"></span>
              <span class="filling-mark filling-${recipe.id}"></span>
            </span>
            <span class="display-count">x${count}</span>
          </button>
        `;
      })
      .join("");
    els.displayCase.querySelectorAll(".display-item").forEach((button) => {
      button.addEventListener("click", () => serveDisplayItem(button.dataset.recipe));
    });
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

      updateSlotBandClass(button, slot);

      const progress = getSlotProgressPercent(slot);
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
        if (recipe) {
          classes.push(`recipe-${recipe.id}`);
        }
        classes.push(`band-${getSlotBand(slot)}`);
        const progress = getSlotProgressPercent(slot);
        return `
          <button class="${classes.join(" ")}" type="button" data-index="${index}" aria-label="${getSlotLabel(slot, locked)}" style="--recipe-color:${recipe ? recipe.color : "#8b3f39"}">
            <span class="slot-label">${getSlotLabel(slot, locked)}</span>
            <span class="fish" aria-hidden="true">
              <span class="fish-sprite"></span>
            </span>
            ${recipe ? `<span class="filling-badge filling-${recipe.id}" title="${recipe.name}붕" aria-label="${recipe.name}붕"></span>` : ""}
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
    if (slot.stage === "batter") {
      return slot.progress >= BATTER_SET_PROGRESS ? "속넣기" : "반죽";
    }
    if (slot.stage === "front") {
      if (slot.progress < FRONT_FLIP_PROGRESS) {
        return "굽는중";
      }
      return slot.progress <= FRONT_GOLDEN_MAX ? "뒤집기" : "타기직전";
    }
    if (slot.stage === "back") {
      return slot.progress >= 88 ? "황금" : "뒷면";
    }
    if (slot.stage === "ready") {
      return slot.readyAge <= READY_PERFECT_SECONDS ? "황금" : "완성";
    }
    const labels = {
      empty: "빈틀",
      burnt: "폐기"
    };
    return labels[slot.stage] || "빈틀";
  }

  function renderShop() {
    els.shopCoinsText.textContent = compactMoney(state.save.coins);
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
            <span class="shop-price">${maxed ? "MAX" : `<span class="shop-price-coin">₩</span>${compactMoney(price)}`}</span>
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
            <span class="shop-icon recipe-icon recipe-${recipe.id}" aria-hidden="true" style="--recipe-color:${recipe.color}">
              <span class="recipe-dot">
                <span class="filling-mark filling-${recipe.id}"></span>
              </span>
            </span>
            <span>
              <span class="shop-title">${recipe.name} 레시피</span>
              <span class="shop-meta">${unlocked ? "해금 완료" : `판매가 ${money(recipe.price)}`}</span>
            </span>
            <span class="shop-price">${unlocked ? "OK" : `<span class="shop-price-coin">₩</span>${compactMoney(recipe.unlockCost)}`}</span>
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
        const reward = money(mission.reward);
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
    const bonusText = hitGoal ? money(state.closedBonus) : "없음";
    const statusText = hitGoal ? "목표 달성" : "목표 미달";
    els.summaryStats.innerHTML = `
      <div><span>DAY</span><strong>${state.closedDay}</strong></div>
      <div><span>상태</span><strong>${statusText}</strong></div>
      <div><span>매출</span><strong>${money(state.revenue)}</strong></div>
      <div><span>재료비</span><strong>${money(state.stats.cost)}</strong></div>
      <div><span>보너스</span><strong>${bonusText}</strong></div>
      <div><span>폐기손실</span><strong>${money(state.stats.waste)}</strong></div>
      <div><span>주문</span><strong>${state.stats.orders}건</strong></div>
      <div><span>최고 콤보</span><strong>x${state.maxCombo.toFixed(1)}</strong></div>
    `;
    showSummaryResults();
    els.daySummary.classList.remove("hidden");
    renderHud();
  }

  function showSummaryResults() {
    els.summaryResultsView.classList.remove("hidden");
    els.summaryShopView.classList.add("hidden");
  }

  function showSummaryShop() {
    renderShop();
    els.summaryResultsView.classList.add("hidden");
    els.summaryShopView.classList.remove("hidden");
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
    els.startGameButton.addEventListener("click", startGame);
    els.missionsButton.addEventListener("click", () => openSheet("missionsSheet"));
    els.musicButton.addEventListener("click", toggleMusic);
    els.pauseButton.addEventListener("click", () => setPaused(!state.paused));
    els.summaryShopButton.addEventListener("click", showSummaryShop);
    els.summaryBackButton.addEventListener("click", showSummaryResults);
    els.summaryButton.addEventListener("click", startNewDay);
    els.closeButtons.forEach((button) => {
      button.addEventListener("click", () => closeSheet(button.dataset.close));
    });
  }

  bindEvents();
  renderIntro();
  renderAll();
  updateMusicButton();
  requestAnimationFrame(tick);
})();
