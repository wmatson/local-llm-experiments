// ui.js - UI controller for Idle Skill Tree

class SkillTreeUI {
  constructor(game) {
    this.game = game;
    this.skillTreeEl = document.getElementById('skill-tree');
    this.lastTime = Date.now();
    
    // Node definitions with unlock conditions
    this.nodeDefs = [
      {
        id: 'spark',
        tier: 1,
        name: 'Spark of Insight',
        description: 'Click to gain XP',
        requiresLevel: null,
        requiresNode: null
      },
      {
        id: 'meditation',
        tier: 2,
        name: 'Meditation',
        description: 'Gain XP per second',
        requiresLevel: null,
        requiresNode: null
      },
      {
        id: 'focusedMind',
        tier: 3,
        name: 'Focused Mind',
        description: 'Increases Meditation XP/s',
        requiresLevel: null,
        requiresNode: 'meditation'
      },
      {
        id: 'resonance',
        tier: 3,
        name: 'Resonance',
        description: 'Reduces XP cost to level up',
        requiresLevel: null,
        requiresNode: 'meditation'
      },
      {
        id: 'willpower',
        tier: 3,
        name: 'Willpower',
        description: 'Increases click XP multiplier',
        requiresLevel: null,
        requiresNode: 'meditation'
      },
      {
        id: 'arcaneFlow',
        tier: 4,
        name: 'Arcane Flow',
        description: 'Flat bonus to click XP',
        requiresLevel: 10,
        requiresNode: null
      },
      {
        id: 'transcendence',
        tier: 5,
        name: 'Transcendence',
        description: 'Chance for double XP on clicks',
        requiresLevel: 25,
        requiresNode: null
      }
    ];
  }

  init() {
    this.loadGame();
    this.render();
    this.bindEvents();
    this.startGameLoop();
    
    // Initial render
    this.updateStats();
    this.renderSkillTree();
    
    // Save game periodically
    setInterval(() => this.saveGame(), 5000);
    window.addEventListener('beforeunload', () => this.saveGame());
  }

  bindEvents() {
    // Spark click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('spark-click')) {
        this.game.clickSpark();
        this.updateStats();
        this.renderSkillTree();
      }
      
      if (e.target.classList.contains('node-action-btn')) {
        const nodeId = e.target.dataset.node;
        const action = e.target.dataset.action;
        
        if (action === 'purchase') {
          const success = this.game.purchaseNode(nodeId);
          if (success) {
            this.updateStats();
            this.renderSkillTree();
          }
        } else if (action === 'upgrade') {
          const success = this.game.upgradeNode(nodeId);
          if (success) {
            this.updateStats();
            this.renderSkillTree();
          }
        }
      }
    });
  }

  startGameLoop() {
    const loop = () => {
      const now = Date.now();
      const deltaTime = now - this.lastTime;
      this.lastTime = now;
      
      this.game.update(deltaTime);
      this.updateStats();
      
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateStats() {
    document.getElementById('level').textContent = this.game.level;
    
    const xp = Math.floor(this.game.xp);
    const xpToNext = this.game.xpToLevelUp;
    const xpPercent = (this.game.xp / xpToNext) * 100;
    
    document.getElementById('xp').textContent = xp.toLocaleString();
    document.getElementById('xp-bar').style.width = `${Math.min(xpPercent, 100)}%`;
    document.getElementById('xp-needed').textContent = `${xp.toLocaleString()} / ${xpToNext.toLocaleString()} XP`;
    
    document.getElementById('skill-points').textContent = this.game.skillPoints;
    document.getElementById('xp-per-second').textContent = this.game.xpPerSecond.toFixed(1);
  }

  getNodeCost(nodeId, level) {
    const node = this.game.nodes[nodeId];
    if (!node) return null;
    
    // Cost for next upgrade/purchase
    const nextLevel = node.purchased ? node.level + 1 : 1;
    return this.game.getCostForNode(nodeId, nextLevel);
  }

  canPurchaseNode(nodeDef) {
    const node = this.game.nodes[nodeDef.id];
    
    // Already purchased?
    if (node.purchased) return false;
    
    // Check unlock conditions
    if (nodeDef.requiresLevel && this.game.level < nodeDef.requiresLevel) {
      return false;
    }
    
    if (nodeDef.requiresNode) {
      const requiredNode = this.game.nodes[nodeDef.requiresNode];
      if (!requiredNode.purchased) {
        return false;
      }
    }
    
    // Check cost
    const cost = this.game.getCostForNode(nodeDef.id, 1);
    return this.game.skillPoints >= cost;
  }

  canUpgradeNode(nodeId) {
    const node = this.game.nodes[nodeId];
    if (!node.purchased) return false;
    
    const cost = this.game.getCostForNode(nodeId, node.level);
    return this.game.skillPoints >= cost;
  }

  renderSkillTree() {
    // Check unlock conditions
    this.nodeDefs.forEach(def => {
      let unlocked = true;
      
      if (def.requiresLevel && this.game.level < def.requiresLevel) {
        unlocked = false;
      }
      
      if (def.requiresNode) {
        const requiredNode = this.game.nodes[def.requiresNode];
        if (!requiredNode.purchased || requiredNode.level < 1) {
          unlocked = false;
        }
      }
      
      // Spark and Meditation are always available
      if (def.id === 'spark' || def.id === 'meditation') {
        unlocked = true;
      }
      
      def.isUnlocked = unlocked;
    });
    
    let html = '<div class="spark-node node">';
    html += '<h3>Spark of Insight</h3>';
    html += '<div class="node-tier">Tier 1 - Starting Node</div>';
    html += `<div class="node-info">XP per click: ${this.game.totalClickXP.toFixed(0)}</div>`;
    html += '<button class="spark-click">⚡ CLICK ⚡</button>';
    html += '</div>';
    
    // Render other nodes
    this.nodeDefs.filter(def => def.id !== 'spark').forEach(def => {
      const node = this.game.nodes[def.id];
      const isUnlocked = def.isUnlocked;
      const isPurchased = node.purchased;
      
      let nodeClass = 'node';
      if (!isUnlocked) nodeClass += ' locked';
      if (isPurchased) nodeClass += ' purchased';
      
      html += `<div class="${nodeClass}">`;
      html += `<h3>${def.name}</h3>`;
      html += `<div class="node-tier">Tier ${def.tier}</div>`;
      
      if (!isUnlocked) {
        html += `<div class="node-info">${def.description}</div>`;
        if (def.requiresLevel) {
          html += `<div class="node-info">Requires Level ${def.requiresLevel}</div>`;
        } else if (def.requiresNode) {
          const reqNode = this.game.nodes[def.requiresNode];
          html += `<div class="node-info">Requires ${reqNode.name}</div>`;
        }
      } else if (!isPurchased) {
        const cost = this.game.getCostForNode(def.id, 0);
        html += `<div class="node-cost">Cost: ${cost} SP</div>`;
        html += `<button class="node-action-btn purchase" data-node="${def.id}" data-action="purchase">Purchase</button>`;
      } else {
        const cost = this.game.getCostForNode(def.id, node.level);

        const canAfford = this.game.skillPoints >= cost;
        
        html += `<div class="node-level">Level ${node.level}</div>`;
        html += `<div class="node-cost">Next: ${cost} SP</div>`;
        html += `<button class="node-action-btn upgrade" data-node="${def.id}" data-action="upgrade" ${!canAfford ? 'disabled' : ''}>Upgrade</button>`;
        
        // Show effects
        if (def.id === 'meditation') {
          html += `<div class="node-info">+${(10 * node.level)} XP/s base</div>`;
        } else if (def.id === 'focusedMind') {
          const mult = 1 + node.level * 0.5;
          html += `<div class="node-info">Meditation x${mult.toFixed(1)}</div>`;
        } else if (def.id === 'willpower') {
          const mult = 1 + node.level * 0.5;
          html += `<div class="node-info">Click x${mult.toFixed(1)}</div>`;
        }
      }
      
      html += '</div>';
    });
    
    this.skillTreeEl.innerHTML = html;
  }

  render() {
    // Initial render handled in init
  }

  saveGame() {
    const saveData = this.game.getSaveData();
    localStorage.setItem('idleSkillTreeSave', JSON.stringify(saveData));
    console.log('Game saved');
  }

  loadGame() {
    try {
      const saveDataStr = localStorage.getItem('idleSkillTreeSave');
      if (saveDataStr) {
        const saveData = JSON.parse(saveDataStr);
        // Reconstruct game with save data
        this.game.xp = saveData.xp || 0;
        this.game.level = saveData.level || 1;
        this.game.skillPoints = saveData.skillPoints || 0;
        this.game.nodes = saveData.nodes || {};
        this.game.lastSave = saveData.lastSave || Date.now();
        
        // Apply offline progress
        const now = Date.now();
        const timeDiff = now - this.game.lastSave;
        if (timeDiff > 0 && this.game.xpPerSecond > 0) {
          const offlineXP = this.game.xpPerSecond * (timeDiff / 1000);
          this.game.xp += offlineXP;
          this.game.checkLevelUp();
          console.log(`Gained ${offlineXP.toFixed(0)} XP while offline`);
        }
        
        console.log('Game loaded');
      }
    } catch (e) {
      console.error('Failed to load game:', e);
    }
  }
}
