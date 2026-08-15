// game.js - Idle Skill Tree Game Engine

class SkillTreeGame {
  constructor(saveData = null) {
    // Load from save if provided
    if (saveData) {
      this.xp = saveData.xp || 0;
      this.level = saveData.level || 1;
      this.skillPoints = saveData.skillPoints || 0;
      this.nodes = saveData.nodes || {};
      this.lastSave = saveData.lastSave || Date.now();
    } else {
      // Player state
      this.xp = 0;
      this.level = 1;
      this.skillPoints = 0;

      // Node states
      this.nodes = {
        spark: {
        name: "Spark of Insight",
        tier: 1,
        cost: 0,
        purchased: true,
        level: 0,
        xpPerClick: 10,
        clickLevel: 0
      },
      meditation: {
        name: "Meditation",
        tier: 2,
        cost: 0,
        purchased: false,
        level: 0,
        xpPerSecond: 0
      },
      focusedMind: {
        name: "Focused Mind",
        tier: 3,
        cost: 0,
        purchased: false,
        level: 0,
        xpPerSecondMultiplier: 1
      },
      resonance: {
        name: "Resonance",
        tier: 3,
        cost: 0,
        purchased: false,
        level: 0,
        discount: 0
      },
      willpower: {
        name: "Willpower",
        tier: 3,
        cost: 0,
        purchased: false,
        level: 0,
        clickMultiplier: 1
      },
      arcaneFlow: {
        name: "Arcane Flow",
        tier: 4,
        cost: 0,
        purchased: false,
        level: 0,
        flatClickBonus: 0
      },
      transcendence: {
        name: "Transcendence",
        tier: 5,
        cost: 0,
        purchased: false,
        level: 0,
        doubleXPRate: 0
      }
    };

      // Game loop
      this.lastUpdate = Date.now();
      this.xpPerSecond = 0;
      this.lastSave = Date.now();
    }

    // Initialize XP/s
    this.updateXPPerSecond();
    
    // Ensure nodes have defaults if loaded from save
    this.ensureNodeDefaults();
  }

  // Getters
  get xpToLevelUp() {
    const base = 100 * this.level;
    const discount = Math.min(this.resonanceDiscount, 0.95);
    return Math.max(1, Math.floor(base * (1 - discount)));
  }

  get totalClickXP() {
    const base = 10 + this.nodes.spark.clickLevel * 5;
    const willpowerMult = 1 + this.nodes.willpower.level * 0.5;
    const arcaneFlat = this.nodes.arcaneFlow.level * 5;
    return Math.floor(base * willpowerMult) + arcaneFlat;
  }

  get totalMeditationXP() {
    const base = 10 * this.nodes.meditation.level;
    const multiplier = 1 + this.nodes.focusedMind.level * 0.5;
    return base * multiplier;
  }

  get resonanceDiscount() {
    return this.nodes.resonance.level * 0.05;
  }

  get doubleXPRate() {
    return this.nodes.transcendence.level * 0.01;
  }

  // Cost calculations
  getMeditationCost(level) {
    return Math.pow(2, level);
  }

  getFocusedMindCost(level) {
    return Math.pow(3, level) + 1;
  }

  getResonanceCost(level) {
    return Math.pow(3, level) + 1;
  }

  getWillpowerCost(level) {
    return Math.pow(3, level) + 1;
  }

  getArcaneFlowCost(level) {
    return Math.pow(5, level) + 1;
  }

  getTranscendenceCost(level) {
    return Math.pow(8, level) + 1;
  }

  // Actions
  clickSpark() {
    const xpGain = this.totalClickXP;
    const isDoubleXP = Math.random() < this.doubleXPRate;
    const finalXP = isDoubleXP ? xpGain * 2 : xpGain;

    this.xp += finalXP;
    this.checkLevelUp();
  }

  purchaseNode(nodeName) {
    const node = this.nodes[nodeName];
    if (node.purchased) return false;

    const cost = this.getCostForNode(nodeName, 0);
    if (this.skillPoints < cost) return false;

    this.skillPoints -= cost;
    node.purchased = true;
    node.level = 1;
    this.updateXPPerSecond();
    return true;
  }

  upgradeNode(nodeName) {
    const node = this.nodes[nodeName];
    if (!node.purchased) return false;

    const cost = this.getCostForNode(nodeName, node.level);
    if (this.skillPoints < cost) return false;

    this.skillPoints -= cost;
    node.level++;
    this.updateXPPerSecond();
    return true;
  }

  getCostForNode(nodeName, level) {
    // Cost formulas expect the current level (0 for first purchase)
    switch (nodeName) {
      case 'meditation':
        return this.getMeditationCost(level);
      case 'focusedMind':
      case 'resonance':
      case 'willpower':
        return this.getFocusedMindCost(level);
      case 'arcaneFlow':
        return this.getArcaneFlowCost(level);
      case 'transcendence':
        return this.getTranscendenceCost(level);
      default:
        return 0;
    }
  }

  checkLevelUp() {
    while (this.xp >= this.xpToLevelUp) {
      this.xp -= this.xpToLevelUp;
      this.level++;
      this.skillPoints++;
    }
  }

  updateXPPerSecond() {
    this.xpPerSecond = this.totalMeditationXP;
  }

  update(deltaTime) {
    const xpGained = this.xpPerSecond * (deltaTime / 1000);
    this.xp += xpGained;
    this.checkLevelUp();
  }

  ensureNodeDefaults() {
    const defaultNodes = {
      spark: { name: "Spark of Insight", tier: 1, cost: 0, purchased: true, level: 0, xpPerClick: 10, clickLevel: 0 },
      meditation: { name: "Meditation", tier: 2, cost: 0, purchased: false, level: 0, xpPerSecond: 0 },
      focusedMind: { name: "Focused Mind", tier: 3, cost: 0, purchased: false, level: 0, xpPerSecondMultiplier: 1 },
      resonance: { name: "Resonance", tier: 3, cost: 0, purchased: false, level: 0, discount: 0 },
      willpower: { name: "Willpower", tier: 3, cost: 0, purchased: false, level: 0, clickMultiplier: 1 },
      arcaneFlow: { name: "Arcane Flow", tier: 4, cost: 0, purchased: false, level: 0, flatClickBonus: 0 },
      transcendence: { name: "Transcendence", tier: 5, cost: 0, purchased: false, level: 0, doubleXPRate: 0 }
    };
    
    for (const [key, defaults] of Object.entries(defaultNodes)) {
      if (!this.nodes[key]) {
        this.nodes[key] = { ...defaults };
      } else {
        // Merge missing properties
        for (const [prop, value] of Object.entries(defaults)) {
          if (!(prop in this.nodes[key])) {
            this.nodes[key][prop] = value;
          }
        }
      }
    }
  }

  getSaveData() {
    return {
      xp: this.xp,
      level: this.level,
      skillPoints: this.skillPoints,
      nodes: this.nodes,
      lastSave: Date.now()
    };
  }

  loadSave(data) {
    if (data) {
      // Apply offline progress
      const now = Date.now();
      const timeDiff = now - (data.lastSave || now);
      if (timeDiff > 0 && this.xpPerSecond > 0) {
        const offlineXP = this.xpPerSecond * (timeDiff / 1000);
        this.xp += offlineXP;
        this.checkLevelUp();
      }
    }
  }
}
