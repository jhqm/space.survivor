// 游戏配置
const CONFIG = {
    canvas: {
        width: 1200,
        height: 700
    },
    player: {
        size: 20,
        speed: 5,
        maxHealth: 100,
        shootCooldown: 200, // 提高50%射击频率：300 -> 200
        bulletCount: 1 // 同时发射的子弹数量
    },
    bullet: {
        size: 5,
        speed: 8,
        damage: 20
    },
    enemy: {
        size: 25,
        speed: 2,
        health: 15, // 降低一半：30 -> 15
        shootCooldown: 2000,
        spawnInterval: 2000
    },
    chaser: {
        size: 15,
        speed: 3, // 150%速度
        health: 10, // 降低一半：20 -> 10
        damage: 15
    },
    treasure: {
        size: 30,
        guardCount: 3, // 守卫数量
        minWaveInterval: 2,
        maxWaveInterval: 7,
        spawnDistance: 2000, // 2-3屏距离
        guardRange: 300 // 守卫活动范围
    },
    guardian: {
        size: 40,
        speed: 1.5,
        health: 60, // 降低一半：120 -> 60
        shootCooldown: 2500,
        damage: 15,
        aggroRange: 350 // 仇恨范围
    },
    titan: {
        size: 50,
        speed: 1, // 50%速度
        health: 45, // 降低一半：90 -> 45
        shootCooldown: 3000,
        directions: 8
    },
    enemyBullet: {
        size: 6,
        speed: 5,
        damage: 10
    },
    world: {
        chunkSize: 1000,
        viewDistance: 2
    },
    experience: {
        baseRequired: 50,
        multiplier: 1.5
    },
    healthPack: {
        dropChance: 0.05,
        healAmount: 0.3,
        size: 15
    },
    enemyDistribution: {
        normal: 0.6,
        chaser: 0.3,
        titan: 0.1
    }
};

// 摄像机类
class Camera {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.smoothing = 0.15; // 平滑跟随系数（提高到0.15，更快的跟随）
        this.isFixed = false; // 是否固定摄像机
        this.fixedX = 0;
        this.fixedY = 0;
    }

    follow(target, bossActive = false) {
        // 如果摄像机固定，不跟随目标
        if (this.isFixed) {
            this.x = this.fixedX;
            this.y = this.fixedY;
            return;
        }
        
        // 平滑跟随目标
        this.x += (target.x - this.x) * this.smoothing;
        
        // 如果boss存在，玩家位置在下半屏居中，否则在屏幕正中心
        let targetY = target.y;
        if (bossActive) {
            // boss存在时，摄像机向上偏移，让玩家显示在下半屏
            targetY = target.y - CONFIG.canvas.height / 4;
        }
        this.y += (targetY - this.y) * this.smoothing;
    }
    
    fixAt(x, y) {
        this.isFixed = true;
        this.fixedX = x;
        this.fixedY = y;
        this.x = x;
        this.y = y;
    }
    
    unfix() {
        this.isFixed = false;
    }

    apply(ctx) {
        ctx.translate(-this.x + CONFIG.canvas.width / 2, -this.y + CONFIG.canvas.height / 2);
    }

    worldToScreen(x, y) {
        return {
            x: x - this.x + CONFIG.canvas.width / 2,
            y: y - this.y + CONFIG.canvas.height / 2
        };
    }

    screenToWorld(x, y) {
        return {
            x: x + this.x - CONFIG.canvas.width / 2,
            y: y + this.y - CONFIG.canvas.height / 2
        };
    }
}

// 地图块类
class MapChunk {
    constructor(chunkX, chunkY) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.x = chunkX * CONFIG.world.chunkSize;
        this.y = chunkY * CONFIG.world.chunkSize;
        this.size = CONFIG.world.chunkSize;
        this.generated = false;
        this.decorations = this.generateDecorations();
    }

    generateDecorations() {
        // 生成装饰物（星星、小行星等）
        const decorations = [];
        const count = Math.floor(Math.random() * 15) + 10;
        
        for (let i = 0; i < count; i++) {
            decorations.push({
                x: this.x + Math.random() * this.size,
                y: this.y + Math.random() * this.size,
                size: Math.random() * 3 + 1,
                brightness: Math.random() * 0.5 + 0.5,
                type: Math.random() > 0.8 ? 'asteroid' : 'star'
            });
        }
        
        return decorations;
    }

    draw(ctx) {
        // 绘制地图块边界（调试用）
        ctx.strokeStyle = 'rgba(138, 43, 226, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.size, this.size);

        // 绘制装饰物
        this.decorations.forEach(deco => {
            if (deco.type === 'star') {
                ctx.save();
                ctx.globalAlpha = deco.brightness;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.save();
                ctx.fillStyle = '#555';
                ctx.beginPath();
                ctx.arc(deco.x, deco.y, deco.size * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#777';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }
        });
    }
}

// 世界管理器
class WorldManager {
    constructor() {
        this.chunks = new Map();
    }

    getChunkKey(chunkX, chunkY) {
        return `${chunkX},${chunkY}`;
    }

    getChunkCoords(worldX, worldY) {
        return {
            chunkX: Math.floor(worldX / CONFIG.world.chunkSize),
            chunkY: Math.floor(worldY / CONFIG.world.chunkSize)
        };
    }

    getOrCreateChunk(chunkX, chunkY) {
        const key = this.getChunkKey(chunkX, chunkY);
        if (!this.chunks.has(key)) {
            this.chunks.set(key, new MapChunk(chunkX, chunkY));
        }
        return this.chunks.get(key);
    }

    updateVisibleChunks(cameraX, cameraY) {
        const centerChunk = this.getChunkCoords(cameraX, cameraY);
        const viewDistance = CONFIG.world.viewDistance;

        // 生成视野范围内的地图块
        for (let x = centerChunk.chunkX - viewDistance; x <= centerChunk.chunkX + viewDistance; x++) {
            for (let y = centerChunk.chunkY - viewDistance; y <= centerChunk.chunkY + viewDistance; y++) {
                this.getOrCreateChunk(x, y);
            }
        }

        // 清理远离的地图块（可选，节省内存）
        const toRemove = [];
        this.chunks.forEach((chunk, key) => {
            const dx = Math.abs(chunk.chunkX - centerChunk.chunkX);
            const dy = Math.abs(chunk.chunkY - centerChunk.chunkY);
            if (dx > viewDistance + 2 || dy > viewDistance + 2) {
                toRemove.push(key);
            }
        });
        toRemove.forEach(key => this.chunks.delete(key));
    }

    getVisibleChunks(cameraX, cameraY) {
        const centerChunk = this.getChunkCoords(cameraX, cameraY);
        const viewDistance = CONFIG.world.viewDistance;
        const visible = [];

        for (let x = centerChunk.chunkX - viewDistance; x <= centerChunk.chunkX + viewDistance; x++) {
            for (let y = centerChunk.chunkY - viewDistance; y <= centerChunk.chunkY + viewDistance; y++) {
                const chunk = this.getOrCreateChunk(x, y);
                visible.push(chunk);
            }
        }

        return visible;
    }
}

// 经验掉落物类
class ExperienceGem {
    constructor(x, y, wave = 1, shopSystem = null) {
        this.x = x;
        this.y = y;
        this.size = 8;
        // 经验值随波次增加：基础10 + (波次-1) * 2
        this.value = 10 + (wave - 1) * 2;
        this.rotation = 0;
        this.rotationSpeed = 0.1;
        // 吸引范围：如果引力捕获遗物激活，增加100%
        const baseRange = 150;
        this.magnetRange = shopSystem && shopSystem.isRelicActive('gravityCapture') ? baseRange * 2 : baseRange;
        this.magnetSpeed = 5;
        this.isBeingCollected = false;
    }

    update(playerX, playerY) {
        this.rotation += this.rotationSpeed;
        
        // 计算与玩家的距离
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 如果在吸引范围内，向玩家移动
        if (distance < this.magnetRange) {
            this.isBeingCollected = true;
            const moveX = (dx / distance) * this.magnetSpeed;
            const moveY = (dy / distance) * this.magnetSpeed;
            this.x += moveX;
            this.y += moveY;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // 绘制发光效果
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffd700';
        
        // 绘制菱形
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        gradient.addColorStop(0, '#ffeb3b');
        gradient.addColorStop(0.5, '#ffd700');
        gradient.addColorStop(1, '#ffa000');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }
}

// 血包类
class HealthPack {
    constructor(x, y, shopSystem = null) {
        this.x = x;
        this.y = y;
        this.baseY = y;
        this.size = CONFIG.healthPack.size;
        this.floatOffset = 0;
        this.floatSpeed = 0.05;
        // 吸引范围：如果引力捕获遗物激活，增加100%
        const baseRange = 100;
        this.magnetRange = shopSystem && shopSystem.isRelicActive('gravityCapture') ? baseRange * 2 : baseRange;
        this.magnetSpeed = 4;
    }

    update(playerX, playerY) {
        // 上下浮动动画
        this.floatOffset += this.floatSpeed;
        this.y = this.baseY + Math.sin(this.floatOffset) * 5;
        
        // 计算与玩家的距离
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 如果在吸引范围内，向玩家移动
        if (distance < this.magnetRange) {
            const moveX = (dx / distance) * this.magnetSpeed;
            const moveY = (dy / distance) * this.magnetSpeed;
            this.x += moveX;
            this.baseY += moveY;
        }
    }

    draw(ctx) {
        ctx.save();
        
        // 绘制环绕光晕
        const glowGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
        glowGradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.1)');
        glowGradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制圆角矩形血包
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ef4444';
        
        const gradient = ctx.createLinearGradient(
            this.x - this.size, this.y - this.size,
            this.x + this.size, this.y + this.size
        );
        gradient.addColorStop(0, '#f87171');
        gradient.addColorStop(0.5, '#ef4444');
        gradient.addColorStop(1, '#dc2626');
        ctx.fillStyle = gradient;
        
        // 绘制圆角矩形
        const radius = 5;
        ctx.beginPath();
        ctx.moveTo(this.x - this.size + radius, this.y - this.size);
        ctx.lineTo(this.x + this.size - radius, this.y - this.size);
        ctx.quadraticCurveTo(this.x + this.size, this.y - this.size, this.x + this.size, this.y - this.size + radius);
        ctx.lineTo(this.x + this.size, this.y + this.size - radius);
        ctx.quadraticCurveTo(this.x + this.size, this.y + this.size, this.x + this.size - radius, this.y + this.size);
        ctx.lineTo(this.x - this.size + radius, this.y + this.size);
        ctx.quadraticCurveTo(this.x - this.size, this.y + this.size, this.x - this.size, this.y + this.size - radius);
        ctx.lineTo(this.x - this.size, this.y - this.size + radius);
        ctx.quadraticCurveTo(this.x - this.size, this.y - this.size, this.x - this.size + radius, this.y - this.size);
        ctx.closePath();
        ctx.fill();
        
        // 绘制H字母
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${this.size * 1.2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', this.x, this.y);
        
        ctx.restore();
    }
}

// 遗物币和永久升级系统
class ShopSystem {
    constructor() {
        this.loadData();
    }

    loadData() {
        const saved = localStorage.getItem('spaceGameShop');
        if (saved) {
            const data = JSON.parse(saved);
            this.coins = data.coins || 0;
            this.permanentUpgrades = data.permanentUpgrades || {
                health: 0,
                speed: 0,
                damage: 0
            };
            this.relics = data.relics || {
                bulletSplit: { purchased: false, active: false }
            };
        } else {
            this.coins = 0;
            this.permanentUpgrades = {
                health: 0,
                speed: 0,
                damage: 0
            };
            this.relics = {
                bulletSplit: { purchased: false, active: false },
                gravityCapture: { purchased: false, active: false },
                advancedRepair: { purchased: false, active: false }
            };
        }
    }

    saveData() {
        localStorage.setItem('spaceGameShop', JSON.stringify({
            coins: this.coins,
            permanentUpgrades: this.permanentUpgrades,
            relics: this.relics
        }));
    }

    addCoins(amount) {
        this.coins += amount;
        this.saveData();
    }

    spendCoins(amount) {
        if (this.coins >= amount) {
            this.coins -= amount;
            this.saveData();
            return true;
        }
        return false;
    }

    getUpgradeCost(type) {
        const level = this.permanentUpgrades[type];
        return 10 + level * 5; // 基础10，每级+5
    }

    buyUpgrade(type) {
        const cost = this.getUpgradeCost(type);
        if (this.spendCoins(cost)) {
            this.permanentUpgrades[type]++;
            this.saveData();
            return true;
        }
        return false;
    }

    getUpgradeBonus(type) {
        const level = this.permanentUpgrades[type];
        switch(type) {
            case 'health':
                return level * 20; // 每级+20血量
            case 'speed':
                return level * 0.1; // 每级+10%速度
            case 'damage':
                return level * 5; // 每级+5攻击
            default:
                return 0;
        }
    }

    buyRelic(relicId) {
        const relicCosts = {
            bulletSplit: 1,
            gravityCapture: 2,
            advancedRepair: 2
        };
        
        const cost = relicCosts[relicId] || 0;
        if (!this.relics[relicId].purchased && this.spendCoins(cost)) {
            this.relics[relicId].purchased = true;
            this.relics[relicId].active = true;
            this.saveData();
            return true;
        }
        return false;
    }

    toggleRelic(relicId) {
        if (this.relics[relicId] && this.relics[relicId].purchased) {
            this.relics[relicId].active = !this.relics[relicId].active;
            this.saveData();
            return true;
        }
        return false;
    }
    
    activateRelic(relicId) {
        if (this.relics[relicId]) {
            // GM模式下可以直接激活，不需要购买
            this.relics[relicId].purchased = true;
            this.relics[relicId].active = true;
            this.saveData();
            return true;
        }
        return false;
    }
    
    deactivateRelic(relicId) {
        if (this.relics[relicId]) {
            this.relics[relicId].active = false;
            this.saveData();
            return true;
        }
        return false;
    }

    isRelicActive(relicId) {
        return this.relics[relicId] && this.relics[relicId].active;
    }
}

// 游戏状态
class GameState {
    constructor() {
        this.score = 0;
        this.kills = 0;
        this.wave = 1;
        this.isRunning = false;
        this.isPaused = false;
        this.level = 1;
        this.experience = 0;
        this.experienceRequired = CONFIG.experience.baseRequired;
        this.upgrades = []; // 已获得的升级
    }

    reset() {
        this.score = 0;
        this.kills = 0;
        this.wave = 1;
        this.isRunning = false;
        this.isPaused = false;
        this.level = 1;
        this.experience = 0;
        this.experienceRequired = CONFIG.experience.baseRequired;
        this.upgrades = [];
    }

    addExperience(amount) {
        this.experience += amount;
        if (this.experience >= this.experienceRequired) {
            this.experience -= this.experienceRequired;
            this.level++;
            this.experienceRequired = Math.floor(CONFIG.experience.baseRequired * Math.pow(CONFIG.experience.multiplier, this.level - 1));
            return true; // 升级了
        }
        return false;
    }

    addUpgrade(upgradeName) {
        this.upgrades.push(upgradeName);
    }
}

// 玩家类
class Player {
    constructor(x, y, shopSystem) {
        this.x = x;
        this.y = y;
        this.size = CONFIG.player.size;
        this.baseSize = CONFIG.player.size;
        this.speed = CONFIG.player.speed;
        this.angle = 0;
        
        // 应用永久升级
        const healthBonus = shopSystem ? shopSystem.getUpgradeBonus('health') : 0;
        const speedBonus = shopSystem ? shopSystem.getUpgradeBonus('speed') : 0;
        const damageBonus = shopSystem ? shopSystem.getUpgradeBonus('damage') : 0;
        
        this.health = CONFIG.player.maxHealth + healthBonus;
        this.maxHealth = CONFIG.player.maxHealth + healthBonus;
        this.lastShootTime = 0;
        this.bulletCount = CONFIG.player.bulletCount;
        this.bulletSize = CONFIG.bullet.size;
        this.damage = CONFIG.bullet.damage + damageBonus;
        this.shootCooldown = CONFIG.player.shootCooldown;
        this.bulletSplitLevel = 0; // 子弹分裂等级
        
        // 物理属性 - 太空船风格
        this.vx = 0;
        this.vy = 0;
        this.acceleration = 0.8;
        this.friction = 0.96;
        this.maxSpeed = 4.8 * (1 + speedBonus);
        this.baseMaxSpeed = 4.8 * (1 + speedBonus);
        
        // 视觉效果
        this.thrustParticles = [];
        this.speedLines = [];
        
        // 反应装甲（防御小球）
        this.shields = [];
        
        // 僚机
        this.drones = [];
        
        // 能量力场
        this.energyField = {
            enabled: false,
            radius: 52, // 初始半径与反应装甲小球距离相同
            damage: 10, // 初始伤害 10/s (翻倍)
            level: 0
        };
        
        // 制导武器系统
        this.guidedWeapon = {
            enabled: false,
            level: 0,
            baseCooldown: 3000, // 基础冷却时间3秒
            cooldown: 3000,
            lastFireTime: 0,
            baseDamage: 30,
            damage: 30,
            missileCount: 1, // 同时发射的导弹数量
            searchRadius: 52 * 4, // 搜索范围为能量力场初始半径的400%
            blastRadius: 52 // 爆炸范围为能量力场初始半径的100%
        };
        
        // 减速效果
        this.slowEffect = 1; // 速度倍率，1为正常，0.5为减速50%
        this.slowEndTime = 0; // 减速效果结束时间
        
        // 受击反馈效果
        this.hitEffect = {
            active: false,
            intensity: 0,
            maxIntensity: 1,
            fadeSpeed: 0.05,
            pulseSpeed: 0.3,
            pulsePhase: 0
        };
    }

    update(keys, mouseX, mouseY, leftJoystick = null, rightJoystick = null) {
        // 计算加速度方向
        let ax = 0;
        let ay = 0;
        let isThrusting = false;
        
        // 虚拟摇杆控制（优先级高于键盘）
        if (leftJoystick && leftJoystick.active) {
            ax = leftJoystick.deltaX * this.acceleration;
            ay = leftJoystick.deltaY * this.acceleration;
            isThrusting = Math.abs(leftJoystick.deltaX) > 0.1 || Math.abs(leftJoystick.deltaY) > 0.1;
        } else {
            // 键盘控制
            if (keys['w'] || keys['W']) {
                ay -= this.acceleration;
                isThrusting = true;
            }
            if (keys['s'] || keys['S']) {
                ay += this.acceleration;
                isThrusting = true;
            }
            if (keys['a'] || keys['A']) {
                ax -= this.acceleration;
                isThrusting = true;
            }
            if (keys['d'] || keys['D']) {
                ax += this.acceleration;
                isThrusting = true;
            }
        }

        // 检查减速效果是否结束
        if (Date.now() > this.slowEndTime) {
            this.slowEffect = 1;
        }
        
        // 应用加速度到速度
        this.vx += ax;
        this.vy += ay;

        // 限制最大速度（考虑减速效果）
        const effectiveMaxSpeed = this.maxSpeed * this.slowEffect;
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > effectiveMaxSpeed) {
            this.vx = (this.vx / currentSpeed) * effectiveMaxSpeed;
            this.vy = (this.vy / currentSpeed) * effectiveMaxSpeed;
        }

        // 应用摩擦力（惯性衰减）
        this.vx *= this.friction;
        this.vy *= this.friction;

        // 如果速度很小，直接停止（提高阈值以避免微小的持续移动）
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        if (Math.abs(this.vy) < 0.1) this.vy = 0;

        // 更新位置（无边界限制，无限地图）
        this.x += this.vx;
        this.y += this.vy;

        // 计算朝向（右摇杆优先）
        if (rightJoystick && rightJoystick.active && (Math.abs(rightJoystick.deltaX) > 0.1 || Math.abs(rightJoystick.deltaY) > 0.1)) {
            // 使用右摇杆方向
            this.angle = Math.atan2(rightJoystick.deltaY, rightJoystick.deltaX);
        } else {
            // 使用鼠标方向
            this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        }
        
        // 生成尾焰粒子效果（当有推进时）
        if (isThrusting && Math.random() > 0.3) {
            const thrustAngle = Math.atan2(-ay, -ax); // 推进方向相反
            const distance = this.size * 0.8;
            const particleX = this.x + Math.cos(thrustAngle) * distance;
            const particleY = this.y + Math.sin(thrustAngle) * distance;
            
            this.thrustParticles.push({
                x: particleX,
                y: particleY,
                vx: Math.cos(thrustAngle) * 2 + (Math.random() - 0.5) * 2,
                vy: Math.sin(thrustAngle) * 2 + (Math.random() - 0.5) * 2,
                size: Math.random() * 3 + 2,
                life: 1,
                decay: 0.05
            });
        }
        
        // 生成速度线条（当速度较快时）
        if (currentSpeed > 2 && Math.random() > 0.5) {
            this.speedLines.push({
                x: this.x + (Math.random() - 0.5) * 40,
                y: this.y + (Math.random() - 0.5) * 40,
                vx: -this.vx * 0.5,
                vy: -this.vy * 0.5,
                life: 1,
                decay: 0.08
            });
        }
        
        // 更新尾焰粒子
        this.thrustParticles = this.thrustParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.size *= 0.92;
            return p.life > 0;
        });
        
        // 更新速度线条
        this.speedLines = this.speedLines.filter(line => {
            line.x += line.vx;
            line.y += line.vy;
            line.life -= line.decay;
            return line.life > 0;
        });
        
        // 更新受击效果
        if (this.hitEffect.active) {
            this.hitEffect.intensity -= this.hitEffect.fadeSpeed;
            this.hitEffect.pulsePhase += this.hitEffect.pulseSpeed;
            
            if (this.hitEffect.intensity <= 0) {
                this.hitEffect.active = false;
                this.hitEffect.intensity = 0;
            }
        }
    }

    draw(ctx) {
        // 绘制受击反馈光晕
        if (this.hitEffect.active && this.hitEffect.intensity > 0) {
            ctx.save();
            
            // 计算脉冲效果
            const pulse = Math.sin(this.hitEffect.pulsePhase) * 0.3 + 0.7;
            const glowRadius = this.size * 2.5 * pulse;
            
            // 绘制外层光晕
            ctx.globalAlpha = this.hitEffect.intensity * 0.4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
            const outerGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
            outerGradient.addColorStop(0, 'rgba(255, 50, 50, 0.8)');
            outerGradient.addColorStop(0.5, 'rgba(255, 100, 100, 0.4)');
            outerGradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
            ctx.fillStyle = outerGradient;
            ctx.fill();
            
            // 绘制内层光晕
            ctx.globalAlpha = this.hitEffect.intensity * 0.6;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
            const innerGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 1.5);
            innerGradient.addColorStop(0, 'rgba(255, 80, 80, 0.9)');
            innerGradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
            ctx.fillStyle = innerGradient;
            ctx.fill();
            
            ctx.restore();
        }
        
        // 绘制能量力场
        if (this.energyField.enabled) {
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.energyField.radius, 0, Math.PI * 2);
            const fieldGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.energyField.radius);
            fieldGradient.addColorStop(0, 'rgba(138, 43, 226, 0.5)');
            fieldGradient.addColorStop(0.7, 'rgba(77, 208, 225, 0.3)');
            fieldGradient.addColorStop(1, 'rgba(77, 208, 225, 0)');
            ctx.fillStyle = fieldGradient;
            ctx.fill();
            
            // 绘制力场边缘
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#4dd0e1';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
        
        // 绘制速度线条
        this.speedLines.forEach(line => {
            ctx.save();
            ctx.globalAlpha = line.life * 0.5;
            ctx.strokeStyle = '#4dd0e1';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(line.x, line.y);
            ctx.lineTo(line.x - line.vx * 3, line.y - line.vy * 3);
            ctx.stroke();
            ctx.restore();
        });
        
        // 绘制尾焰粒子
        this.thrustParticles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            gradient.addColorStop(0, '#ffeb3b');
            gradient.addColorStop(0.5, '#ff9800');
            gradient.addColorStop(1, '#ff5722');
            ctx.fillStyle = gradient;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff9800';
            ctx.fill();
            ctx.restore();
        });
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 绘制三角形（带发光效果）
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#8A2BE2';
        
        ctx.beginPath();
        ctx.moveTo(this.size, 0);
        ctx.lineTo(-this.size, -this.size / 2);
        ctx.lineTo(-this.size, this.size / 2);
        ctx.closePath();

        // 渐变填充
        const gradient = ctx.createLinearGradient(-this.size, 0, this.size, 0);
        gradient.addColorStop(0, '#8A2BE2');
        gradient.addColorStop(0.5, '#9a3bf2');
        gradient.addColorStop(1, '#4dd0e1');
        ctx.fillStyle = gradient;
        ctx.fill();

        // 边框
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        // 绘制生命值条
        const barWidth = 40;
        const barHeight = 5;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#4ade80' : healthPercent > 0.25 ? '#fbbf24' : '#ef4444';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health < 0) this.health = 0;
        
        // 触发受击反馈效果
        this.hitEffect.active = true;
        this.hitEffect.intensity = this.hitEffect.maxIntensity;
        this.hitEffect.pulsePhase = 0;
    }
    
    applySlow(slowEffect, duration) {
        this.slowEffect = slowEffect;
        this.slowEndTime = Date.now() + duration;
    }

    canShoot() {
        const now = Date.now();
        if (now - this.lastShootTime >= this.shootCooldown) {
            this.lastShootTime = now;
            return true;
        }
        return false;
    }
}

// 子弹类
class Bullet {
    constructor(x, y, angle, isPlayer = true, splitLevel = 0) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.isPlayer = isPlayer;
        this.size = isPlayer ? CONFIG.bullet.size : CONFIG.enemyBullet.size;
        this.speed = isPlayer ? CONFIG.bullet.speed : CONFIG.enemyBullet.speed;
        this.damage = isPlayer ? CONFIG.bullet.damage : CONFIG.enemyBullet.damage;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.splitLevel = splitLevel; // 分裂等级，0表示不分裂
        this.hasHit = false; // 是否已经命中
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        if (this.isPlayer) {
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, '#4dd0e1');
            gradient.addColorStop(1, '#0097a7');
            ctx.fillStyle = gradient;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#4dd0e1';
        } else {
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, '#ff5252');
            gradient.addColorStop(1, '#d32f2f');
            ctx.fillStyle = gradient;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff5252';
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    isOutOfBounds(playerX, playerY) {
        // 基于与玩家的距离判断是否超出范围
        const dx = this.x - playerX;
        const dy = this.y - playerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > 1500; // 超过1500像素就移除
    }

    split() {
        // 生成分裂子弹
        if (this.splitLevel <= 0 || this.hasHit) return [];
        
        this.hasHit = true;
        const splitBullets = [];
        const splitCount = this.splitLevel + 1; // 分裂数量 = 等级 + 1
        
        for (let i = 0; i < splitCount; i++) {
            const randomAngle = Math.random() * Math.PI * 2;
            const splitBullet = new Bullet(this.x, this.y, randomAngle, true, 0);
            splitBullet.size = this.size * 0.8;
            splitBullet.damage = this.damage * 0.5;
            splitBullets.push(splitBullet);
        }
        
        return splitBullets;
    }
}

// 导弹类
class Missile {
    constructor(x, y, damage, blastRadius) {
        this.x = x;
        this.y = y;
        this.size = 12;
        this.speed = 6;
        this.damage = damage;
        this.blastRadius = blastRadius;
        this.target = null;
        this.angle = 0;
        this.rotation = 0;
        this.trailParticles = [];
    }

    findTarget(enemies, playerX, playerY, searchRadius) {
        // 在搜索范围内找到血量最高的敌人（初始目标选择）
        let maxHealth = 0;
        let targetEnemy = null;

        enemies.forEach(enemy => {
            const dx = enemy.x - playerX;
            const dy = enemy.y - playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= searchRadius && enemy.health > maxHealth) {
                maxHealth = enemy.health;
                targetEnemy = enemy;
            }
        });

        this.target = targetEnemy;
    }

    // 动态寻找离导弹最近的敌人
    findClosestTarget(enemies) {
        let minDistance = Infinity;
        let closestEnemy = null;

        enemies.forEach(enemy => {
            if (enemy.health <= 0) return; // 跳过已死亡的敌人
            
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                closestEnemy = enemy;
            }
        });

        return closestEnemy;
    }

    // 多目标识别：评估周围所有敌人的威胁度
    evaluateTargets(enemies, maxRange = 800) {
        const targets = [];
        
        enemies.forEach(enemy => {
            if (enemy.health <= 0) return;
            
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= maxRange) {
                // 计算威胁度：距离越近、血量越高，威胁度越高
                const distanceFactor = 1 - (distance / maxRange); // 0-1，越近越高
                const healthFactor = enemy.health / enemy.maxHealth; // 0-1
                const threat = distanceFactor * 0.7 + healthFactor * 0.3; // 距离权重70%，血量权重30%
                
                targets.push({
                    enemy: enemy,
                    distance: distance,
                    threat: threat,
                    angle: Math.atan2(dy, dx)
                });
            }
        });
        
        // 按威胁度排序
        targets.sort((a, b) => b.threat - a.threat);
        return targets;
    }

    // 动态路径优化：预测目标移动并调整追踪角度
    calculateOptimalAngle(target) {
        if (!target) return this.angle;
        
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 预测目标未来位置（基于目标速度）
        const predictionTime = distance / this.speed * 0.5; // 预测时间
        let predictedX = target.x;
        let predictedY = target.y;
        
        // 如果目标有速度信息，预测其移动
        if (target.vx !== undefined && target.vy !== undefined) {
            predictedX += target.vx * predictionTime;
            predictedY += target.vy * predictionTime;
        }
        
        // 计算到预测位置的角度
        const predictedDx = predictedX - this.x;
        const predictedDy = predictedY - this.y;
        const targetAngle = Math.atan2(predictedDy, predictedDx);
        
        // 平滑转向：限制每帧的最大转向角度
        const maxTurnRate = 0.15; // 最大转向速率
        let angleDiff = targetAngle - this.angle;
        
        // 标准化角度差到 -π 到 π 范围
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // 限制转向速度
        if (Math.abs(angleDiff) > maxTurnRate) {
            angleDiff = Math.sign(angleDiff) * maxTurnRate;
        }
        
        return this.angle + angleDiff;
    }

    update(enemies) {
        // 实时寻找最近的目标
        const closestTarget = this.findClosestTarget(enemies);
        
        // 如果找到了更近的目标，切换目标
        if (closestTarget) {
            this.target = closestTarget;
        }
        
        // 如果目标死亡，清除目标
        if (this.target && this.target.health <= 0) {
            this.target = null;
        }

        // 使用动态路径优化计算最佳追踪角度
        if (this.target) {
            this.angle = this.calculateOptimalAngle(this.target);
        }

        // 更新位置
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.rotation += 0.1;

        // 生成尾焰粒子
        if (Math.random() > 0.5) {
            this.trailParticles.push({
                x: this.x,
                y: this.y,
                size: Math.random() * 3 + 2,
                life: 1,
                decay: 0.05
            });
        }

        // 更新尾焰粒子
        this.trailParticles = this.trailParticles.filter(p => {
            p.life -= p.decay;
            p.size *= 0.95;
            return p.life > 0;
        });
    }

    draw(ctx) {
        // 绘制目标锁定线（如果有目标）
        if (this.target && this.target.health > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 在目标上绘制锁定圈
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.target.x, this.target.y, this.target.size + 10, 0, Math.PI * 2);
            ctx.stroke();
            
            // 绘制锁定角标
            const cornerSize = 8;
            const offset = this.target.size + 15;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            // 左上角
            ctx.beginPath();
            ctx.moveTo(this.target.x - offset, this.target.y - offset + cornerSize);
            ctx.lineTo(this.target.x - offset, this.target.y - offset);
            ctx.lineTo(this.target.x - offset + cornerSize, this.target.y - offset);
            ctx.stroke();
            // 右上角
            ctx.beginPath();
            ctx.moveTo(this.target.x + offset - cornerSize, this.target.y - offset);
            ctx.lineTo(this.target.x + offset, this.target.y - offset);
            ctx.lineTo(this.target.x + offset, this.target.y - offset + cornerSize);
            ctx.stroke();
            // 左下角
            ctx.beginPath();
            ctx.moveTo(this.target.x - offset, this.target.y + offset - cornerSize);
            ctx.lineTo(this.target.x - offset, this.target.y + offset);
            ctx.lineTo(this.target.x - offset + cornerSize, this.target.y + offset);
            ctx.stroke();
            // 右下角
            ctx.beginPath();
            ctx.moveTo(this.target.x + offset - cornerSize, this.target.y + offset);
            ctx.lineTo(this.target.x + offset, this.target.y + offset);
            ctx.lineTo(this.target.x + offset, this.target.y + offset - cornerSize);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // 绘制尾焰
        this.trailParticles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life * 0.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            gradient.addColorStop(0, '#ff9800');
            gradient.addColorStop(0.5, '#ff5722');
            gradient.addColorStop(1, '#d32f2f');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.restore();
        });

        // 绘制导弹本体
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 导弹主体（火箭形状）
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(this.size, 0);
        ctx.lineTo(-this.size * 0.5, -this.size * 0.4);
        ctx.lineTo(-this.size * 0.3, 0);
        ctx.lineTo(-this.size * 0.5, this.size * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 导弹头部高光
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(this.size * 0.5, 0, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // 发光效果
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffd700';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    isOutOfBounds(playerX, playerY) {
        const dx = this.x - playerX;
        const dy = this.y - playerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > 2000;
    }

    hasReachedTarget() {
        if (!this.target) return false;
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.size + this.target.size;
    }
}

// 敌人类
class Enemy {
    constructor(x, y, wave) {
        this.x = x;
        this.y = y;
        this.type = 'normal';
        this.size = CONFIG.enemy.size;
        this.speed = CONFIG.enemy.speed; // 移除速度随波次增加
        this.health = CONFIG.enemy.health + (wave - 1) * 5;
        this.maxHealth = this.health;
        this.lastShootTime = Date.now() + Math.random() * 1000;
        this.shootCooldown = CONFIG.enemy.shootCooldown - (wave - 1) * 100;
        if (this.shootCooldown < 1000) this.shootCooldown = 1000;
        this.damage = CONFIG.enemyBullet.damage + (wave - 1) * 2;
        
        // 受击特效
        this.hitFlash = 0;
        this.hitFlashDuration = 0.2;
    }

    update(playerX, playerY) {
        // 追踪玩家
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 150) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }

        this.angle = Math.atan2(dy, dx);
        
        // 更新受击特效
        if (this.hitFlash > 0) {
            this.hitFlash -= 0.05;
            if (this.hitFlash < 0) this.hitFlash = 0;
        }
    }

    draw(ctx) {
        // 绘制方形敌人
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 4);

        // 如果有受击特效，绘制白色闪烁
        if (this.hitFlash > 0) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ffffff';
            const flashIntensity = this.hitFlash / this.hitFlashDuration;
            const gradient = ctx.createLinearGradient(-this.size, -this.size, this.size, this.size);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${flashIntensity})`);
            gradient.addColorStop(0.5, `rgba(255, 82, 82, ${1 - flashIntensity * 0.5})`);
            gradient.addColorStop(1, `rgba(211, 47, 47, ${1 - flashIntensity * 0.5})`);
            ctx.fillStyle = gradient;
        } else {
            const gradient = ctx.createLinearGradient(-this.size, -this.size, this.size, this.size);
            gradient.addColorStop(0, '#ff5252');
            gradient.addColorStop(1, '#d32f2f');
            ctx.fillStyle = gradient;
        }
        
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);

        ctx.restore();

        // 绘制生命值条
        const barWidth = 40;
        const barHeight = 5;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    takeDamage(damage) {
        this.health -= damage;
        this.hitFlash = this.hitFlashDuration; // 触发受击特效
        return this.health <= 0;
    }

    canShoot() {
        const now = Date.now();
        if (now - this.lastShootTime >= this.shootCooldown) {
            this.lastShootTime = now;
            return true;
        }
        return false;
    }
}

// 追身怪类
class Chaser {
    constructor(x, y, wave, isBossChaser = false) {
        this.x = x;
        this.y = y;
        this.type = 'chaser';
        this.size = CONFIG.chaser.size;
        this.speed = CONFIG.chaser.speed; // 移除速度随波次增加
        this.health = CONFIG.chaser.health + (wave - 1) * 3;
        this.maxHealth = this.health;
        this.damage = CONFIG.chaser.damage + (wave - 1) * 2;
        this.angle = 0;
        
        // 初始速度（用于BOSS发射时的初始方向）
        this.vx = 0;
        this.vy = 0;
        
        // BOSS追身怪标记
        this.isBossChaser = isBossChaser;
        
        // 受击特效
        this.hitFlash = 0;
        this.hitFlashDuration = 0.2;
    }

    update(playerX, playerY) {
        // 如果有初始速度，先应用初始速度，然后逐渐转向玩家
        if (this.vx !== 0 || this.vy !== 0) {
            // 应用初始速度
            this.x += this.vx;
            this.y += this.vy;
            
            // 逐渐减弱初始速度，转向追踪玩家
            this.vx *= 0.95;
            this.vy *= 0.95;
            
            // 当初始速度很小时，清零
            if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) {
                this.vx = 0;
                this.vy = 0;
            }
        }
        
        // 直接追踪玩家
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
        this.angle = Math.atan2(dy, dx);
        
        // 更新受击特效
        if (this.hitFlash > 0) {
            this.hitFlash -= 0.05;
            if (this.hitFlash < 0) this.hitFlash = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 绘制胶囊形状
        const width = this.size * 2;
        const height = this.size;
        
        if (this.hitFlash > 0) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ffffff';
            const flashIntensity = this.hitFlash / this.hitFlashDuration;
            const gradient = ctx.createLinearGradient(-width/2, 0, width/2, 0);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${flashIntensity})`);
            if (this.isBossChaser) {
                gradient.addColorStop(0.5, `rgba(255, 50, 50, ${1 - flashIntensity * 0.5})`);
                gradient.addColorStop(1, `rgba(200, 0, 0, ${1 - flashIntensity * 0.5})`);
            } else {
                gradient.addColorStop(0.5, `rgba(139, 90, 43, ${1 - flashIntensity * 0.5})`);
                gradient.addColorStop(1, `rgba(101, 67, 33, ${1 - flashIntensity * 0.5})`);
            }
            ctx.fillStyle = gradient;
        } else {
            const gradient = ctx.createLinearGradient(-width/2, 0, width/2, 0);
            if (this.isBossChaser) {
                gradient.addColorStop(0, '#ff3232');
                gradient.addColorStop(1, '#c80000');
            } else {
                gradient.addColorStop(0, '#8b5a2b');
                gradient.addColorStop(1, '#654321');
            }
            ctx.fillStyle = gradient;
        }

        // 绘制胶囊
        ctx.beginPath();
        ctx.arc(-width/2 + height/2, 0, height/2, Math.PI/2, Math.PI*3/2);
        ctx.lineTo(width/2 - height/2, -height/2);
        ctx.arc(width/2 - height/2, 0, height/2, -Math.PI/2, Math.PI/2);
        ctx.lineTo(-width/2 + height/2, height/2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        // 绘制生命值条
        const barWidth = 30;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 8;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = this.isBossChaser ? '#ff3232' : '#8b5a2b';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    takeDamage(damage) {
        // 进入动画期间不受伤害
        if (this.isEntering) {
            return false;
        }
        this.health -= damage;
        this.hitFlash = this.hitFlashDuration;
        return this.health <= 0;
    }
}

// 宝箱类
class TreasureChest {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = CONFIG.treasure.size;
        this.locked = true;
        this.opened = false;
        this.rotation = 0;
        this.floatOffset = 0;
        this.floatSpeed = 0.03;
        this.glowIntensity = 0;
        this.glowDirection = 1;
    }

    unlock() {
        this.locked = false;
    }

    open() {
        this.opened = true;
    }

    update() {
        this.floatOffset += this.floatSpeed;
        this.rotation += 0.02;
        
        // 光晕效果
        this.glowIntensity += 0.02 * this.glowDirection;
        if (this.glowIntensity > 1) {
            this.glowIntensity = 1;
            this.glowDirection = -1;
        } else if (this.glowIntensity < 0) {
            this.glowIntensity = 0;
            this.glowDirection = 1;
        }
    }

    draw(ctx) {
        if (this.opened) return;

        const y = this.y + Math.sin(this.floatOffset) * 8;

        ctx.save();
        
        // 绘制光晕
        const glowGradient = ctx.createRadialGradient(this.x, y, 0, this.x, y, this.size * 3);
        glowGradient.addColorStop(0, `rgba(255, 215, 0, ${0.3 * this.glowIntensity})`);
        glowGradient.addColorStop(0.5, `rgba(255, 215, 0, ${0.15 * this.glowIntensity})`);
        glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, y, this.size * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(this.x, y);
        ctx.rotate(this.rotation);

        // 绘制宝箱主体
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffd700';

        // 宝箱底部
        const gradient = ctx.createLinearGradient(-this.size, -this.size, this.size, this.size);
        gradient.addColorStop(0, '#ffd700');
        gradient.addColorStop(0.5, '#ffed4e');
        gradient.addColorStop(1, '#ffa500');
        ctx.fillStyle = gradient;

        ctx.fillRect(-this.size, -this.size/2, this.size * 2, this.size);

        // 宝箱盖子
        ctx.fillStyle = this.locked ? '#cd7f32' : '#ffd700';
        ctx.fillRect(-this.size, -this.size, this.size * 2, this.size/2);

        // 锁
        if (this.locked) {
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.fillRect(-this.size * 0.1, -this.size * 0.1, this.size * 0.2, this.size * 0.3);
        }

        // 边框
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size, -this.size, this.size * 2, this.size * 1.5);

        ctx.restore();
    }
}

// 守卫敌人类（不规则多边形）
class Guardian {
    constructor(x, y, wave, treasureX, treasureY) {
        this.x = x;
        this.y = y;
        this.treasureX = treasureX;
        this.treasureY = treasureY;
        this.type = 'guardian';
        this.size = CONFIG.guardian.size;
        this.speed = CONFIG.guardian.speed;
        this.health = CONFIG.guardian.health + (wave - 1) * 20;
        this.maxHealth = this.health;
        this.lastShootTime = Date.now() + Math.random() * 1000;
        this.shootCooldown = CONFIG.guardian.shootCooldown;
        this.damage = CONFIG.guardian.damage + (wave - 1) * 3;
        this.angle = 0;
        this.rotation = 0;
        this.aggroRange = CONFIG.guardian.aggroRange;
        this.guardRange = CONFIG.treasure.guardRange;
        this.isAggro = false;
        
        // 生成随机不规则多边形
        this.vertices = [];
        const vertexCount = 6 + Math.floor(Math.random() * 4); // 6-9个顶点
        for (let i = 0; i < vertexCount; i++) {
            const angle = (Math.PI * 2 * i) / vertexCount;
            const radius = this.size * (0.7 + Math.random() * 0.6); // 随机半径
            this.vertices.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        // 受击特效
        this.hitFlash = 0;
        this.hitFlashDuration = 0.2;
    }

    update(playerX, playerY) {
        // 计算与玩家的距离
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distToPlayer = Math.sqrt(dx * dx + dy * dy);

        // 计算与宝箱的距离
        const dtx = this.treasureX - this.x;
        const dty = this.treasureY - this.y;
        const distToTreasure = Math.sqrt(dtx * dtx + dty * dty);

        // 判断是否进入仇恨状态
        if (distToPlayer < this.aggroRange) {
            this.isAggro = true;
        } else if (distToPlayer > this.aggroRange * 1.5) {
            this.isAggro = false;
        }

        // 移动逻辑
        if (this.isAggro && distToTreasure < this.guardRange) {
            // 在守卫范围内追击玩家
            this.x += (dx / distToPlayer) * this.speed;
            this.y += (dy / distToPlayer) * this.speed;
            this.angle = Math.atan2(dy, dx);
        } else if (distToTreasure > this.guardRange * 0.8) {
            // 返回宝箱附近
            this.x += (dtx / distToTreasure) * this.speed;
            this.y += (dty / distToTreasure) * this.speed;
            this.angle = Math.atan2(dty, dtx);
        } else {
            // 在宝箱附近游荡
            const wanderAngle = Date.now() * 0.001 + this.x * 0.01;
            const wanderX = Math.cos(wanderAngle) * 0.5;
            const wanderY = Math.sin(wanderAngle) * 0.5;
            this.x += wanderX;
            this.y += wanderY;
        }

        this.rotation += 0.015;
        
        // 更新受击特效
        if (this.hitFlash > 0) {
            this.hitFlash -= 0.05;
            if (this.hitFlash < 0) this.hitFlash = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // 绘制不规则多边形
        if (this.hitFlash > 0) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ffffff';
            const flashIntensity = this.hitFlash / this.hitFlashDuration;
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${flashIntensity})`);
            gradient.addColorStop(0.5, `rgba(255, 69, 0, ${1 - flashIntensity * 0.5})`);
            gradient.addColorStop(1, `rgba(139, 0, 0, ${1 - flashIntensity * 0.5})`);
            ctx.fillStyle = gradient;
        } else {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            gradient.addColorStop(0, '#ff4500');
            gradient.addColorStop(0.5, '#dc143c');
            gradient.addColorStop(1, '#8b0000');
            ctx.fillStyle = gradient;
        }

        ctx.beginPath();
        this.vertices.forEach((vertex, index) => {
            if (index === 0) {
                ctx.moveTo(vertex.x, vertex.y);
            } else {
                ctx.lineTo(vertex.x, vertex.y);
            }
        });
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();

        // 绘制生命值条
        const barWidth = 60;
        const barHeight = 6;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 15;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#ff4500';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    takeDamage(damage) {
        this.health -= damage;
        this.hitFlash = this.hitFlashDuration;
        this.isAggro = true; // 受到攻击后进入仇恨状态
        return this.health <= 0;
    }

    canShoot() {
        if (!this.isAggro) return false;
        const now = Date.now();
        if (now - this.lastShootTime >= this.shootCooldown) {
            this.lastShootTime = now;
            return true;
        }
        return false;
    }
}

// 泰坦类
class Titan {
    constructor(x, y, wave) {
        this.x = x;
        this.y = y;
        this.type = 'titan';
        this.size = CONFIG.titan.size;
        this.speed = CONFIG.titan.speed; // 移除速度随波次增加
        this.health = CONFIG.titan.health + (wave - 1) * 15;
        this.maxHealth = this.health;
        this.lastShootTime = Date.now() + Math.random() * 1000;
        this.shootCooldown = CONFIG.titan.shootCooldown;
        this.damage = CONFIG.enemyBullet.damage * 1.5 + (wave - 1) * 3;
        this.angle = 0;
        this.rotation = 0;
        
        // 受击特效
        this.hitFlash = 0;
        this.hitFlashDuration = 0.2;
    }

    update(playerX, playerY) {
        // 缓慢追踪玩家
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 200) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }

        this.angle = Math.atan2(dy, dx);
        this.rotation += 0.01;
        
        // 更新受击特效
        if (this.hitFlash > 0) {
            this.hitFlash -= 0.05;
            if (this.hitFlash < 0) this.hitFlash = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // 绘制八边形
        const sides = 8;
        
        if (this.hitFlash > 0) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ffffff';
            const flashIntensity = this.hitFlash / this.hitFlashDuration;
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${flashIntensity})`);
            gradient.addColorStop(0.5, `rgba(138, 43, 226, ${1 - flashIntensity * 0.5})`);
            gradient.addColorStop(1, `rgba(75, 0, 130, ${1 - flashIntensity * 0.5})`);
            ctx.fillStyle = gradient;
        } else {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            gradient.addColorStop(0, '#8a2be2');
            gradient.addColorStop(0.5, '#6a1bb2');
            gradient.addColorStop(1, '#4b0082');
            ctx.fillStyle = gradient;
        }

        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 * i) / sides;
            const x = Math.cos(angle) * this.size;
            const y = Math.sin(angle) * this.size;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();

        // 绘制生命值条
        const barWidth = 60;
        const barHeight = 6;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 15;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#8a2be2';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    takeDamage(damage) {
        // 进入动画期间不受伤害
        if (this.isEntering) {
            return false;
        }
        this.health -= damage;
        this.hitFlash = this.hitFlashDuration;
        return this.health <= 0;
    }

    canShoot() {
        const now = Date.now();
        if (now - this.lastShootTime >= this.shootCooldown) {
            this.lastShootTime = now;
            return true;
        }
        return false;
    }
}

// BOSS冲击波类
class BossShockwave {
    constructor(x, y, maxRadius, expandSpeed, damage, slowEffect, slowDuration) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = maxRadius;
        this.expandSpeed = expandSpeed;
        this.damage = damage;
        this.slowEffect = slowEffect;
        this.slowDuration = slowDuration;
        this.hitEntities = new Set(); // 记录已经击中的实体
    }

    update() {
        this.radius += this.expandSpeed;
    }

    draw(ctx) {
        if (this.radius >= this.maxRadius) return;

        ctx.save();
        
        // 计算透明度
        const alpha = 1 - (this.radius / this.maxRadius);
        
        // 绘制外层冲击波
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 20, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff8c00';
        ctx.lineWidth = 30;
        ctx.stroke();
        
        // 绘制中层冲击波
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 20;
        ctx.stroke();
        
        // 绘制内层冲击波
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 10;
        ctx.stroke();

        ctx.restore();
    }

    isDead() {
        return this.radius >= this.maxRadius;
    }

    checkCollision(entity, entitySize) {
        // 检查实体是否已经被击中过
        if (this.hitEntities.has(entity)) return false;
        
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 检查实体是否在冲击波的边缘范围内
        if (Math.abs(distance - this.radius) < 30 + entitySize) {
            this.hitEntities.add(entity);
            return true;
        }
        
        return false;
    }
}

// BOSS激光类
class BossLaser {
    constructor(x, y, targetX, targetY, damage) {
        this.bossX = x; // 保存boss位置
        this.bossY = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.width = 15; // 激光宽度
        this.life = 1; // 持续1秒
        this.maxLife = 1;
        this.fadeInTime = 0.1; // 淡入时间
        this.fadeOutTime = 0.1; // 淡出时间
        this.age = 0;
        
        // 计算激光方向（单位向量）
        const dx = targetX - x;
        const dy = targetY - y;
        const length = Math.sqrt(dx * dx + dy * dy);
        this.dirX = dx / length;
        this.dirY = dy / length;
        this.angle = Math.atan2(dy, dx);
    }
    
    // 更新boss位置（让激光跟随boss）
    updateBossPosition(bossX, bossY) {
        this.bossX = bossX;
        this.bossY = bossY;
    }

    update(deltaTime = 1/60) {
        this.age += deltaTime;
        this.life -= deltaTime;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        
        // 计算透明度（淡入淡出效果）
        let alpha = 1;
        if (this.age < this.fadeInTime) {
            alpha = this.age / this.fadeInTime;
        } else if (this.life < this.fadeOutTime) {
            alpha = this.life / this.fadeOutTime;
        }

        // 激光长度设为一个很大的值，确保延伸到屏幕外
        const laserLength = 5000;

        ctx.translate(this.bossX, this.bossY);
        ctx.rotate(this.angle);

        // 绘制激光外层发光
        ctx.globalAlpha = alpha * 0.3;
        const outerGradient = ctx.createLinearGradient(0, -this.width * 2, 0, this.width * 2);
        outerGradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
        outerGradient.addColorStop(0.5, 'rgba(255, 0, 0, 1)');
        outerGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = outerGradient;
        ctx.fillRect(0, -this.width * 2, laserLength, this.width * 4);

        // 绘制激光主体
        ctx.globalAlpha = alpha * 0.8;
        const mainGradient = ctx.createLinearGradient(0, -this.width, 0, this.width);
        mainGradient.addColorStop(0, 'rgba(255, 100, 100, 0)');
        mainGradient.addColorStop(0.5, 'rgba(255, 0, 0, 1)');
        mainGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
        ctx.fillStyle = mainGradient;
        ctx.fillRect(0, -this.width, laserLength, this.width * 2);

        // 绘制激光核心
        ctx.globalAlpha = alpha;
        const coreGradient = ctx.createLinearGradient(0, -this.width * 0.3, 0, this.width * 0.3);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        coreGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = coreGradient;
        ctx.fillRect(0, -this.width * 0.3, laserLength, this.width * 0.6);

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }

    checkCollision(entity, entitySize) {
        // 计算点到射线的距离（从boss位置出发的无限射线）
        const dx = entity.x - this.bossX;
        const dy = entity.y - this.bossY;
        
        // 计算点在射线方向上的投影
        const projection = dx * this.dirX + dy * this.dirY;
        
        // 如果投影为负，说明点在射线起点后方
        if (projection < 0) return false;
        
        // 计算点到射线的垂直距离
        const projX = this.bossX + this.dirX * projection;
        const projY = this.bossY + this.dirY * projection;
        
        const dist = Math.sqrt((entity.x - projX) ** 2 + (entity.y - projY) ** 2);
        return dist < this.width + entitySize;
    }
}

// BOSS战斗区域类（小行星带边框）
class BossArena {
    constructor(centerX, centerY, width, height) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.width = width;
        this.height = height;
        this.asteroids = [];
        
        // 动画状态
        this.formationProgress = 0; // 0-1，形成进度
        this.isForming = true; // 是否正在形成
        this.isDissipating = false; // 是否正在消散
        this.dissipationProgress = 0; // 0-1，消散进度
        
        // 生成小行星带边框
        this.generateAsteroids();
    }
    
    generateAsteroids() {
        const asteroidSize = 30;
        const spacing = 40;
        
        // 上边
        for (let x = -this.width / 2; x <= this.width / 2; x += spacing) {
            const targetX = this.centerX + x;
            const targetY = this.centerY - this.height / 2;
            const angle = Math.atan2(targetY - this.centerY, targetX - this.centerX);
            this.asteroids.push({
                targetX: targetX,
                targetY: targetY,
                x: this.centerX + Math.cos(angle) * 50, // 从中心附近开始
                y: this.centerY + Math.sin(angle) * 50,
                size: asteroidSize + Math.random() * 10,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02
            });
        }
        
        // 下边
        for (let x = -this.width / 2; x <= this.width / 2; x += spacing) {
            const targetX = this.centerX + x;
            const targetY = this.centerY + this.height / 2;
            const angle = Math.atan2(targetY - this.centerY, targetX - this.centerX);
            this.asteroids.push({
                targetX: targetX,
                targetY: targetY,
                x: this.centerX + Math.cos(angle) * 50,
                y: this.centerY + Math.sin(angle) * 50,
                size: asteroidSize + Math.random() * 10,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02
            });
        }
        
        // 左边
        for (let y = -this.height / 2; y <= this.height / 2; y += spacing) {
            const targetX = this.centerX - this.width / 2;
            const targetY = this.centerY + y;
            const angle = Math.atan2(targetY - this.centerY, targetX - this.centerX);
            this.asteroids.push({
                targetX: targetX,
                targetY: targetY,
                x: this.centerX + Math.cos(angle) * 50,
                y: this.centerY + Math.sin(angle) * 50,
                size: asteroidSize + Math.random() * 10,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02
            });
        }
        
        // 右边
        for (let y = -this.height / 2; y <= this.height / 2; y += spacing) {
            const targetX = this.centerX + this.width / 2;
            const targetY = this.centerY + y;
            const angle = Math.atan2(targetY - this.centerY, targetX - this.centerX);
            this.asteroids.push({
                targetX: targetX,
                targetY: targetY,
                x: this.centerX + Math.cos(angle) * 50,
                y: this.centerY + Math.sin(angle) * 50,
                size: asteroidSize + Math.random() * 10,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02
            });
        }
    }
    
    update() {
        // 更新形成动画
        if (this.isForming && this.formationProgress < 1) {
            this.formationProgress += 0.01; // 约1.67秒完成形成
            if (this.formationProgress >= 1) {
                this.formationProgress = 1;
                this.isForming = false;
            }
        }
        
        // 更新消散动画
        if (this.isDissipating && this.dissipationProgress < 1) {
            this.dissipationProgress += 0.015; // 约1.1秒完成消散
            if (this.dissipationProgress >= 1) {
                this.dissipationProgress = 1;
            }
        }
        
        // 更新小行星位置和旋转
        this.asteroids.forEach(asteroid => {
            asteroid.rotation += asteroid.rotationSpeed;
            
            // 根据动画状态更新位置
            if (this.isForming) {
                // 形成动画：从中心向边缘移动
                const progress = this.easeOutCubic(this.formationProgress);
                asteroid.x = asteroid.x + (asteroid.targetX - asteroid.x) * progress * 0.1;
                asteroid.y = asteroid.y + (asteroid.targetY - asteroid.y) * progress * 0.1;
            } else if (this.isDissipating) {
                // 消散动画：从边缘向外移动
                const progress = this.easeInCubic(this.dissipationProgress);
                const angle = Math.atan2(asteroid.targetY - this.centerY, asteroid.targetX - this.centerX);
                const startX = asteroid.targetX;
                const startY = asteroid.targetY;
                // 向外扩散，距离增加到原来的3倍
                const endX = this.centerX + Math.cos(angle) * (Math.sqrt(Math.pow(asteroid.targetX - this.centerX, 2) + Math.pow(asteroid.targetY - this.centerY, 2)) * 3);
                const endY = this.centerY + Math.sin(angle) * (Math.sqrt(Math.pow(asteroid.targetX - this.centerX, 2) + Math.pow(asteroid.targetY - this.centerY, 2)) * 3);
                asteroid.x = startX + (endX - startX) * progress;
                asteroid.y = startY + (endY - startY) * progress;
            } else {
                // 正常状态：保持在目标位置
                asteroid.x = asteroid.targetX;
                asteroid.y = asteroid.targetY;
            }
        });
    }
    
    // 缓动函数
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    easeInCubic(t) {
        return t * t * t;
    }
    
    // 开始消散
    startDissipation() {
        this.isDissipating = true;
        this.dissipationProgress = 0;
    }
    
    // 检查是否完成消散
    isFullyDissipated() {
        return this.isDissipating && this.dissipationProgress >= 1;
    }
    
    draw(ctx) {
        this.asteroids.forEach(asteroid => {
            ctx.save();
            
            // 计算透明度
            let alpha = 1;
            if (this.isForming) {
                alpha = this.formationProgress;
            } else if (this.isDissipating) {
                alpha = 1 - this.dissipationProgress;
            }
            
            ctx.globalAlpha = alpha;
            ctx.translate(asteroid.x, asteroid.y);
            ctx.rotate(asteroid.rotation);
            
            // 绘制不规则小行星
            ctx.beginPath();
            const points = 8;
            for (let i = 0; i < points; i++) {
                const angle = (Math.PI * 2 * i) / points;
                const radius = asteroid.size * (0.7 + Math.random() * 0.3);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, asteroid.size);
            gradient.addColorStop(0, '#8b7355');
            gradient.addColorStop(0.5, '#6b5345');
            gradient.addColorStop(1, '#4b3325');
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.strokeStyle = '#3b2315';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
        });
    }
    
    constrainPlayer(player) {
        const halfWidth = this.width / 2 - player.size;
        const halfHeight = this.height / 2 - player.size;
        
        if (player.x < this.centerX - halfWidth) {
            player.x = this.centerX - halfWidth;
            player.vx = 0;
        }
        if (player.x > this.centerX + halfWidth) {
            player.x = this.centerX + halfWidth;
            player.vx = 0;
        }
        if (player.y < this.centerY - halfHeight) {
            player.y = this.centerY - halfHeight;
            player.vy = 0;
        }
        if (player.y > this.centerY + halfHeight) {
            player.y = this.centerY + halfHeight;
            player.vy = 0;
        }
    }
}

// BOSS胜利传送门类
class BossVictoryPortals {
    constructor(centerX, centerY) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.leftPortal = {
            x: centerX - 200,
            y: centerY,
            size: 60,
            rotation: 0,
            label: '继续挑战'
        };
        this.rightPortal = {
            x: centerX + 200,
            y: centerY,
            size: 60,
            rotation: 0,
            label: '回到菜单'
        };
    }
    
    update() {
        this.leftPortal.rotation += 0.02;
        this.rightPortal.rotation += 0.02;
    }
    
    draw(ctx) {
        this.drawPortal(ctx, this.leftPortal);
        this.drawPortal(ctx, this.rightPortal);
    }
    
    drawPortal(ctx, portal) {
        ctx.save();
        ctx.translate(portal.x, portal.y);
        
        // 绘制黑色核心
        ctx.beginPath();
        ctx.arc(0, 0, portal.size, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, portal.size);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.7, '#1a0033');
        gradient.addColorStop(1, '#8A2BE2');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // 绘制旋转的丝带状环绕物
        ctx.rotate(portal.rotation);
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 * i) / 3;
            ctx.save();
            ctx.rotate(angle);
            
            ctx.beginPath();
            ctx.ellipse(0, 0, portal.size * 1.3, portal.size * 0.3, 0, 0, Math.PI * 2);
            ctx.strokeStyle = '#8A2BE2';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.restore();
        }
        
        ctx.restore();
        
        // 绘制标签
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(portal.label, portal.x, portal.y + portal.size + 30);
    }
    
    checkPlayerCollision(player) {
        const leftDist = Math.sqrt(
            Math.pow(player.x - this.leftPortal.x, 2) + 
            Math.pow(player.y - this.leftPortal.y, 2)
        );
        const rightDist = Math.sqrt(
            Math.pow(player.x - this.rightPortal.x, 2) + 
            Math.pow(player.y - this.rightPortal.y, 2)
        );
        
        if (leftDist < this.leftPortal.size + player.size) {
            return 'continue';
        }
        if (rightDist < this.rightPortal.size + player.size) {
            return 'menu';
        }
        return null;
    }
}

// BOSS类
class Boss {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.type = 'boss';
        this.size = 100; // 泰坦的两倍
        this.speed = 0;
        this.maxSpeed = 10.0;
        this.acceleration = 0.1;
        this.health = 10000;
        this.maxHealth = 10000;
        this.rotation = 0;
        
        // 进场动画
        this.isEntering = true;
        this.enterDuration = 5; // 5秒进场
        this.enterProgress = 0;
        this.initialY = y - 800; // 从屏幕上方进入
        this.finalY = y;
        this.shakeIntensity = 0;
        
        // 摇摆效果
        this.swayTime = 0;
        this.swayAmplitude = 10;
        
        // 攻击模式
        this.attackMode = 0; // 0: 发射追身怪, 1: 冲击波, 2: 激光
        this.attackCooldown = 0;
        this.attackPattern = [0, 0, 1, 0, 2, 0, 0, 1, 0, 2]; // 攻击模式循环
        this.attackIndex = 0;
        
        // 模式1: 发射追身怪
        this.chaserWaveCount = 0;
        this.chaserWaveCooldown = 2550; // 2.55秒间隔 (3000 * 0.85)
        this.lastChaserWaveTime = 0;
        this.chasersFiring = false;
        this.chaserFireIndex = 0;
        this.chaserFireDelay = 128; // 每个追身怪发射间隔 (150 * 0.85)
        this.lastChaserFireTime = 0;
        
        // 模式2: 冲击波
        this.isChargingShockwave = false;
        this.shockwaveChargeTime = 0;
        this.shockwaveChargeDuration = 1700; // 1.7秒蓄力 (2000 * 0.85)
        this.shockwaveFired = false;
        
        // 模式3: 激光
        this.isLocking = false;
        this.lockStartTime = 0;
        this.lockDuration = 2550; // 2.55秒锁定 (3000 * 0.85)
        this.lockTargetX = 0;
        this.lockTargetY = 0;
        this.laserFired = false;
        this.laserDelay = 500; // 锁定后0.5秒发射
        this.lockHideTime = 0;
        
        // 受击特效
        this.hitFlash = 0;
        this.hitFlashDuration = 0.2;
    }

    update(playerX, playerY, canvasWidth, canvasHeight, cameraX, cameraY, arenaCenter = null) {
        const deltaTime = 1/60;
        
        // 进场动画
        if (this.isEntering) {
            this.enterProgress += deltaTime / this.enterDuration;
            if (this.enterProgress >= 1) {
                this.enterProgress = 1;
                this.isEntering = false;
                this.attackCooldown = 850; // 进场后0.85秒开始攻击 (1000 * 0.85)
            }
            
            // 缓缓下降
            const easeProgress = this.easeInOutCubic(this.enterProgress);
            this.y = this.initialY + (this.finalY - this.initialY) * easeProgress;
            
            // 屏幕震动
            this.shakeIntensity = Math.sin(this.enterProgress * Math.PI) * 15;
            
            this.rotation += 0.02;
            return;
        }
        
        // 如果有战斗区域中心，固定在屏幕上半部居中
        let centerX, centerY;
        if (arenaCenter) {
            centerX = arenaCenter.x;
            centerY = arenaCenter.y - canvasHeight / 4;
        } else {
            // 否则跟随屏幕上半部分居中
            centerX = cameraX;
            centerY = cameraY - canvasHeight / 4;
        }
        
        // 摇摆效果
        this.swayTime += deltaTime;
        const swayX = Math.sin(this.swayTime * 2) * this.swayAmplitude;
        const swayY = Math.cos(this.swayTime * 1.5) * this.swayAmplitude * 0.5;
        
        this.targetX = centerX + swayX;
        this.targetY = centerY + swayY;
        
        // 平滑移动到目标位置（除非在冲撞模式）
        if (!this.isCharging) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            this.x += dx * 0.05;
            this.y += dy * 0.05;
        }
        
        this.rotation += 0.01;
        
        // 更新受击特效
        if (this.hitFlash > 0) {
            this.hitFlash -= 0.05;
            if (this.hitFlash < 0) this.hitFlash = 0;
        }
        
        // 攻击逻辑
        if (this.attackCooldown > 0) {
            this.attackCooldown -= 16.67; // 约1帧
            return;
        }
        
        const currentMode = this.attackPattern[this.attackIndex];
        
        // 模式1: 发射追身怪
        if (currentMode === 0) {
            if (!this.chasersFiring) {
                this.chasersFiring = true;
                this.chaserFireIndex = 0;
                this.lastChaserFireTime = Date.now();
            }
        }
        
        // 模式2: 冲击波
        if (currentMode === 1 && !this.isChargingShockwave && !this.shockwaveFired) {
            this.isChargingShockwave = true;
            this.shockwaveChargeTime = Date.now();
        }
        
        // 模式3: 激光
        if (currentMode === 2 && !this.isLocking && !this.laserFired) {
            this.isLocking = true;
            this.lockStartTime = Date.now();
            // 不在这里设置锁定位置，而是在绘制时实时更新
        }
        
        // 如果正在锁定，实时更新锁定位置
        if (this.isLocking && !this.laserFired) {
            this.lockTargetX = playerX;
            this.lockTargetY = playerY;
        }
    }

    updateShockwave() {
        if (!this.isChargingShockwave) return null;
        
        const now = Date.now();
        const elapsed = now - this.shockwaveChargeTime;
        
        if (elapsed >= this.shockwaveChargeDuration && !this.shockwaveFired) {
            // 发射冲击波
            this.shockwaveFired = true;
            this.isChargingShockwave = false;
            this.attackIndex = (this.attackIndex + 1) % this.attackPattern.length;
            // 随机4.25-5.95秒冷却时间 (5000 * 0.85 到 7000 * 0.85)
            this.attackCooldown = 4250 + Math.random() * 1700;
            
            return {
                x: this.x,
                y: this.y,
                radius: 0,
                maxRadius: 500,
                expandSpeed: 8,
                damage: 20,
                slowEffect: 0.5, // 减速50%
                slowDuration: 3000 // 减速持续3秒
            };
        }
        
        return null;
    }

    updateLaser() {
        if (!this.isLocking) return null;
        
        const now = Date.now();
        const elapsed = now - this.lockStartTime;
        
        if (elapsed >= this.lockDuration && !this.laserFired) {
            this.lockHideTime = now;
            this.laserFired = true;
        }
        
        if (this.laserFired && now - this.lockHideTime >= this.laserDelay) {
            // 发射激光
            this.isLocking = false;
            this.laserFired = false;
            this.attackIndex = (this.attackIndex + 1) % this.attackPattern.length;
            // 随机4.25-5.95秒冷却时间 (5000 * 0.85 到 7000 * 0.85)
            this.attackCooldown = 4250 + Math.random() * 1700;
            
            return new BossLaser(this.x, this.y, this.lockTargetX, this.lockTargetY, 50);
        }
        
        return null;
    }

    shouldFireChaser() {
        if (!this.chasersFiring) return false;
        
        const now = Date.now();
        if (this.chaserFireIndex >= 8) {
            // 一轮发射完成
            this.chasersFiring = false;
            this.chaserFireIndex = 0;
            this.attackIndex = (this.attackIndex + 1) % this.attackPattern.length;
            // 随机4.25-5.95秒冷却时间 (5000 * 0.85 到 7000 * 0.85)
            this.attackCooldown = 4250 + Math.random() * 1700;
            return false;
        }
        
        if (now - this.lastChaserFireTime >= this.chaserFireDelay) {
            this.lastChaserFireTime = now;
            return true;
        }
        
        return false;
    }

    getChaserSpawnPosition() {
        const angle = (Math.PI * 2 * this.chaserFireIndex) / 8;
        this.chaserFireIndex++;
        return {
            x: this.x + Math.cos(angle) * this.size,
            y: this.y + Math.sin(angle) * this.size,
            angle: angle
        };
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // 绘制六芒星
        const outerRadius = this.size;
        const innerRadius = this.size * 0.4;
        
        if (this.hitFlash > 0) {
            ctx.shadowBlur = 40;
            ctx.shadowColor = '#ffffff';
            const flashIntensity = this.hitFlash / this.hitFlashDuration;
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${flashIntensity})`);
            gradient.addColorStop(0.5, `rgba(255, 215, 0, ${1 - flashIntensity * 0.5})`);
            gradient.addColorStop(1, `rgba(255, 140, 0, ${1 - flashIntensity * 0.5})`);
            ctx.fillStyle = gradient;
        } else {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
            gradient.addColorStop(0, '#ffd700');
            gradient.addColorStop(0.5, '#ff8c00');
            gradient.addColorStop(1, '#ff4500');
            ctx.fillStyle = gradient;
        }

        // 绘制六芒星（两个三角形叠加）
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();

        // 描边
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.stroke();

        // 中心发光核心
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.2, 0, Math.PI * 2);
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 0.2);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        coreGradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.8)');
        coreGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = coreGradient;
        ctx.fill();

        ctx.restore();

        // 绘制生命值条
        const barWidth = 120;
        const barHeight = 10;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 25;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = this.health / this.maxHealth;
        const healthGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        healthGradient.addColorStop(0, '#ff0000');
        healthGradient.addColorStop(0.5, '#ff8c00');
        healthGradient.addColorStop(1, '#ffd700');
        ctx.fillStyle = healthGradient;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // BOSS标签
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS', this.x, barY - 10);
        
        // 绘制冲击波蓄力效果
        if (this.isChargingShockwave) {
            ctx.save();
            const now = Date.now();
            const elapsed = now - this.shockwaveChargeTime;
            const progress = Math.min(1, elapsed / this.shockwaveChargeDuration);
            
            // 绘制蓄力圈
            const chargeRadius = this.size * (0.5 + progress * 0.5);
            ctx.globalAlpha = 0.3 + progress * 0.4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, chargeRadius, 0, Math.PI * 2);
            const chargeGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, chargeRadius);
            chargeGradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
            chargeGradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.6)');
            chargeGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = chargeGradient;
            ctx.fill();
            
            // 绘制能量波纹
            for (let i = 0; i < 3; i++) {
                const waveProgress = (progress + i * 0.33) % 1;
                const waveRadius = this.size * (0.5 + waveProgress * 1.5);
                ctx.globalAlpha = (1 - waveProgress) * 0.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, waveRadius, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        // 绘制锁定指示线
        if (this.isLocking && !this.laserFired) {
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            
            const now = Date.now();
            const elapsed = now - this.lockStartTime;
            const alpha = Math.min(1, elapsed / 500);
            ctx.globalAlpha = alpha * (0.5 + Math.sin(now * 0.01) * 0.5);
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.lockTargetX, this.lockTargetY);
            ctx.stroke();
            
            // 锁定目标圈
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(this.lockTargetX, this.lockTargetY, 30, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
    }

    takeDamage(damage) {
        // 进入动画期间不受伤害
        if (this.isEntering) {
            return false;
        }
        this.health -= damage;
        this.hitFlash = this.hitFlashDuration;
        return this.health <= 0;
    }

    getShakeOffset() {
        if (!this.isEntering) return { x: 0, y: 0 };
        return {
            x: (Math.random() - 0.5) * this.shakeIntensity,
            y: (Math.random() - 0.5) * this.shakeIntensity
        };
    }
}

// 粒子效果类
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.size = Math.random() * 4 + 2;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size *= 0.95;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// 爆炸效果类
class ExplosionEffect {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.maxRadius = radius;
        this.life = 1;
        this.phase = 0; // 0: 火球扩张, 1: 冲击波, 2: 消散
        
        // 火球参数
        this.fireballRadius = 0;
        this.fireballMaxRadius = radius * 0.6;
        this.fireballGrowSpeed = radius * 0.15;
        
        // 冲击波参数
        this.shockwaveRadius = 0;
        this.shockwaveThickness = 15;
        this.shockwaveSpeed = radius * 0.2;
        
        // 碎片参数
        this.debris = [];
        const debrisCount = Math.floor(radius / 5);
        for (let i = 0; i < debrisCount; i++) {
            const angle = (Math.PI * 2 * i) / debrisCount + Math.random() * 0.5;
            const speed = Math.random() * 8 + 4;
            this.debris.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                life: 1,
                decay: Math.random() * 0.02 + 0.015
            });
        }
        
        // 火花参数
        this.sparks = [];
        const sparkCount = Math.floor(radius / 3);
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 6;
            this.sparks.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 2 + 1,
                life: 1,
                decay: Math.random() * 0.03 + 0.02,
                color: Math.random() > 0.5 ? '#ffeb3b' : '#ff9800'
            });
        }
        
        // 烟雾参数
        this.smoke = [];
        const smokeCount = Math.floor(radius / 8);
        for (let i = 0; i < smokeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            this.smoke.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1, // 向上飘
                size: Math.random() * 8 + 4,
                life: 1,
                decay: Math.random() * 0.01 + 0.005,
                alpha: Math.random() * 0.5 + 0.3
            });
        }
    }
    
    update() {
        // 阶段0: 火球扩张
        if (this.phase === 0) {
            this.fireballRadius += this.fireballGrowSpeed;
            if (this.fireballRadius >= this.fireballMaxRadius) {
                this.fireballRadius = this.fireballMaxRadius;
                this.phase = 1;
            }
        }
        
        // 阶段1: 冲击波扩散
        if (this.phase === 1) {
            this.shockwaveRadius += this.shockwaveSpeed;
            if (this.shockwaveRadius >= this.maxRadius) {
                this.phase = 2;
            }
        }
        
        // 阶段2: 消散
        if (this.phase === 2) {
            this.life -= 0.05;
        }
        
        // 更新碎片
        this.debris = this.debris.filter(d => {
            d.x += d.vx;
            d.y += d.vy;
            d.vy += 0.2; // 重力
            d.vx *= 0.98; // 空气阻力
            d.vy *= 0.98;
            d.rotation += d.rotationSpeed;
            d.life -= d.decay;
            return d.life > 0;
        });
        
        // 更新火花
        this.sparks = this.sparks.filter(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.3; // 重力
            s.vx *= 0.95;
            s.vy *= 0.95;
            s.life -= s.decay;
            s.size *= 0.96;
            return s.life > 0;
        });
        
        // 更新烟雾
        this.smoke = this.smoke.filter(sm => {
            sm.x += sm.vx;
            sm.y += sm.vy;
            sm.vx *= 0.95;
            sm.vy *= 0.95;
            sm.life -= sm.decay;
            sm.size *= 1.02; // 烟雾扩散
            return sm.life > 0;
        });
    }
    
    draw(ctx) {
        ctx.save();
        
        // 绘制烟雾（最底层）
        this.smoke.forEach(sm => {
            ctx.save();
            ctx.globalAlpha = sm.life * sm.alpha * 0.4;
            ctx.beginPath();
            ctx.arc(sm.x, sm.y, sm.size, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, sm.size);
            gradient.addColorStop(0, '#555');
            gradient.addColorStop(1, '#222');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.restore();
        });
        
        // 绘制火球
        if (this.phase <= 1 && this.fireballRadius > 0) {
            ctx.save();
            ctx.globalAlpha = this.phase === 0 ? 1 : Math.max(0, 1 - (this.shockwaveRadius / this.maxRadius));
            
            // 外层火焰（红色）
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.fireballRadius, 0, Math.PI * 2);
            const outerGradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.fireballRadius
            );
            outerGradient.addColorStop(0, '#fff');
            outerGradient.addColorStop(0.3, '#ffeb3b');
            outerGradient.addColorStop(0.6, '#ff9800');
            outerGradient.addColorStop(0.85, '#ff5722');
            outerGradient.addColorStop(1, '#d32f2f');
            ctx.fillStyle = outerGradient;
            ctx.fill();
            
            // 内层高光（白色）
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.fireballRadius * 0.4, 0, Math.PI * 2);
            const innerGradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.fireballRadius * 0.4
            );
            innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            innerGradient.addColorStop(0.5, 'rgba(255, 235, 59, 0.6)');
            innerGradient.addColorStop(1, 'rgba(255, 152, 0, 0)');
            ctx.fillStyle = innerGradient;
            ctx.fill();
            
            // 发光效果
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ff9800';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.fireballRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 235, 59, 0.5)';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.restore();
        }
        
        // 绘制冲击波
        if (this.phase >= 1 && this.shockwaveRadius < this.maxRadius) {
            ctx.save();
            const shockwaveAlpha = 1 - (this.shockwaveRadius / this.maxRadius);
            ctx.globalAlpha = shockwaveAlpha * 0.8;
            
            // 外圈冲击波
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.shockwaveRadius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = this.shockwaveThickness;
            ctx.stroke();
            
            // 内圈冲击波
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.shockwaveRadius - this.shockwaveThickness / 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = this.shockwaveThickness / 2;
            ctx.stroke();
            
            // 冲击波发光
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ffd700';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.shockwaveRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
        }
        
        // 绘制火花
        this.sparks.forEach(s => {
            ctx.save();
            ctx.globalAlpha = s.life;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = s.color;
            ctx.fill();
            ctx.restore();
        });
        
        // 绘制碎片
        this.debris.forEach(d => {
            ctx.save();
            ctx.globalAlpha = d.life;
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
            ctx.restore();
        });
        
        ctx.restore();
    }
    
    isDead() {
        return this.life <= 0 && this.debris.length === 0 && this.sparks.length === 0;
    }
}

// 游戏主类
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 移动端检测
        this.isMobile = this.detectMobile();
        
        // 初始化Canvas尺寸（响应式）
        this.resizeCanvas();
        
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        // 虚拟摇杆状态
        this.leftJoystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0
        };
        
        this.rightJoystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0
        };

        this.state = new GameState();
        this.shopSystem = new ShopSystem(); // 商店系统
        this.player = null;
        this.bullets = [];
        this.missiles = []; // 导弹数组
        this.enemies = [];
        this.particles = [];
        this.explosions = []; // 爆炸效果数组
        this.experienceGems = [];
        this.healthPacks = [];
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.worldMouse = { x: 0, y: 0 };
        this.lastEnemySpawn = 0;
        this.enemiesPerWave = 5;
        
        // 关卡系统
        this.currentStage = 1;
        this.unlockedStages = this.loadUnlockedStages();

        // 宝箱系统
        this.treasureChest = null;
        this.guardians = [];
        this.nextTreasureWave = this.getRandomTreasureWave();
        this.treasurePopupTime = 0;
        this.treasureLockedPopupTime = 0;

        // BOSS系统
        this.boss = null;
        this.bossLasers = [];
        this.bossShockwaves = [];
        this.bossSpawned = false;
        this.bossWave = 20;
        this.bossArena = null; // BOSS战斗区域
        this.bossDefeated = false; // BOSS是否被击败
        this.bossVictoryPortals = null; // BOSS击败后的传送门

        // 秘籍系统（上上下下左右左右）
        this.konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
        this.konamiIndex = 0;
        this.gmPanelUnlocked = false;

        this.camera = new Camera(0, 0);
        this.worldManager = new WorldManager();

        this.setupEventListeners();
        this.updateUI();
        this.updateShopUI();
        
        // 确保游戏结束界面初始隐藏
        document.getElementById('gameOver').classList.add('hidden');
    }

    detectMobile() {
        // 检测是否为移动设备
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
        
        return isMobileDevice || (isTouchDevice && isSmallScreen);
    }
    
    resizeCanvas() {
        // PC端：保持固定尺寸
        if (!this.isMobile) {
            this.canvas.width = 1200;
            this.canvas.height = 700;
            CONFIG.canvas.width = 1200;
            CONFIG.canvas.height = 700;
            return;
        }
        
        // 移动端：响应式适配
        const header = document.querySelector('.game-header');
        const isLandscape = window.innerWidth > window.innerHeight;
        
        let availableWidth = window.innerWidth;
        let availableHeight = window.innerHeight;
        
        if (isLandscape) {
            // 横屏时，充分利用屏幕空间
            // 根据屏幕高度动态调整header和边距
            let headerHeight = 70; // 默认header高度
            let bottomMargin = 120; // 底部虚拟摇杆区域
            
            if (window.innerHeight < 500) {
                // 极端横屏（高度<500px）
                headerHeight = 55;
                bottomMargin = 90;
            } else if (window.innerHeight < 600) {
                // 一般横屏（高度<600px）
                headerHeight = 65;
                bottomMargin = 105;
            }
            
            // 计算可用高度：总高度 - header - 底部摇杆区域 - 少量边距
            availableHeight = window.innerHeight - headerHeight - bottomMargin;
            availableWidth = window.innerWidth - 10; // 左右各留5px边距
            
            // 确保Canvas不会太小
            availableHeight = Math.max(availableHeight, 300);
            availableWidth = Math.max(availableWidth, 500);
            
            this.canvas.width = Math.floor(availableWidth);
            this.canvas.height = Math.floor(availableHeight);
        } else {
            // 竖屏时保持16:9比例
            const headerHeight = header ? header.offsetHeight + 40 : 160;
            availableWidth = window.innerWidth - 20;
            availableHeight = window.innerHeight - headerHeight - 20;
            
            const targetRatio = 16 / 9;
            const availableRatio = availableWidth / availableHeight;
            
            let canvasWidth, canvasHeight;
            
            if (availableRatio > targetRatio) {
                canvasHeight = availableHeight;
                canvasWidth = canvasHeight * targetRatio;
            } else {
                canvasWidth = availableWidth;
                canvasHeight = canvasWidth / targetRatio;
            }
            
            this.canvas.width = Math.floor(canvasWidth);
            this.canvas.height = Math.floor(canvasHeight);
        }
        
        // 更新CONFIG中的尺寸（用于游戏逻辑计算）
        CONFIG.canvas.width = this.canvas.width;
        CONFIG.canvas.height = this.canvas.height;
    }
    
    setupVirtualJoysticks() {
        if (!this.isMobile) return;
        
        // 强制横屏
        this.forceHorizontalOrientation();
        
        const leftJoystick = document.getElementById('leftJoystick');
        const rightJoystick = document.getElementById('rightJoystick');
        const leftStick = document.getElementById('leftStick');
        const rightStick = document.getElementById('rightStick');
        
        // 记录每个摇杆的触摸ID
        this.leftJoystick.touchId = null;
        this.rightJoystick.touchId = null;
        
        // 摇杆显示/隐藏定时器
        this.leftJoystickHideTimer = null;
        this.rightJoystickHideTimer = null;
        
        // 检测触摸区域并显示摇杆
        const checkTouchArea = (e) => {
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                const x = touch.clientX;
                const y = touch.clientY;
                
                // 左侧1/3区域显示左摇杆
                if (x < screenWidth / 3 && y > screenHeight / 3) {
                    leftJoystick.classList.add('visible');
                    clearTimeout(this.leftJoystickHideTimer);
                }
                
                // 右侧1/3区域显示右摇杆
                if (x > screenWidth * 2 / 3 && y > screenHeight / 3) {
                    rightJoystick.classList.add('visible');
                    clearTimeout(this.rightJoystickHideTimer);
                }
            }
        };
        
        // 全局触摸监听，用于显示摇杆
        document.addEventListener('touchstart', checkTouchArea);
        document.addEventListener('touchmove', checkTouchArea);
        
        // 左摇杆（控制移动）- 支持多点触控
        leftJoystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // 如果已经有触摸点，忽略
            if (this.leftJoystick.touchId !== null) return;
            
            const touch = e.changedTouches[0];
            this.leftJoystick.touchId = touch.identifier;
            
            const rect = leftJoystick.getBoundingClientRect();
            this.leftJoystick.active = true;
            this.leftJoystick.startX = rect.left + rect.width / 2;
            this.leftJoystick.startY = rect.top + rect.height / 2;
            leftStick.classList.add('active');
            leftJoystick.classList.add('active');
        }, { passive: false });
        
        // 右摇杆（控制攻击方向）- 支持多点触控
        rightJoystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // 如果已经有触摸点，忽略
            if (this.rightJoystick.touchId !== null) return;
            
            const touch = e.changedTouches[0];
            this.rightJoystick.touchId = touch.identifier;
            
            const rect = rightJoystick.getBoundingClientRect();
            this.rightJoystick.active = true;
            this.rightJoystick.startX = rect.left + rect.width / 2;
            this.rightJoystick.startY = rect.top + rect.height / 2;
            rightStick.classList.add('active');
            rightJoystick.classList.add('active');
        }, { passive: false });
        
        // 统一的全局触摸移动处理
        document.addEventListener('touchmove', (e) => {
            let handled = false;
            
            // 处理所有当前的触摸点
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                
                // 处理左摇杆
                if (this.leftJoystick.active && touch.identifier === this.leftJoystick.touchId) {
                    const rect = leftJoystick.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    
                    let deltaX = touch.clientX - centerX;
                    let deltaY = touch.clientY - centerY;
                    
                    // 限制摇杆移动范围
                    const maxDistance = rect.width / 2 - 30;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    
                    if (distance > maxDistance) {
                        const angle = Math.atan2(deltaY, deltaX);
                        deltaX = Math.cos(angle) * maxDistance;
                        deltaY = Math.sin(angle) * maxDistance;
                    }
                    
                    // 更新摇杆位置
                    leftStick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
                    
                    // 归一化到 -1 到 1 的范围
                    this.leftJoystick.deltaX = deltaX / maxDistance;
                    this.leftJoystick.deltaY = deltaY / maxDistance;
                    handled = true;
                }
                
                // 处理右摇杆
                if (this.rightJoystick.active && touch.identifier === this.rightJoystick.touchId) {
                    const rect = rightJoystick.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    
                    let deltaX = touch.clientX - centerX;
                    let deltaY = touch.clientY - centerY;
                    
                    // 限制摇杆移动范围
                    const maxDistance = rect.width / 2 - 30;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    
                    if (distance > maxDistance) {
                        const angle = Math.atan2(deltaY, deltaX);
                        deltaX = Math.cos(angle) * maxDistance;
                        deltaY = Math.sin(angle) * maxDistance;
                    }
                    
                    // 更新摇杆位置
                    rightStick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
                    
                    // 归一化到 -1 到 1 的范围
                    this.rightJoystick.deltaX = deltaX / maxDistance;
                    this.rightJoystick.deltaY = deltaY / maxDistance;
                    handled = true;
                }
            }
            
            // 如果处理了摇杆事件，阻止默认行为
            if (handled) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // 统一的全局触摸结束处理
        document.addEventListener('touchend', (e) => {
            // 检查所有结束的触摸点
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                
                // 检查是否是左摇杆的触摸点结束
                if (touch.identifier === this.leftJoystick.touchId) {
                    this.leftJoystick.active = false;
                    this.leftJoystick.touchId = null;
                    this.leftJoystick.deltaX = 0;
                    this.leftJoystick.deltaY = 0;
                    leftStick.style.transform = 'translate(-50%, -50%)';
                    leftStick.classList.remove('active');
                    leftJoystick.classList.remove('active');
                    
                    // 延迟隐藏摇杆
                    clearTimeout(this.leftJoystickHideTimer);
                    this.leftJoystickHideTimer = setTimeout(() => {
                        leftJoystick.classList.remove('visible');
                    }, 2000);
                }
                
                // 检查是否是右摇杆的触摸点结束
                if (touch.identifier === this.rightJoystick.touchId) {
                    this.rightJoystick.active = false;
                    this.rightJoystick.touchId = null;
                    this.rightJoystick.deltaX = 0;
                    this.rightJoystick.deltaY = 0;
                    rightStick.style.transform = 'translate(-50%, -50%)';
                    rightStick.classList.remove('active');
                    rightJoystick.classList.remove('active');
                    
                    // 延迟隐藏摇杆
                    clearTimeout(this.rightJoystickHideTimer);
                    this.rightJoystickHideTimer = setTimeout(() => {
                        rightJoystick.classList.remove('visible');
                    }, 2000);
                }
            }
        }, { passive: false });
        
        // 防止触摸事件冒泡导致页面滚动
        leftJoystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        rightJoystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
    
    forceHorizontalOrientation() {
        // 尝试锁定横屏方向
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(err => {
                console.log('无法锁定屏幕方向:', err);
            });
        }
        
        // 添加CSS提示用户旋转设备
        const style = document.createElement('style');
        style.textContent = `
            @media (orientation: portrait) and (max-width: 768px) {
                body::before {
                    content: '请将设备旋转至横屏模式以获得最佳体验';
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.9);
                    color: #fff;
                    padding: 30px;
                    border-radius: 15px;
                    font-size: 20px;
                    text-align: center;
                    z-index: 10000;
                    border: 3px solid #8A2BE2;
                    box-shadow: 0 0 30px rgba(138, 43, 226, 0.6);
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // 初始化虚拟摇杆
        this.setupVirtualJoysticks();
        
        // 窗口大小改变时重新调整Canvas尺寸
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
        
        // 屏幕方向改变时重新调整
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.resizeCanvas();
            }, 100);
        });
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            // 秘籍检测（上上下下左右左右）
            if (e.key === this.konamiCode[this.konamiIndex]) {
                this.konamiIndex++;
                if (this.konamiIndex === this.konamiCode.length) {
                    // 秘籍输入成功
                    this.gmPanelUnlocked = true;
                    this.konamiIndex = 0;
                    // 如果当前在暂停界面，立即显示GM面板
                    const gmPanel = document.querySelector('.gm-panel');
                    if (gmPanel) {
                        gmPanel.style.display = 'block';
                    }
                    // 显示提示消息
                    this.showGMUnlockedMessage();
                }
            } else if (this.konamiCode.includes(e.key)) {
                // 如果按的键在秘籍中但不是当前期望的，重置
                this.konamiIndex = (e.key === this.konamiCode[0]) ? 1 : 0;
            } else {
                // 按了其他键，重置
                this.konamiIndex = 0;
            }
            
            // ESC键暂停/继续
            if (e.key === 'Escape' && this.state.isRunning) {
                if (this.state.isPaused && document.getElementById('pauseScreen').classList.contains('hidden') === false) {
                    this.hidePauseScreen();
                } else if (!this.state.isPaused) {
                    this.showPauseScreen();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        // 窗口失去焦点时清空所有按键状态，防止按键卡住
        window.addEventListener('blur', () => {
            this.keys = {};
            // 同时重置玩家速度，防止持续移动
            if (this.player) {
                this.player.vx = 0;
                this.player.vy = 0;
            }
        });

        // 鼠标事件
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            
            // 转换为世界坐标
            const worldPos = this.camera.screenToWorld(this.mouse.x, this.mouse.y);
            this.worldMouse = worldPos;
        });

        // 按钮事件
        document.getElementById('startBtn').addEventListener('click', () => {
            this.showStageSelect();
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restart();
        });
        
        // 选关界面按钮
        document.getElementById('stageBackBtn').addEventListener('click', () => {
            document.getElementById('stageSelectScreen').classList.add('hidden');
            document.getElementById('gameStart').classList.remove('hidden');
        });
        
        // 选关卡片点击事件
        document.querySelectorAll('.stage-card').forEach(card => {
            card.addEventListener('click', () => {
                const stage = parseInt(card.getAttribute('data-stage'));
                const unlocked = card.getAttribute('data-unlocked') === 'true';
                if (unlocked) {
                    this.selectStage(stage);
                }
            });
        });
        
        // 轮播按钮
        document.getElementById('carouselPrev').addEventListener('click', () => {
            const carousel = document.getElementById('stageCarousel');
            carousel.scrollBy({ left: -310, behavior: 'smooth' });
        });
        
        document.getElementById('carouselNext').addEventListener('click', () => {
            const carousel = document.getElementById('stageCarousel');
            carousel.scrollBy({ left: 310, behavior: 'smooth' });
        });
        
        // 触摸滑动支持
        let startX = 0;
        const carousel = document.getElementById('stageCarousel');
        carousel.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        carousel.addEventListener('touchmove', (e) => {
            if (!startX) return;
            const currentX = e.touches[0].clientX;
            const diff = startX - currentX;
            if (Math.abs(diff) > 50) {
                carousel.scrollBy({ left: diff, behavior: 'smooth' });
                startX = 0;
            }
        });
        
        // 规则界面按钮
        document.getElementById('rulesBtn').addEventListener('click', () => {
            document.getElementById('gameStart').classList.add('hidden');
            document.getElementById('rulesScreen').classList.remove('hidden');
        });
        
        document.getElementById('backBtn').addEventListener('click', () => {
            document.getElementById('rulesScreen').classList.add('hidden');
            document.getElementById('gameStart').classList.remove('hidden');
        });

        // 商店按钮
        document.getElementById('shopBtn').addEventListener('click', () => {
            this.showShop();
        });
        
        document.getElementById('shopBackBtn').addEventListener('click', () => {
            this.hideShop();
        });

        // 商店升级按钮
        document.querySelectorAll('.upgrade-buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const upgradeType = e.currentTarget.getAttribute('data-upgrade');
                this.buyPermanentUpgrade(upgradeType);
            });
        });

        // 遗物卡片点击事件
        document.querySelectorAll('.relic-card[data-relic]').forEach(card => {
            card.addEventListener('click', () => {
                const relicId = card.getAttribute('data-relic');
                const relic = this.shopSystem.relics[relicId];
                
                if (!relic.purchased) {
                    // 未购买，尝试购买
                    this.buyRelic(relicId);
                } else {
                    // 已购买，切换激活状态
                    this.toggleRelic(relicId);
                }
            });
        });

        // 升级选项事件（动态绑定，在showLevelUpScreen中处理）
        
        // 暂停界面按钮
        document.getElementById('resumeBtn')?.addEventListener('click', () => {
            this.hidePauseScreen();
        });
        
        // GM指令面板事件监听器
        this.setupGMEventListeners();
    }
    
    setupGMEventListeners() {
        // 波次控制
        document.getElementById('gmSetWave')?.addEventListener('click', () => {
            const waveInput = document.getElementById('gmWaveInput');
            const targetWave = parseInt(waveInput.value);
            if (targetWave > 0 && targetWave <= 100) {
                this.gmSetWave(targetWave);
            }
        });
        
        // 怪物生成
        document.getElementById('gmSpawnEnemy')?.addEventListener('click', () => {
            const enemyType = document.getElementById('gmEnemyType').value;
            const enemyCount = parseInt(document.getElementById('gmEnemyCount').value);
            this.gmSpawnEnemies(enemyType, enemyCount);
        });
        
        // 玩家状态
        document.getElementById('gmToggleGod')?.addEventListener('click', () => {
            this.gmToggleGodMode();
        });
        
        document.getElementById('gmAddExp')?.addEventListener('click', () => {
            const expAmount = parseInt(document.getElementById('gmExpAmount').value);
            this.gmAddExperience(expAmount);
        });
        
        // 物品生成
        document.getElementById('gmSpawnTreasure')?.addEventListener('click', () => {
            this.gmSpawnTreasure();
        });
        
        document.getElementById('gmSpawnHealth')?.addEventListener('click', () => {
            const healthCount = parseInt(document.getElementById('gmHealthCount').value);
            this.gmSpawnHealthPacks(healthCount);
        });
        
        // 升级管理
        document.getElementById('gmAddUpgrade')?.addEventListener('click', () => {
            const upgradeType = document.getElementById('gmUpgradeType').value;
            this.gmAddUpgrade(upgradeType);
        });
        
        document.getElementById('gmRemoveUpgrade')?.addEventListener('click', () => {
            const upgradeType = document.getElementById('gmUpgradeType').value;
            this.gmRemoveUpgrade(upgradeType);
        });
        
        // 遗物控制
        document.getElementById('gmActivateRelic')?.addEventListener('click', () => {
            const relicType = document.getElementById('gmRelicType').value;
            this.gmActivateRelic(relicType);
        });
        
        document.getElementById('gmDeactivateRelic')?.addEventListener('click', () => {
            const relicType = document.getElementById('gmRelicType').value;
            this.gmDeactivateRelic(relicType);
        });
        
        // 属性修改
        document.getElementById('gmApplyStats')?.addEventListener('click', () => {
            const stats = {
                speed: parseFloat(document.getElementById('gmSpeedInput').value),
                damage: parseInt(document.getElementById('gmDamageInput').value),
                size: parseInt(document.getElementById('gmSizeInput').value),
                health: parseInt(document.getElementById('gmHealthInput').value)
            };
            this.gmApplyStats(stats);
        });
        
        document.getElementById('gmResetStats')?.addEventListener('click', () => {
            this.gmResetStats();
        });
    }

    showPauseScreen() {
        this.state.isPaused = true;
        const pauseScreen = document.getElementById('pauseScreen');
        pauseScreen.classList.remove('hidden');
        
        // 清空按键状态，防止暂停后按键卡住
        this.keys = {};
        if (this.player) {
            this.player.vx = 0;
            this.player.vy = 0;
        }
        
        // 控制GM面板显示
        const gmPanel = document.querySelector('.gm-panel');
        if (gmPanel) {
            gmPanel.style.display = this.gmPanelUnlocked ? 'block' : 'none';
        }
        
        // 更新玩家属性显示
        document.getElementById('pauseHealth').textContent = 
            `${Math.floor(this.player.health)} / ${Math.floor(this.player.maxHealth)}`;
        document.getElementById('pauseDamage').textContent = Math.floor(this.player.damage);
        document.getElementById('pauseSpeed').textContent = this.player.baseMaxSpeed.toFixed(1);
        document.getElementById('pauseSize').textContent = Math.floor(this.player.size);
        document.getElementById('pauseBullets').textContent = this.player.bulletCount;
        document.getElementById('pauseShields').textContent = this.player.shields.length;
        document.getElementById('pauseDrones').textContent = this.player.drones.length;
        
        // 更新升级列表 - 用图标显示
        const upgradeList = document.getElementById('pauseUpgradeList');
        if (this.state.upgrades.length === 0) {
            upgradeList.innerHTML = '<li style="color: #888;">暂无升级</li>';
        } else {
            // 升级名称到图标的映射
            const upgradeIcons = {
                '装甲增强': '🛡️',
                '火力升级': '⚔️',
                '高速引擎': '⚡',
                '多门大炮': '🔫',
                '杀伤弹丸': '💥',
                '子弹分裂': '🌟',
                '冗余装甲': '🏰',
                '敏捷装甲': '🦅',
                '反应装甲': '⭕',
                '忠诚僚机': '✈️',
                '能量力场': '🌀',
                '制导武器': '🚀'
            };
            
            // 统计每个升级的数量
            const upgradeCounts = {};
            this.state.upgrades.forEach(upgrade => {
                upgradeCounts[upgrade] = (upgradeCounts[upgrade] || 0) + 1;
            });
            
            // 生成图标列表
            upgradeList.innerHTML = Object.entries(upgradeCounts).map(([name, count]) => {
                const icon = upgradeIcons[name] || '❓';
                const icons = Array(count).fill(icon).join(' ');
                return `<li style="font-size: 32px; padding: 10px;">${icons}</li>`;
            }).join('');
        }
        
        // 更新遗物列表
        const relicList = document.getElementById('pauseRelicList');
        const activeRelics = [];
        
        // 遗物信息映射
        const relicInfo = {
            'bulletSplit': { icon: '🌟', name: '子弹分裂' },
            'gravityCapture': { icon: '🧲', name: '引力捕获' },
            'advancedRepair': { icon: '💊', name: '高级修理' }
        };
        
        // 检查哪些遗物是激活的
        Object.keys(relicInfo).forEach(relicId => {
            if (this.shopSystem.isRelicActive(relicId)) {
                activeRelics.push(relicInfo[relicId]);
            }
        });
        
        if (activeRelics.length === 0) {
            relicList.innerHTML = '<p style="color: #888;">暂无遗物</p>';
        } else {
            relicList.innerHTML = activeRelics.map(relic => `
                <div class="relic-item">
                    <div class="relic-item-icon">${relic.icon}</div>
                    <div class="relic-item-name">${relic.name}</div>
                </div>
            `).join('');
        }
    }

    hidePauseScreen() {
        this.state.isPaused = false;
        document.getElementById('pauseScreen').classList.add('hidden');
    }

    showGMUnlockedMessage() {
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.background = 'rgba(255, 107, 107, 0.95)';
        popup.style.color = '#fff';
        popup.style.padding = '20px 40px';
        popup.style.borderRadius = '15px';
        popup.style.fontSize = '24px';
        popup.style.fontWeight = 'bold';
        popup.style.zIndex = '3000';
        popup.style.boxShadow = '0 10px 50px rgba(255, 107, 107, 0.8)';
        popup.style.animation = 'fadeInOut 2s ease';
        popup.style.textShadow = '0 0 20px rgba(255, 255, 255, 0.8)';
        popup.textContent = '🎮 GM面板已解锁！ 🎮';
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            document.body.removeChild(popup);
        }, 2000);
    }

    applyUpgrade(type) {
        let upgradeName = '';
        
        switch(type) {
            case 'armor':
                // 装甲增强：血量+20%
                const healthIncrease = this.player.maxHealth * 0.2;
                this.player.maxHealth += healthIncrease;
                this.player.health += healthIncrease;
                upgradeName = '装甲增强';
                break;
            case 'damage':
                // 火力升级：攻击力+20%
                this.player.damage = Math.floor(this.player.damage * 1.2);
                upgradeName = '火力升级';
                break;
            case 'speed':
                // 高速引擎：移动速度+20%
                this.player.baseMaxSpeed *= 1.2;
                this.player.maxSpeed = this.player.baseMaxSpeed;
                upgradeName = '高速引擎';
                break;
            case 'multishot':
                // 多门大炮：子弹数+1
                this.player.bulletCount++;
                upgradeName = '多门大炮';
                break;
            case 'bulletsize':
                // 杀伤弹丸：子弹体积+10%
                this.player.bulletSize *= 1.1;
                upgradeName = '杀伤弹丸';
                break;
            case 'bulletsplit':
                // 子弹分裂：子弹命中后分裂
                this.player.bulletSplitLevel++;
                upgradeName = '子弹分裂';
                break;
            case 'heavy':
                // 冗余装甲：体积+20%，血量+50%，移速-20%
                this.player.size *= 1.2;
                const heavyHealthIncrease = this.player.maxHealth * 0.5;
                this.player.maxHealth += heavyHealthIncrease;
                this.player.health += heavyHealthIncrease;
                this.player.baseMaxSpeed *= 0.8;
                this.player.maxSpeed = this.player.baseMaxSpeed;
                upgradeName = '冗余装甲';
                break;
            case 'agile':
                // 敏捷装甲：体积-20%，移速+30%，血量-50%
                this.player.size *= 0.8;
                const healthDecrease = this.player.maxHealth * 0.5;
                this.player.maxHealth -= healthDecrease;
                this.player.health = Math.min(this.player.health, this.player.maxHealth);
                this.player.baseMaxSpeed *= 1.3;
                this.player.maxSpeed = this.player.baseMaxSpeed;
                upgradeName = '敏捷装甲';
                break;
            case 'shield':
                // 反应装甲：增加防御小球
                this.addShield();
                upgradeName = '反应装甲';
                break;
            case 'drone':
                // 忠诚僚机：增加僚机
                this.addDrone();
                upgradeName = '忠诚僚机';
                break;
            case 'energyfield':
                // 能量力场：启用或升级能量力场
                if (!this.player.energyField.enabled) {
                    this.player.energyField.enabled = true;
                    upgradeName = '能量力场';
                } else {
                    this.player.energyField.level++;
                    this.player.energyField.damage += 5; // 每级+5伤害
                    this.player.energyField.radius *= 1.5; // 每级范围+50%
                    // 最大范围限制为初始的300%
                    const maxRadius = 52 * 3;
                    if (this.player.energyField.radius > maxRadius) {
                        this.player.energyField.radius = maxRadius;
                    }
                    upgradeName = '能量力场';
                }
                break;
            case 'guidedweapon':
                // 制导武器：启用或升级制导武器
                if (!this.player.guidedWeapon.enabled) {
                    this.player.guidedWeapon.enabled = true;
                    upgradeName = '制导武器';
                } else {
                    this.player.guidedWeapon.level++;
                    // 每次升级：冷却时间缩短30%，伤害增加20%
                    this.player.guidedWeapon.cooldown = Math.floor(this.player.guidedWeapon.baseCooldown * Math.pow(0.7, this.player.guidedWeapon.level));
                    this.player.guidedWeapon.damage = Math.floor(this.player.guidedWeapon.baseDamage * Math.pow(1.2, this.player.guidedWeapon.level));
                    // 每3次升级，导弹数量+1
                    this.player.guidedWeapon.missileCount = 1 + Math.floor(this.player.guidedWeapon.level / 3);
                    upgradeName = '制导武器';
                }
                break;
        }
        
        if (upgradeName) {
            this.state.addUpgrade(upgradeName);
        }
    }

    addShield() {
        const shieldCount = this.player.shields.length;
        const angle = (Math.PI * 2 * shieldCount) / (shieldCount + 1);
        
        // 重新分布所有护盾
        this.player.shields = [];
        for (let i = 0; i <= shieldCount; i++) {
            this.player.shields.push({
                angle: (Math.PI * 2 * i) / (shieldCount + 1),
                distance: 52, // 增加30%: 40 * 1.3 = 52
                size: 8,
                rotationSpeed: 0.03 // 提高50%: 0.02 * 1.5 = 0.03
            });
        }
    }

    addDrone() {
        const droneCount = this.player.drones.length;
        const angle = (Math.PI * 2 * droneCount) / (droneCount + 1);
        
        // 添加新僚机
        this.player.drones.push({
            angle: angle,
            distance: 90, // 增加50%: 60 * 1.5 = 90
            size: 10,
            lastShootTime: 0,
            shootCooldown: 800,
            orbitSpeed: 0.01,
            targetRotation: angle, // 目标朝向
            currentRotation: angle // 当前朝向
        });
    }

    start() {
        document.getElementById('gameStart').classList.add('hidden');
        this.state.isRunning = true;
        this.player = new Player(0, 0, this.shopSystem);
        this.camera = new Camera(0, 0);
        this.worldMouse = { x: 0, y: 0 };
        this.bullets = [];
        this.missiles = [];
        this.enemies = [];
        this.particles = [];
        this.explosions = [];
        this.experienceGems = [];
        this.healthPacks = [];
        this.treasureChest = null;
        this.guardians = [];
        this.nextTreasureWave = this.getRandomTreasureWave();
        this.treasurePopupTime = 0;
        this.treasureLockedPopupTime = 0;
        this.lastEnemySpawn = Date.now();
        this.gameLoop();
    }

    restart() {
        document.getElementById('gameOver').classList.add('hidden');
        
        // 完全重置游戏状态
        this.state.reset();
        
        // 重置所有游戏对象
        this.player = null;
        this.bullets = [];
        this.missiles = [];
        this.enemies = [];
        this.particles = [];
        this.explosions = [];
        this.experienceGems = [];
        this.healthPacks = [];
        this.treasureChest = null;
        this.guardians = [];
        this.nextTreasureWave = this.getRandomTreasureWave();
        this.treasurePopupTime = 0;
        this.treasureLockedPopupTime = 0;
        this.lastEnemySpawn = 0;
        
        // 重置BOSS
        this.boss = null;
        this.bossLasers = [];
        this.bossShockwaves = [];
        this.bossSpawned = false;
        this.bossArena = null;
        this.bossDefeated = false;
        this.bossVictoryPortals = null;
        
        // 重置摄像机
        this.camera = new Camera(0, 0);
        
        // 清空按键状态
        this.keys = {};
        
        // 返回主菜单
        document.getElementById('gameStart').classList.remove('hidden');
    }

    getRandomTreasureWave() {
        return Math.floor(Math.random() * (CONFIG.treasure.maxWaveInterval - CONFIG.treasure.minWaveInterval + 1)) + CONFIG.treasure.minWaveInterval;
    }

    spawnTreasureChest() {
        // 在玩家2-3屏距离外生成宝箱
        const angle = Math.random() * Math.PI * 2;
        const distance = CONFIG.treasure.spawnDistance + Math.random() * 600;
        const x = this.player.x + Math.cos(angle) * distance;
        const y = this.player.y + Math.sin(angle) * distance;

        this.treasureChest = new TreasureChest(x, y);

        // 生成守卫
        this.guardians = [];
        for (let i = 0; i < CONFIG.treasure.guardCount; i++) {
            const guardAngle = (Math.PI * 2 * i) / CONFIG.treasure.guardCount;
            const guardDistance = 150;
            const gx = x + Math.cos(guardAngle) * guardDistance;
            const gy = y + Math.sin(guardAngle) * guardDistance;
            this.guardians.push(new Guardian(gx, gy, this.state.wave, x, y));
        }

        // 显示popup提示
        this.showTreasurePopup();
        
        // 设置下一次宝箱出现的波次
        this.nextTreasureWave = this.state.wave + this.getRandomTreasureWave();
    }

    showTreasurePopup() {
        this.treasurePopupTime = Date.now();
    }

    showTreasureLockedPopup() {
        this.treasureLockedPopupTime = Date.now();
    }
    
    showCoinReward(amount) {
        // 创建临时提示元素
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '90px';
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.background = 'rgba(0, 0, 0, 0.7)';
        popup.style.color = '#ffd700';
        popup.style.padding = '20px 40px';
        popup.style.borderRadius = '15px';
        popup.style.fontSize = '28px';
        popup.style.fontWeight = 'bold';
        popup.style.zIndex = '2000';
        popup.style.border = '3px solid #ffd700';
        popup.style.boxShadow = '0 10px 40px rgba(255, 215, 0, 0.6)';
        popup.style.animation = 'fadeInOut 2s ease';
        popup.textContent = `+${amount} 遗物币 💰`;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            document.body.removeChild(popup);
        }, 2000);
    }

    spawnBoss() {
        // 创建BOSS战斗区域（单屏幕大小）
        const arenaX = this.player.x;
        const arenaY = this.player.y;
        this.bossArena = new BossArena(arenaX, arenaY, CONFIG.canvas.width, CONFIG.canvas.height);
        
        // 固定摄像机在战斗区域中心
        this.camera.fixAt(arenaX, arenaY);
        
        // BOSS从屏幕上方进入
        const bossX = arenaX;
        const bossY = arenaY - 400;
        this.boss = new Boss(bossX, bossY);
        this.bossSpawned = true;
        this.bossDefeated = false;
        
        // 显示BOSS提示
        this.showBossPopup();
    }

    showBossPopup() {
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '30%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.background = 'rgba(255, 0, 0, 0.5)';
        popup.style.color = '#fff';
        popup.style.padding = '15px 30px';
        popup.style.borderRadius = '12px';
        popup.style.fontSize = '28px';
        popup.style.fontWeight = 'bold';
        popup.style.zIndex = '2000';
        popup.style.boxShadow = '0 10px 50px rgba(255, 0, 0, 0.8)';
        popup.style.animation = 'fadeInOut 3s ease';
        popup.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
        popup.textContent = '⚠️ BOSS出现！ ⚠️';
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            document.body.removeChild(popup);
        }, 3000);
    }

    showBossDefeatedPopup() {
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '30%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.background = 'rgba(255, 215, 0, 0.95)';
        popup.style.color = '#000';
        popup.style.padding = '15px 30px';
        popup.style.borderRadius = '15px';
        popup.style.fontSize = '28px';
        popup.style.fontWeight = 'bold';
        popup.style.zIndex = '2000';
        popup.style.boxShadow = '0 10px 50px rgba(255, 215, 0, 0.8)';
        popup.style.animation = 'fadeInOut 3s ease';
        popup.style.textShadow = '0 0 20px rgba(255, 255, 255, 0.8)';
        popup.textContent = '🎉 BOSS已击败！ 🎉';
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            document.body.removeChild(popup);
        }, 3000);
    }

    spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        const spawnDistance = 600;
        let x, y;

        switch (side) {
            case 0:
                x = this.player.x + (Math.random() - 0.5) * CONFIG.canvas.width;
                y = this.player.y - spawnDistance;
                break;
            case 1:
                x = this.player.x + spawnDistance;
                y = this.player.y + (Math.random() - 0.5) * CONFIG.canvas.height;
                break;
            case 2:
                x = this.player.x + (Math.random() - 0.5) * CONFIG.canvas.width;
                y = this.player.y + spawnDistance;
                break;
            case 3:
                x = this.player.x - spawnDistance;
                y = this.player.y + (Math.random() - 0.5) * CONFIG.canvas.height;
                break;
        }

        // 根据波次和概率决定生成的敌人类型
        const rand = Math.random();
        
        if (this.state.wave >= 4 && rand < CONFIG.enemyDistribution.titan) {
            // 泰坦（第4波开始，10%概率）
            this.enemies.push(new Titan(x, y, this.state.wave));
        } else if (rand < CONFIG.enemyDistribution.titan + CONFIG.enemyDistribution.chaser) {
            // 追身怪（30%概率）- 成群结队出现
            this.spawnChaserGroup(x, y);
        } else {
            // 普通敌人（60%概率）
            this.enemies.push(new Enemy(x, y, this.state.wave));
        }
    }

    spawnChaserGroup(centerX, centerY) {
        // 生成3-5个追身怪，从多个方向围绕而来
        const chaserCount = 3 + Math.floor(Math.random() * 3); // 3-5个
        const angleStep = (Math.PI * 2) / chaserCount;
        const spreadRadius = 100; // 追身怪之间的间距
        
        for (let i = 0; i < chaserCount; i++) {
            const angle = angleStep * i + Math.random() * 0.5; // 添加一些随机性
            const offsetX = Math.cos(angle) * spreadRadius;
            const offsetY = Math.sin(angle) * spreadRadius;
            
            this.enemies.push(new Chaser(
                centerX + offsetX,
                centerY + offsetY,
                this.state.wave
            ));
        }
    }

    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    checkCollision(obj1, obj2, size1, size2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < size1 + size2;
    }

    showLevelUpScreen() {
        this.state.isPaused = true;
        document.getElementById('levelUpScreen').classList.remove('hidden');
        document.getElementById('currentLevel').textContent = this.state.level;
        
        // 清空按键状态，防止升级界面后按键卡住
        this.keys = {};
        if (this.player) {
            this.player.vx = 0;
            this.player.vy = 0;
        }
        
        // 所有可用的升级选项，按稀有度分类
        const commonUpgrades = [
            { type: 'armor', icon: '🛡️', name: '装甲增强', desc: '血量增加 +20%', rarity: 'common' },
            { type: 'damage', icon: '⚔️', name: '火力升级', desc: '攻击力 +20%', rarity: 'common' },
            { type: 'speed', icon: '⚡', name: '高速引擎', desc: '移动速度 +20%', rarity: 'common' },
            { type: 'multishot', icon: '🔫', name: '多门大炮', desc: '子弹数量 +1', rarity: 'common' },
            { type: 'bulletsize', icon: '💥', name: '杀伤弹丸', desc: '子弹体积 +10%', rarity: 'common' },
            { type: 'energyfield', icon: '🌀', name: '能量力场', desc: '敌人进入力场受伤', rarity: 'common' }
        ];
        
        const rareUpgrades = [
            { type: 'heavy', icon: '🏰', name: '冗余装甲', desc: '体积+20% 血量+50% 移速-20%', rarity: 'rare' },
            { type: 'agile', icon: '🦅', name: '敏捷装甲', desc: '体积-20% 移速+30% 血量-50%', rarity: 'rare' },
            { type: 'shield', icon: '⭕', name: '反应装甲', desc: '增加防御小球', rarity: 'rare' },
            { type: 'guidedweapon', icon: '🚀', name: '制导武器', desc: '发射追踪导弹', rarity: 'rare' }
        ];
        
        const epicUpgrades = [
            { type: 'drone', icon: '✈️', name: '忠诚僚机', desc: '增加攻击僚机', rarity: 'epic' }
        ];
        
        // 如果子弹分裂遗物激活，添加到普通升级池
        if (this.shopSystem.isRelicActive('bulletSplit')) {
            commonUpgrades.push({ 
                type: 'bulletsplit', 
                icon: '🌟', 
                name: '子弹分裂', 
                desc: '子弹命中后分裂', 
                rarity: 'common' 
            });
        }
        
        // 根据稀有度概率选择3个升级（避免重复）
        const selected = [];
        const availableUpgrades = {
            common: [...commonUpgrades],
            rare: [...rareUpgrades], 
            epic: [...epicUpgrades]
        };
        
        for (let i = 0; i < 3; i++) {
            const rand = Math.random();
            let upgrade;
            let attempts = 0;
            
            do {
                if (rand < 0.15 && availableUpgrades.epic.length > 0) {
                    // 15% 史诗
                    upgrade = availableUpgrades.epic[Math.floor(Math.random() * availableUpgrades.epic.length)];
                    // 移除已选择的升级
                    const index = availableUpgrades.epic.indexOf(upgrade);
                    if (index > -1) availableUpgrades.epic.splice(index, 1);
                } else if (rand < 0.50 && availableUpgrades.rare.length > 0) {
                    // 35% 稀有 (15% + 35% = 50%)
                    upgrade = availableUpgrades.rare[Math.floor(Math.random() * availableUpgrades.rare.length)];
                    // 移除已选择的升级
                    const index = availableUpgrades.rare.indexOf(upgrade);
                    if (index > -1) availableUpgrades.rare.splice(index, 1);
                } else {
                    // 50% 普通
                    upgrade = availableUpgrades.common[Math.floor(Math.random() * availableUpgrades.common.length)];
                    // 移除已选择的升级
                    const index = availableUpgrades.common.indexOf(upgrade);
                    if (index > -1) availableUpgrades.common.splice(index, 1);
                }
                attempts++;
                
                // 如果尝试次数过多，从剩余的升级中随机选择
                if (attempts > 10) {
                    const allRemaining = [...availableUpgrades.common, ...availableUpgrades.rare, ...availableUpgrades.epic];
                    if (allRemaining.length > 0) {
                        upgrade = allRemaining[Math.floor(Math.random() * allRemaining.length)];
                        break;
                    }
                }
            } while (selected.some(s => s.type === upgrade.type));
            
            selected.push(upgrade);
        }
        
        // 更新升级卡片
        const upgradeOptions = document.getElementById('upgradeOptions');
        upgradeOptions.innerHTML = '';
        
        selected.forEach(upgrade => {
            const card = document.createElement('div');
            card.className = `upgrade-card ${upgrade.rarity}`;
            card.setAttribute('data-upgrade', upgrade.type);
            card.innerHTML = `
                <div class="upgrade-icon">${upgrade.icon}</div>
                <h3>${upgrade.name}</h3>
                <p>${upgrade.desc}</p>
                <div class="upgrade-rarity">${upgrade.rarity === 'common' ? '普通' : upgrade.rarity === 'rare' ? '稀有' : '史诗'}</div>
            `;
            card.addEventListener('click', () => {
                this.applyUpgrade(upgrade.type);
                this.hideLevelUpScreen();
            });
            upgradeOptions.appendChild(card);
        });
    }

    hideLevelUpScreen() {
        this.state.isPaused = false;
        document.getElementById('levelUpScreen').classList.add('hidden');
    }

    update() {
        if (!this.state.isRunning || this.state.isPaused) return;

        // 更新玩家
        this.player.update(this.keys, this.worldMouse.x, this.worldMouse.y, this.leftJoystick, this.rightJoystick);

        // 更新摄像机（boss存在时玩家位置在下半屏）
        this.camera.follow(this.player, this.boss !== null);

        // 更新世界管理器
        this.worldManager.updateVisibleChunks(this.player.x, this.player.y);

        // 玩家射击（支持多发子弹）
        if (this.player.canShoot()) {
            const bulletCount = this.player.bulletCount;
            const spreadAngle = bulletCount > 1 ? 0.3 : 0; // 多发子弹时的扩散角度
            
            for (let i = 0; i < bulletCount; i++) {
                let angle = this.player.angle;
                if (bulletCount > 1) {
                    // 计算扩散角度
                    const offset = (i - (bulletCount - 1) / 2) * spreadAngle / (bulletCount - 1);
                    angle += offset;
                }
                
                const bullet = new Bullet(
                    this.player.x + Math.cos(angle) * this.player.size,
                    this.player.y + Math.sin(angle) * this.player.size,
                    angle,
                    true,
                    this.player.bulletSplitLevel
                );
                bullet.size = this.player.bulletSize;
                bullet.damage = this.player.damage;
                this.bullets.push(bullet);
            }
        }
        
        // 更新护盾
        this.player.shields.forEach(shield => {
            shield.angle += shield.rotationSpeed;
        });
        
        // 更新僚机
        this.player.drones.forEach(drone => {
            drone.angle += drone.orbitSpeed;
            
            // 更新僚机朝向，跟随主角朝向，带惯性和延迟
            drone.targetRotation = this.player.angle;
            
            // 计算角度差，处理角度环绕问题
            let angleDiff = drone.targetRotation - drone.currentRotation;
            // 将角度差限制在 -π 到 π 之间
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // 带惯性的角度插值，延迟系数0.08（较慢的跟随）
            drone.currentRotation += angleDiff * 0.08;
            
            // 僚机射击
            const now = Date.now();
            if (now - drone.lastShootTime >= drone.shootCooldown && this.enemies.length > 0) {
                // 找到最近的敌人
                let nearestEnemy = null;
                let minDist = Infinity;
                
                this.enemies.forEach(enemy => {
                    const droneX = this.player.x + Math.cos(drone.angle) * drone.distance;
                    const droneY = this.player.y + Math.sin(drone.angle) * drone.distance;
                    const dx = enemy.x - droneX;
                    const dy = enemy.y - droneY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < minDist) {
                        minDist = dist;
                        nearestEnemy = enemy;
                    }
                });
                
                if (nearestEnemy) {
                    const droneX = this.player.x + Math.cos(drone.angle) * drone.distance;
                    const droneY = this.player.y + Math.sin(drone.angle) * drone.distance;
                    const angle = Math.atan2(nearestEnemy.y - droneY, nearestEnemy.x - droneX);
                    
                    const bullet = new Bullet(droneX, droneY, angle, true);
                    bullet.damage = this.player.damage * 0.5; // 僚机伤害为玩家的50%
                    this.bullets.push(bullet);
                    drone.lastShootTime = now;
                }
            }
        });
        
        // 制导武器发射
        if (this.player.guidedWeapon.enabled && this.enemies.length > 0) {
            const now = Date.now();
            if (now - this.player.guidedWeapon.lastFireTime >= this.player.guidedWeapon.cooldown) {
                // 发射导弹
                for (let i = 0; i < this.player.guidedWeapon.missileCount; i++) {
                    const missile = new Missile(
                        this.player.x,
                        this.player.y,
                        this.player.guidedWeapon.damage,
                        this.player.guidedWeapon.blastRadius
                    );
                    // 寻找目标（包括BOSS）
                    const allTargets = [...this.enemies];
                    if (this.boss) {
                        allTargets.push(this.boss);
                    }
                    missile.findTarget(allTargets, this.player.x, this.player.y, this.player.guidedWeapon.searchRadius);
                    this.missiles.push(missile);
                }
                this.player.guidedWeapon.lastFireTime = now;
            }
        }
        
        // 更新导弹
        this.missiles = this.missiles.filter(missile => {
            // 将BOSS也加入目标列表
            const allTargets = [...this.enemies];
            if (this.boss) {
                allTargets.push(this.boss);
            }
            
            missile.update(allTargets);
            
            // 检查是否击中目标或到达目标位置
            if (missile.hasReachedTarget() || (missile.target && missile.target.health <= 0)) {
                // 导弹爆炸，对范围内的敌人和BOSS造成伤害
                this.enemies.forEach(enemy => {
                    const dx = enemy.x - missile.x;
                    const dy = enemy.y - missile.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= missile.blastRadius) {
                        enemy.health -= missile.damage;
                        if (enemy.health < 0) enemy.health = 0;
                        // 触发敌人受击特效
                        enemy.hitFlash = enemy.hitFlashDuration || 0.2;
                    }
                });
                
                // 对BOSS造成伤害
                if (this.boss) {
                    const dx = this.boss.x - missile.x;
                    const dy = this.boss.y - missile.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= missile.blastRadius) {
                        if (this.boss.takeDamage(missile.damage)) {
                            // BOSS死亡
                            this.state.kills++;
                            this.state.score += 5000;
                            this.createParticles(this.boss.x, this.boss.y, '#ffd700', 50);
                            
                            // 掉落大量经验（50个）
                            for (let i = 0; i < 50; i++) {
                                this.experienceGems.push(new ExperienceGem(
                                    this.boss.x + (Math.random() - 0.5) * 200,
                                    this.boss.y + (Math.random() - 0.5) * 200,
                                    this.state.wave,
                                    this.shopSystem
                                ));
                            }
                            
                            this.boss = null;
                            this.showBossDefeatedPopup();
                        }
                    }
                }
                
                // 创建华丽的爆炸效果
                this.explosions.push(new ExplosionEffect(missile.x, missile.y, missile.blastRadius));
                
                // 额外创建一些粒子效果增强视觉
                this.createParticles(missile.x, missile.y, '#ffd700', 15);
                this.createParticles(missile.x, missile.y, '#ff9800', 15);
                
                return false; // 移除导弹
            }
            
            return !missile.isOutOfBounds(this.player.x, this.player.y);
        });

        // 更新子弹
        this.bullets = this.bullets.filter(bullet => {
            bullet.update();
            return !bullet.isOutOfBounds(this.player.x, this.player.y);
        });

        // 生成敌人（BOSS存在或BOSS刚被击败时不生成）
        const now = Date.now();
        if (!this.boss && !this.bossDefeated && now - this.lastEnemySpawn > CONFIG.enemy.spawnInterval) {
            // 每波生成固定1个敌人
            this.spawnEnemy();
            this.lastEnemySpawn = now;
        }

        // 更新BOSS战斗区域
        if (this.bossArena) {
            this.bossArena.update();
            
            // 如果完全消散，清除战斗区域
            if (this.bossArena.isFullyDissipated()) {
                this.bossArena = null;
            } else {
                // 限制玩家在战斗区域内（消散过程中不限制）
                if (!this.bossArena.isDissipating) {
                    this.bossArena.constrainPlayer(this.player);
                }
            }
        }

        // 更新BOSS
        if (this.boss) {
            const arenaCenter = this.bossArena ? { x: this.bossArena.centerX, y: this.bossArena.centerY } : null;
            this.boss.update(this.player.x, this.player.y, CONFIG.canvas.width, CONFIG.canvas.height, this.camera.x, this.camera.y, arenaCenter);
            
            // BOSS冲击波更新
            const newShockwave = this.boss.updateShockwave();
            if (newShockwave) {
                this.bossShockwaves.push(new BossShockwave(
                    newShockwave.x,
                    newShockwave.y,
                    newShockwave.maxRadius,
                    newShockwave.expandSpeed,
                    newShockwave.damage,
                    newShockwave.slowEffect,
                    newShockwave.slowDuration
                ));
                this.boss.shockwaveFired = false;
            }
            
            // BOSS激光更新
            const newLaser = this.boss.updateLaser();
            if (newLaser) {
                this.bossLasers.push(newLaser);
            }
            
            // BOSS发射追身怪
            if (this.boss.shouldFireChaser()) {
                const spawnPos = this.boss.getChaserSpawnPosition();
                const chaser = new Chaser(spawnPos.x, spawnPos.y, this.state.wave, true); // 标记为BOSS追身怪
                // 给追身怪一个初始速度
                const speed = 3;
                chaser.vx = Math.cos(spawnPos.angle) * speed;
                chaser.vy = Math.sin(spawnPos.angle) * speed;
                this.enemies.push(chaser);
            }
            
            // 能量力场对BOSS的伤害
            if (this.player.energyField.enabled && this.boss.health > 0) {
                const dx = this.boss.x - this.player.x;
                const dy = this.boss.y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 只要力场与BOSS有重叠就造成伤害
                if (distance < this.player.energyField.radius + this.boss.size) {
                    const damagePerFrame = this.player.energyField.damage / 60;
                    this.boss.health = Math.max(0, this.boss.health - damagePerFrame);
                    this.boss.hitFlash = this.boss.hitFlashDuration;
                    
                    // 检查boss是否死亡
                    if (this.boss.health <= 0) {
                        this.state.kills++;
                        this.state.score += 5000;
                        this.createParticles(this.boss.x, this.boss.y, '#ffd700', 50);
                        
                        // 掉落大量经验（50个）
                        for (let i = 0; i < 50; i++) {
                            this.experienceGems.push(new ExperienceGem(
                                this.boss.x + (Math.random() - 0.5) * 200,
                                this.boss.y + (Math.random() - 0.5) * 200,
                                this.state.wave,
                                this.shopSystem
                            ));
                        }
                        
                        // 击败所有屏幕上的敌人
                        this.enemies.forEach(enemy => {
                            this.createParticles(enemy.x, enemy.y, '#ff5252', 10);
                        });
                        this.enemies = [];
                        
                        // 清除所有敌人子弹
                        this.bullets = this.bullets.filter(b => b.isPlayer);
                        
                        this.boss = null;
                        this.bossDefeated = true;
                        this.showBossDefeatedPopup();
                        
                        // 创建胜利传送门
                        this.bossVictoryPortals = new BossVictoryPortals(
                            this.bossArena.centerX,
                            this.bossArena.centerY
                        );
                    }
                }
            }
        }
        
        // 更新BOSS胜利传送门
        if (this.bossVictoryPortals) {
            this.bossVictoryPortals.update();
            
            // 检查玩家是否进入传送门
            const portalChoice = this.bossVictoryPortals.checkPlayerCollision(this.player);
            if (portalChoice === 'continue') {
                // 继续挑战：解锁下一关并触发小行星边框消散动画
                this.unlockNextStage();
                if (this.bossArena && !this.bossArena.isDissipating) {
                    this.bossArena.startDissipation();
                }
                this.bossVictoryPortals = null;
                this.bossDefeated = false;
                this.camera.unfix();
            } else if (portalChoice === 'menu') {
                // 回到菜单：结束游戏
                this.gameOver();
            }
        }
        
        // 更新BOSS激光
        this.bossLasers = this.bossLasers.filter(laser => {
            laser.update();
            
            // 更新激光的boss位置（让激光跟随boss）
            if (this.boss) {
                laser.updateBossPosition(this.boss.x, this.boss.y);
            }
            
            // 检测激光与玩家碰撞
            if (laser.checkCollision(this.player, this.player.size)) {
                this.player.takeDamage(laser.damage);
                if (this.player.health <= 0) {
                    this.gameOver();
                }
            }
            
            return !laser.isDead();
        });
        
        // 更新BOSS冲击波
        this.bossShockwaves = this.bossShockwaves.filter(shockwave => {
            shockwave.update();
            
            // 检测冲击波与玩家碰撞
            if (shockwave.checkCollision(this.player, this.player.size)) {
                this.player.takeDamage(shockwave.damage);
                this.player.applySlow(shockwave.slowEffect, shockwave.slowDuration);
                if (this.player.health <= 0) {
                    this.gameOver();
                }
            }
            
            return !shockwave.isDead();
        });

        // 更新敌人
        this.enemies.forEach(enemy => {
            enemy.update(this.player.x, this.player.y);

            // 能量力场伤害
            if (this.player.energyField.enabled && enemy.health > 0) {
                const dx = enemy.x - this.player.x;
                const dy = enemy.y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 只要力场与敌人有重叠就造成伤害
                if (distance < this.player.energyField.radius + enemy.size) {
                    // 敌人在力场范围内，每帧受到伤害
                    // 假设60fps，每秒伤害 = damage，每帧伤害 = damage/60
                    const damagePerFrame = this.player.energyField.damage / 60;
                    // 确保扣除伤害后血量不会小于0
                    enemy.health = Math.max(0, enemy.health - damagePerFrame);
                }
            }

            // 敌人射击
            if (enemy.canShoot && enemy.canShoot()) {
                if (enemy.type === 'titan') {
                    // 泰坦向8个方向发射
                    for (let i = 0; i < 8; i++) {
                        const angle = (Math.PI * 2 * i) / 8;
                        const bullet = new Bullet(enemy.x, enemy.y, angle, false);
                        bullet.damage = enemy.damage;
                        this.bullets.push(bullet);
                    }
                } else if (enemy.type === 'normal') {
                    // 普通敌人向玩家发射
                    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
                    const bullet = new Bullet(enemy.x, enemy.y, angle, false);
                    bullet.damage = enemy.damage;
                    this.bullets.push(bullet);
                }
                // 追身怪不发射子弹
            }
        });

        // 更新守卫
        this.guardians.forEach(guardian => {
            guardian.update(this.player.x, this.player.y);

            // 能量力场伤害
            if (this.player.energyField.enabled && guardian.health > 0) {
                const dx = guardian.x - this.player.x;
                const dy = guardian.y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 只要力场与守卫有重叠就造成伤害
                if (distance < this.player.energyField.radius + guardian.size) {
                    const damagePerFrame = this.player.energyField.damage / 60;
                    guardian.health = Math.max(0, guardian.health - damagePerFrame);
                }
            }

            // 守卫射击
            if (guardian.canShoot()) {
                const angle = Math.atan2(this.player.y - guardian.y, this.player.x - guardian.x);
                const bullet = new Bullet(guardian.x, guardian.y, angle, false);
                bullet.damage = guardian.damage;
                this.bullets.push(bullet);
            }
        });

        // 更新宝箱
        if (this.treasureChest && !this.treasureChest.opened) {
            this.treasureChest.update();
            
            // 检查所有守卫是否被击败
            if (this.treasureChest.locked && this.guardians.length === 0) {
                this.treasureChest.unlock();
            }
        }

        // 更新经验宝石
        this.experienceGems.forEach(gem => {
            gem.update(this.player.x, this.player.y);
        });

        // 更新血包
        this.healthPacks.forEach(pack => {
            pack.update(this.player.x, this.player.y);
        });

        // 碰撞检测 - 玩家子弹击中敌人
        this.bullets.forEach((bullet, bulletIndex) => {
            if (!bullet.isPlayer) return;

            let bulletHit = false;
            
            this.enemies.forEach((enemy, enemyIndex) => {
                if (bulletHit) return;
                if (this.checkCollision(bullet, enemy, bullet.size, enemy.size)) {
                    if (enemy.takeDamage(bullet.damage)) {
                        // 敌人死亡
                        const deadEnemy = this.enemies.splice(enemyIndex, 1)[0];
                        this.state.kills++;
                        this.state.score += 100;
                        this.createParticles(deadEnemy.x, deadEnemy.y, '#ff5252', 15);
                        
                        // 掉落经验（传入当前波次和商店系统）
                        // BOSS追身怪不掉落经验
                        if (!deadEnemy.isBossChaser) {
                            this.experienceGems.push(new ExperienceGem(deadEnemy.x, deadEnemy.y, this.state.wave, this.shopSystem));
                        }
                        
                        // 血包掉落概率：基础5%，高级修理遗物+5%
                        let dropChance = CONFIG.healthPack.dropChance;
                        if (this.shopSystem.isRelicActive('advancedRepair')) {
                            dropChance += 0.05;
                        }
                        if (Math.random() < dropChance) {
                            this.healthPacks.push(new HealthPack(deadEnemy.x, deadEnemy.y, this.shopSystem));
                        }

                        // 检查是否进入下一波
                        if (this.state.kills % 10 === 0) {
                            this.state.wave++;
                            this.enemiesPerWave += 2;
                            
                            // 检查是否生成BOSS
                            if (this.state.wave === this.bossWave && !this.bossSpawned) {
                                this.spawnBoss();
                            }
                            
                            // 检查是否生成宝箱
                            if (this.state.wave >= this.nextTreasureWave && !this.treasureChest) {
                                this.spawnTreasureChest();
                            }
                        }
                    } else {
                        this.createParticles(bullet.x, bullet.y, '#4dd0e1', 5);
                    }
                    
                    // 子弹分裂
                    const splitBullets = bullet.split();
                    splitBullets.forEach(sb => this.bullets.push(sb));
                    
                    this.bullets.splice(bulletIndex, 1);
                    bulletHit = true;
                }
            });

            if (bulletHit) return;
            
            // 检测BOSS
            if (this.boss && bullet.isPlayer) {
                if (this.checkCollision(bullet, this.boss, bullet.size, this.boss.size)) {
                    if (this.boss.takeDamage(bullet.damage)) {
                        // BOSS死亡
                        this.state.kills++;
                        this.state.score += 5000;
                        this.createParticles(this.boss.x, this.boss.y, '#ffd700', 50);
                        
                        // 掉落大量经验（50个）
                        for (let i = 0; i < 50; i++) {
                            this.experienceGems.push(new ExperienceGem(
                                this.boss.x + (Math.random() - 0.5) * 200,
                                this.boss.y + (Math.random() - 0.5) * 200,
                                this.state.wave,
                                this.shopSystem
                            ));
                        }
                        
                        // 击败所有屏幕上的敌人
                        this.enemies.forEach(enemy => {
                            this.createParticles(enemy.x, enemy.y, '#ff5252', 10);
                        });
                        this.enemies = [];
                        
                        // 清除所有敌人子弹
                        this.bullets = this.bullets.filter(b => b.isPlayer);
                        
                        this.boss = null;
                        this.bossDefeated = true;
                        this.showBossDefeatedPopup();
                        
                        // 创建胜利传送门
                        this.bossVictoryPortals = new BossVictoryPortals(
                            this.bossArena.centerX,
                            this.bossArena.centerY
                        );
                    } else {
                        this.createParticles(bullet.x, bullet.y, '#4dd0e1', 5);
                    }
                    
                    // 子弹分裂
                    const splitBullets = bullet.split();
                    splitBullets.forEach(sb => this.bullets.push(sb));
                    
                    this.bullets.splice(bulletIndex, 1);
                    bulletHit = true;
                }
            }
            
            if (bulletHit) return;
            
            // 检测守卫
            this.guardians.forEach((guardian, guardianIndex) => {
                if (bulletHit) return;
                if (this.checkCollision(bullet, guardian, bullet.size, guardian.size)) {
                    if (guardian.takeDamage(bullet.damage)) {
                        // 守卫死亡
                        const deadGuardian = this.guardians.splice(guardianIndex, 1)[0];
                        this.state.kills++;
                        this.state.score += 200;
                        this.createParticles(deadGuardian.x, deadGuardian.y, '#ff4500', 20);
                        
                        // 掉落更多经验
                        for (let i = 0; i < 3; i++) {
                            this.experienceGems.push(new ExperienceGem(
                                deadGuardian.x + (Math.random() - 0.5) * 30,
                                deadGuardian.y + (Math.random() - 0.5) * 30,
                                this.state.wave,
                                this.shopSystem
                            ));
                        }
                    } else {
                        this.createParticles(bullet.x, bullet.y, '#4dd0e1', 5);
                    }
                    
                    // 子弹分裂
                    const splitBullets = bullet.split();
                    splitBullets.forEach(sb => this.bullets.push(sb));
                    
                    this.bullets.splice(bulletIndex, 1);
                    bulletHit = true;
                }
            });
        });

        // 碰撞检测 - 玩家拾取经验
        this.experienceGems = this.experienceGems.filter(gem => {
            if (this.checkCollision(gem, this.player, gem.size, this.player.size)) {
                const leveledUp = this.state.addExperience(gem.value);
                this.createParticles(gem.x, gem.y, '#ffd700', 8);
                
                if (leveledUp) {
                    this.showLevelUpScreen();
                }
                
                return false;
            }
            return true;
        });

        // 碰撞检测 - 玩家拾取血包
        this.healthPacks = this.healthPacks.filter(pack => {
            if (this.checkCollision(pack, this.player, pack.size, this.player.size)) {
                // 血包回复量：基础30%，高级修理遗物提升至50%
                let healPercent = CONFIG.healthPack.healAmount;
                if (this.shopSystem.isRelicActive('advancedRepair')) {
                    healPercent = 0.5;
                }
                const healAmount = this.player.maxHealth * healPercent;
                this.player.health = Math.min(this.player.maxHealth, this.player.health + healAmount);
                this.createParticles(pack.x, pack.y, '#4caf50', 12);
                return false;
            }
            return true;
        });

        // 碰撞检测 - 玩家拾取宝箱
        if (this.treasureChest && !this.treasureChest.opened) {
            if (this.checkCollision(this.treasureChest, this.player, this.treasureChest.size, this.player.size)) {
                if (this.treasureChest.locked) {
                    // 宝箱未解锁，显示提示
                    if (!this.treasureLockedPopupTime || Date.now() - this.treasureLockedPopupTime > 2000) {
                        this.showTreasureLockedPopup();
                        this.treasureLockedPopupTime = Date.now();
                    }
                } else {
                    // 宝箱已解锁，可以打开
                    this.treasureChest.open();
                    this.createParticles(this.treasureChest.x, this.treasureChest.y, '#ffd700', 30);
                    
                    // 生成掉落物（不立即吸附）
                    const drops = [];
                    const reward = Math.random();
                    if (reward < 0.5) {
                        // 大量经验
                        for (let i = 0; i < 10; i++) {
                            const gem = new ExperienceGem(
                                this.treasureChest.x + (Math.random() - 0.5) * 60,
                                this.treasureChest.y + (Math.random() - 0.5) * 60,
                                this.state.wave,
                                this.shopSystem
                            );
                            gem.magnetRange = 0; // 暂时禁用吸附
                            drops.push(gem);
                            this.experienceGems.push(gem);
                        }
                    } else {
                        // 血包
                        for (let i = 0; i < 3; i++) {
                            const healthPack = new HealthPack(
                                this.treasureChest.x + (Math.random() - 0.5) * 60,
                                this.treasureChest.y + (Math.random() - 0.5) * 60,
                                this.shopSystem
                            );
                            healthPack.magnetRange = 0; // 暂时禁用吸附
                            drops.push(healthPack);
                            this.healthPacks.push(healthPack);
                        }
                    }
                    
                    // 掉落遗物币：掉落范围 = log(波次+1) 到 log(波次+1)*1.5
                    const wave = this.state.wave;
                    const minCoins = Math.floor(Math.log(wave + 1));
                    const maxCoins = Math.floor(Math.log(wave + 1) * 1.5);
                    const coinDrop = Math.floor(Math.random() * (maxCoins - minCoins + 1)) + minCoins;
                    if (coinDrop > 0) {
                        this.shopSystem.addCoins(coinDrop);
                        // 显示遗物币获得提示
                        this.showCoinReward(coinDrop);
                    }
                    
                    // 1秒后启用吸附并自动飞向玩家
                    setTimeout(() => {
                        drops.forEach(drop => {
                            drop.magnetRange = 300; // 增大吸附范围
                            // 立即将掉落物移到玩家附近，然后缓慢吸附
                            const dx = this.player.x - drop.x;
                            const dy = this.player.y - drop.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance > 0) {
                                // 将掉落物移到玩家周围100像素范围内
                                drop.x = this.player.x - (dx / distance) * 100;
                                drop.y = this.player.y - (dy / distance) * 100;
                            }
                        });
                    }, 1000);
                    
                    // 清空宝箱引用
                    setTimeout(() => {
                        this.treasureChest = null;
                    }, 1000);
                }
            }
        }

        // 碰撞检测 - 敌人子弹击中玩家或护盾
        this.bullets.forEach((bullet, bulletIndex) => {
            if (bullet.isPlayer) return;

            // 先检查护盾
            let shieldBlocked = false;
            this.player.shields.forEach((shield, shieldIndex) => {
                const shieldX = this.player.x + Math.cos(shield.angle) * shield.distance;
                const shieldY = this.player.y + Math.sin(shield.angle) * shield.distance;
                
                if (this.checkCollision(bullet, { x: shieldX, y: shieldY }, bullet.size, shield.size)) {
                    this.bullets.splice(bulletIndex, 1);
                    this.createParticles(shieldX, shieldY, '#4dd0e1', 6);
                    shieldBlocked = true;
                }
            });
            
            if (shieldBlocked) return;

            // 再检查玩家
            if (this.checkCollision(bullet, this.player, bullet.size, this.player.size)) {
                this.player.takeDamage(bullet.damage);
                this.bullets.splice(bulletIndex, 1);
                this.createParticles(this.player.x, this.player.y, '#8A2BE2', 8);

                if (this.player.health <= 0) {
                    this.gameOver();
                }
            }
        });

        // 碰撞检测 - 敌人碰撞玩家或护盾
        this.enemies.forEach((enemy, enemyIndex) => {
            // 先检查护盾
            let shieldBlocked = false;
            this.player.shields.forEach((shield, shieldIndex) => {
                const shieldX = this.player.x + Math.cos(shield.angle) * shield.distance;
                const shieldY = this.player.y + Math.sin(shield.angle) * shield.distance;
                
                if (this.checkCollision(enemy, { x: shieldX, y: shieldY }, enemy.size, shield.size)) {
                    // 护盾抵消敌人攻击
                    if (enemy.type === 'chaser') {
                        // 追身怪被护盾摧毁
                        this.enemies.splice(enemyIndex, 1);
                        this.createParticles(enemy.x, enemy.y, '#8b5a2b', 10);
                    }
                    this.createParticles(shieldX, shieldY, '#4dd0e1', 6);
                    shieldBlocked = true;
                }
            });
            
            if (shieldBlocked) return;
            
            // 再检查玩家
            if (this.checkCollision(enemy, this.player, enemy.size, this.player.size)) {
                let damage = 5;
                if (enemy.type === 'chaser') {
                    damage = enemy.damage;
                    // 追身怪撞击后死亡
                    this.enemies.splice(enemyIndex, 1);
                    this.createParticles(enemy.x, enemy.y, '#8b5a2b', 10);
                }
                
                this.player.takeDamage(damage);
                if (this.player.health <= 0) {
                    this.gameOver();
                }
            }
        });

        // 碰撞检测 - 守卫碰撞玩家或护盾
        this.guardians.forEach((guardian, guardianIndex) => {
            // 先检查护盾
            let shieldBlocked = false;
            this.player.shields.forEach((shield, shieldIndex) => {
                const shieldX = this.player.x + Math.cos(shield.angle) * shield.distance;
                const shieldY = this.player.y + Math.sin(shield.angle) * shield.distance;
                
                if (this.checkCollision(guardian, { x: shieldX, y: shieldY }, guardian.size, shield.size)) {
                    this.createParticles(shieldX, shieldY, '#4dd0e1', 6);
                    shieldBlocked = true;
                }
            });
            
            if (shieldBlocked) return;
            
            // 再检查玩家
            if (this.checkCollision(guardian, this.player, guardian.size, this.player.size)) {
                this.player.takeDamage(10);
                if (this.player.health <= 0) {
                    this.gameOver();
                }
            }
        });

        // 更新粒子
        this.particles = this.particles.filter(particle => {
            particle.update();
            return !particle.isDead();
        });

        // 更新爆炸效果
        this.explosions = this.explosions.filter(explosion => {
            explosion.update();
            return !explosion.isDead();
        });

        this.updateUI();
    }

    draw() {
        // 清空画布
        this.ctx.fillStyle = '#0f0f1e';
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

        // 保存状态
        this.ctx.save();

        // BOSS进场屏幕震动
        let shakeX = 0;
        let shakeY = 0;
        if (this.boss && this.boss.isEntering) {
            const shake = this.boss.getShakeOffset();
            shakeX = shake.x;
            shakeY = shake.y;
        }

        // 应用摄像机变换（加上震动偏移）
        this.ctx.translate(shakeX, shakeY);
        this.camera.apply(this.ctx);

        // 绘制世界网格背景
        const gridSize = 50;
        const startX = Math.floor((this.camera.x - CONFIG.canvas.width / 2) / gridSize) * gridSize;
        const endX = Math.ceil((this.camera.x + CONFIG.canvas.width / 2) / gridSize) * gridSize;
        const startY = Math.floor((this.camera.y - CONFIG.canvas.height / 2) / gridSize) * gridSize;
        const endY = Math.ceil((this.camera.y + CONFIG.canvas.height / 2) / gridSize) * gridSize;

        this.ctx.strokeStyle = 'rgba(138, 43, 226, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }

        // 绘制地图块
        const visibleChunks = this.worldManager.getVisibleChunks(this.player.x, this.player.y);
        visibleChunks.forEach(chunk => chunk.draw(this.ctx));

        // 绘制血包
        this.healthPacks.forEach(pack => pack.draw(this.ctx));

        // 绘制经验宝石
        this.experienceGems.forEach(gem => gem.draw(this.ctx));

        // 绘制粒子
        this.particles.forEach(particle => particle.draw(this.ctx));

        // 绘制爆炸效果（在粒子之后，子弹之前，确保视觉层次）
        this.explosions.forEach(explosion => explosion.draw(this.ctx));

        // 绘制子弹
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        
        // 绘制导弹
        this.missiles.forEach(missile => missile.draw(this.ctx));

        // 绘制敌人
        this.enemies.forEach(enemy => enemy.draw(this.ctx));

        // 绘制守卫
        this.guardians.forEach(guardian => guardian.draw(this.ctx));

        // 绘制宝箱
        if (this.treasureChest && !this.treasureChest.opened) {
            this.treasureChest.draw(this.ctx);
        }

        // 绘制BOSS战斗区域（小行星带边框）
        if (this.bossArena) {
            this.bossArena.draw(this.ctx);
        }

        // 绘制BOSS激光（在BOSS之前，确保激光在BOSS下方）
        this.bossLasers.forEach(laser => laser.draw(this.ctx));
        
        // 绘制BOSS冲击波
        this.bossShockwaves.forEach(shockwave => shockwave.draw(this.ctx));

        // 绘制BOSS
        if (this.boss) {
            this.boss.draw(this.ctx);
        }
        
        // 绘制BOSS胜利传送门
        if (this.bossVictoryPortals) {
            this.bossVictoryPortals.draw(this.ctx);
        }

        // 绘制玩家
        if (this.player) {
            // 绘制护盾
            this.player.shields.forEach(shield => {
                const shieldX = this.player.x + Math.cos(shield.angle) * shield.distance;
                const shieldY = this.player.y + Math.sin(shield.angle) * shield.distance;
                
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(shieldX, shieldY, shield.size, 0, Math.PI * 2);
                
                const gradient = this.ctx.createRadialGradient(shieldX, shieldY, 0, shieldX, shieldY, shield.size);
                gradient.addColorStop(0, 'rgba(77, 208, 225, 0.8)');
                gradient.addColorStop(0.7, 'rgba(77, 208, 225, 0.4)');
                gradient.addColorStop(1, 'rgba(77, 208, 225, 0.1)');
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
                
                this.ctx.strokeStyle = '#4dd0e1';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.restore();
            });
            
            // 绘制僚机
            this.player.drones.forEach(drone => {
                const droneX = this.player.x + Math.cos(drone.angle) * drone.distance;
                const droneY = this.player.y + Math.sin(drone.angle) * drone.distance;
                
                this.ctx.save();
                this.ctx.translate(droneX, droneY);
                this.ctx.rotate(drone.currentRotation); // 使用带惯性的朝向
                
                // 绘制小三角形
                this.ctx.beginPath();
                this.ctx.moveTo(drone.size, 0);
                this.ctx.lineTo(-drone.size, -drone.size / 2);
                this.ctx.lineTo(-drone.size, drone.size / 2);
                this.ctx.closePath();
                
                const gradient = this.ctx.createLinearGradient(-drone.size, 0, drone.size, 0);
                gradient.addColorStop(0, '#ffd700');
                gradient.addColorStop(1, '#ffa000');
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
                
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                
                this.ctx.restore();
            });
            
            this.player.draw(this.ctx);
        }

        // 恢复画布状态
        this.ctx.restore();

        // 绘制主屏幕宝箱指示（屏幕坐标，不受摄像机影响）
        // BOSS战阶段不显示宝箱指示
        if (this.treasureChest && !this.treasureChest.opened && this.player && !this.boss) {
            const dx = this.treasureChest.x - this.player.x;
            const dy = this.treasureChest.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            // 计算宝箱在屏幕上的位置
            const screenX = CONFIG.canvas.width / 2 + dx;
            const screenY = CONFIG.canvas.height / 2 + dy;
            
            // 如果宝箱在屏幕外，在边缘显示指示
            const margin = 80; // 距离屏幕边缘的距离
            const isOffScreen = screenX < margin || screenX > CONFIG.canvas.width - margin ||
                               screenY < margin || screenY > CONFIG.canvas.height - margin;
            
            if (isOffScreen) {
                // 计算指示器在屏幕边缘的位置
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                // 计算到屏幕边缘的距离
                const maxDistX = centerX - margin;
                const maxDistY = centerY - margin;
                
                // 计算边缘点
                let edgeX, edgeY;
                const absAngle = Math.abs(Math.atan2(dy, dx));
                const screenRatio = CONFIG.canvas.height / CONFIG.canvas.width;
                const cornerAngle = Math.atan(screenRatio);
                
                if (absAngle < cornerAngle || absAngle > Math.PI - cornerAngle) {
                    // 左右边缘
                    edgeX = dx > 0 ? CONFIG.canvas.width - margin : margin;
                    edgeY = centerY + (edgeX - centerX) * Math.tan(angle);
                } else {
                    // 上下边缘
                    edgeY = dy > 0 ? CONFIG.canvas.height - margin : margin;
                    edgeX = centerX + (edgeY - centerY) / Math.tan(angle);
                }
                
                // 绘制弧形指示器
                this.ctx.save();
                
                // 计算从屏幕中心到边缘点的角度和距离
                const indicatorAngle = Math.atan2(edgeY - centerY, edgeX - centerX);
                const indicatorRadius = Math.sqrt(
                    Math.pow(edgeX - centerX, 2) + Math.pow(edgeY - centerY, 2)
                );
                
                // 绘制发光的弧形
                this.ctx.strokeStyle = '#ffd700';
                this.ctx.lineWidth = 4;
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#ffd700';
                this.ctx.beginPath();
                this.ctx.arc(
                    centerX, 
                    centerY, 
                    indicatorRadius, 
                    indicatorAngle - 0.15, 
                    indicatorAngle + 0.15
                );
                this.ctx.stroke();
                
                // 绘制箭头
                this.ctx.fillStyle = '#ffd700';
                this.ctx.shadowBlur = 10;
                this.ctx.beginPath();
                this.ctx.moveTo(edgeX, edgeY);
                this.ctx.lineTo(
                    edgeX - Math.cos(indicatorAngle - 0.4) * 15,
                    edgeY - Math.sin(indicatorAngle - 0.4) * 15
                );
                this.ctx.lineTo(
                    edgeX - Math.cos(indicatorAngle + 0.4) * 15,
                    edgeY - Math.sin(indicatorAngle + 0.4) * 15
                );
                this.ctx.closePath();
                this.ctx.fill();
                
                // 绘制距离文字
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#ffd700';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                // 计算文字位置（在箭头内侧）
                const textX = edgeX - Math.cos(indicatorAngle) * 30;
                const textY = edgeY - Math.sin(indicatorAngle) * 30;
                
                // 绘制文字背景
                const distanceText = Math.floor(distance).toString();
                const textWidth = this.ctx.measureText(distanceText).width;
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(textX - textWidth / 2 - 5, textY - 10, textWidth + 10, 20);
                
                // 绘制文字
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fillText(distanceText, textX, textY);
                
                this.ctx.restore();
            }
        }

        // 绘制宝箱出现提示（屏幕坐标，不受摄像机影响）
        if (this.treasurePopupTime > 0) {
            const elapsed = Date.now() - this.treasurePopupTime;
            if (elapsed < 3000) { // 显示3秒
                const alpha = elapsed < 2500 ? 1 : (3000 - elapsed) / 500;
                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                
                // 绘制背景
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(CONFIG.canvas.width / 2 - 150, 50, 300, 80);
                
                // 绘制边框
                this.ctx.strokeStyle = '#ffd700';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(CONFIG.canvas.width / 2 - 150, 50, 300, 80);
                
                // 绘制文字
                this.ctx.fillStyle = '#ffd700';
                this.ctx.font = 'bold 32px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('💎 宝箱出现！', CONFIG.canvas.width / 2, 90);
                
                this.ctx.restore();
            } else {
                this.treasurePopupTime = 0;
            }
        }

        // 绘制宝箱锁定提示
        if (this.treasureLockedPopupTime > 0) {
            const elapsed = Date.now() - this.treasureLockedPopupTime;
            if (elapsed < 2000) { // 显示2秒
                const alpha = elapsed < 1500 ? 1 : (2000 - elapsed) / 500;
                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                
                // 绘制背景
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(CONFIG.canvas.width / 2 - 180, 150, 360, 80);
                
                // 绘制边框
                this.ctx.strokeStyle = '#ff4444';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(CONFIG.canvas.width / 2 - 180, 150, 360, 80);
                
                // 绘制文字
                this.ctx.fillStyle = '#ff4444';
                this.ctx.font = 'bold 28px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('🔒 请先击败守卫者', CONFIG.canvas.width / 2, 190);
                
                this.ctx.restore();
            } else {
                this.treasureLockedPopupTime = 0;
            }
        }
    }

    updateUI() {
        document.getElementById('score').textContent = this.state.score;
        document.getElementById('kills').textContent = this.state.kills;
        document.getElementById('wave').textContent = this.state.wave;

        if (this.player) {
            const healthPercent = (this.player.health / this.player.maxHealth) * 100;
            document.getElementById('healthBar').style.width = healthPercent + '%';
            document.getElementById('healthText').textContent = 
                `${Math.max(0, Math.floor(this.player.health))}/${this.player.maxHealth}`;
            
            document.getElementById('position').textContent = 
                `(${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})`;
        }

        // 更新等级和经验条
        document.getElementById('level').textContent = this.state.level;
        const expPercent = (this.state.experience / this.state.experienceRequired) * 100;
        document.getElementById('expBar').style.width = expPercent + '%';
        document.getElementById('expText').textContent = 
            `${Math.floor(this.state.experience)}/${this.state.experienceRequired}`;

        this.drawMinimap();
    }

    drawMinimap() {
        if (!this.player) return;

        const ctx = this.minimapCtx;
        const size = 150;
        const scale = 0.1;

        // 清空小地图
        ctx.fillStyle = '#0f0f1e';
        ctx.fillRect(0, 0, size, size);

        // 绘制地图块边界
        const visibleChunks = this.worldManager.getVisibleChunks(this.player.x, this.player.y);
        ctx.strokeStyle = 'rgba(138, 43, 226, 0.3)';
        ctx.lineWidth = 1;
        visibleChunks.forEach(chunk => {
            const x = (chunk.x - this.player.x) * scale + size / 2;
            const y = (chunk.y - this.player.y) * scale + size / 2;
            const chunkSize = CONFIG.world.chunkSize * scale;
            ctx.strokeRect(x, y, chunkSize, chunkSize);
        });

        // 绘制敌人
        ctx.fillStyle = '#ff5252';
        this.enemies.forEach(enemy => {
            const x = (enemy.x - this.player.x) * scale + size / 2;
            const y = (enemy.y - this.player.y) * scale + size / 2;
            if (x >= 0 && x <= size && y >= 0 && y <= size) {
                ctx.fillRect(x - 2, y - 2, 4, 4);
            }
        });

        // 绘制守卫
        ctx.fillStyle = '#ff4500';
        this.guardians.forEach(guardian => {
            const x = (guardian.x - this.player.x) * scale + size / 2;
            const y = (guardian.y - this.player.y) * scale + size / 2;
            if (x >= 0 && x <= size && y >= 0 && y <= size) {
                ctx.fillRect(x - 3, y - 3, 6, 6);
            }
        });

        // 绘制血包
        ctx.fillStyle = '#ef4444';
        this.healthPacks.forEach(pack => {
            const x = (pack.x - this.player.x) * scale + size / 2;
            const y = (pack.y - this.player.y) * scale + size / 2;
            if (x >= 0 && x <= size && y >= 0 && y <= size) {
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // 绘制宝箱指示（在雷达边缘显示金色弧）
        if (this.treasureChest && !this.treasureChest.opened) {
            const dx = this.treasureChest.x - this.player.x;
            const dy = this.treasureChest.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            // 如果宝箱在雷达范围外，在边缘显示指示
            if (distance * scale > size / 2 - 10) {
                const edgeX = size / 2 + Math.cos(angle) * (size / 2 - 5);
                const edgeY = size / 2 + Math.sin(angle) * (size / 2 - 5);
                
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 5, angle - 0.2, angle + 0.2);
                ctx.stroke();
                
                // 绘制箭头
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.moveTo(edgeX, edgeY);
                ctx.lineTo(
                    edgeX - Math.cos(angle - 0.5) * 8,
                    edgeY - Math.sin(angle - 0.5) * 8
                );
                ctx.lineTo(
                    edgeX - Math.cos(angle + 0.5) * 8,
                    edgeY - Math.sin(angle + 0.5) * 8
                );
                ctx.closePath();
                ctx.fill();
            } else {
                // 宝箱在雷达范围内，直接显示
                const x = dx * scale + size / 2;
                const y = dy * scale + size / 2;
                ctx.fillStyle = '#ffd700';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffd700';
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // 绘制玩家（中心点）
        ctx.fillStyle = '#8A2BE2';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // 绘制玩家方向指示
        ctx.strokeStyle = '#8A2BE2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.lineTo(
            size / 2 + Math.cos(this.player.angle) * 10,
            size / 2 + Math.sin(this.player.angle) * 10
        );
        ctx.stroke();
    }

    gameOver() {
        if (!this.player) return; // 如果玩家不存在，不显示游戏结束界面
        this.state.isRunning = false;
        
        // 奖励遗物币（波次数）
        const coinReward = this.state.wave;
        this.shopSystem.addCoins(coinReward);
        
        document.getElementById('finalScore').textContent = this.state.score;
        document.getElementById('finalKills').textContent = this.state.kills;
        document.getElementById('finalWave').textContent = this.state.wave;
        document.getElementById('coinReward').textContent = coinReward;
        document.getElementById('gameOver').classList.remove('hidden');
        
        // 更新商店UI
        this.updateShopUI();
    }

    gameLoop() {
        if (this.state.isRunning) {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.gameLoop());
        }
    }

    showShop() {
        document.getElementById('gameStart').classList.add('hidden');
        document.getElementById('shopScreen').classList.remove('hidden');
        this.updateShopUI();
    }

    hideShop() {
        document.getElementById('shopScreen').classList.add('hidden');
        document.getElementById('gameStart').classList.remove('hidden');
    }

    updateShopUI() {
        // 更新遗物币显示
        document.getElementById('coinAmount').textContent = this.shopSystem.coins;

        // 更新永久升级显示
        const upgrades = ['health', 'speed', 'damage'];
        upgrades.forEach(type => {
            const level = this.shopSystem.permanentUpgrades[type];
            const cost = this.shopSystem.getUpgradeCost(type);
            
            document.getElementById(`${type}Level`).textContent = level;
            document.getElementById(`${type}Cost`).textContent = cost;
            
            const btn = document.querySelector(`.upgrade-buy-btn[data-upgrade="${type}"]`);
            if (btn) {
                btn.disabled = this.shopSystem.coins < cost;
            }
        });

        // 更新遗物显示
        ['bulletSplit', 'gravityCapture', 'advancedRepair'].forEach(relicId => {
            const relicCard = document.querySelector(`.relic-card[data-relic="${relicId}"]`);
            if (relicCard && this.shopSystem.relics[relicId]) {
                const relic = this.shopSystem.relics[relicId];
                const priceEl = relicCard.querySelector('.relic-price');
                const checkmarkEl = relicCard.querySelector('.relic-checkmark');
                
                if (relic.purchased) {
                    // 已购买
                    if (priceEl) priceEl.style.display = 'none';
                    
                    // 根据激活状态显示/隐藏绿色对钩
                    if (relic.active) {
                        if (!checkmarkEl) {
                            const mark = document.createElement('div');
                            mark.className = 'relic-checkmark';
                            mark.textContent = '✓';
                            relicCard.appendChild(mark);
                        }
                        relicCard.classList.remove('inactive');
                    } else {
                        // 禁用时移除绿色对钩
                        if (checkmarkEl) checkmarkEl.remove();
                        relicCard.classList.add('inactive');
                    }
                } else {
                    // 未购买
                    if (priceEl) priceEl.style.display = 'block';
                    if (checkmarkEl) checkmarkEl.remove();
                    relicCard.classList.remove('inactive');
                }
            }
        });
    }

    buyPermanentUpgrade(type) {
        if (this.shopSystem.buyUpgrade(type)) {
            this.updateShopUI();
            
            // 播放购买音效（可选）
            this.createParticles(
                CONFIG.canvas.width / 2,
                CONFIG.canvas.height / 2,
                '#ffd700',
                20
            );
        }
    }

    buyRelic(relicId) {
        if (this.shopSystem.buyRelic(relicId)) {
            this.updateShopUI();
        }
    }

    toggleRelic(relicId) {
        if (this.shopSystem.toggleRelic(relicId)) {
            this.updateShopUI();
        }
    }

    // ========== GM指令功能实现 ==========
    
    // 设置波次
    gmSetWave(targetWave) {
        this.state.wave = targetWave;
        this.showMessage(`波次已设置为 ${targetWave}`, '#ffd700');
        
        // 清除现有敌人（可选）
        if (confirm('是否清除所有现有敌人？')) {
            this.enemies = [];
            this.guardians = [];
            this.boss = null;
            this.bossLasers = [];
            this.bossShockwaves = [];
        }
    }
    
    // 生成怪物
    gmSpawnEnemies(enemyType, count) {
        if (!this.player) return;
        
        for (let i = 0; i < count; i++) {
            // 在玩家周围随机位置生成
            const angle = Math.random() * Math.PI * 2;
            const distance = 200 + Math.random() * 300;
            const x = this.player.x + Math.cos(angle) * distance;
            const y = this.player.y + Math.sin(angle) * distance;
            
            switch(enemyType) {
                case 'normal':
                    this.enemies.push(new Enemy(x, y, this.state.wave));
                    break;
                case 'chaser':
                    this.enemies.push(new Chaser(x, y, this.state.wave));
                    break;
                case 'titan':
                    this.enemies.push(new Titan(x, y, this.state.wave));
                    break;
                case 'guardian':
                    this.guardians.push(new Guardian(x, y, x, y));
                    break;
            }
        }
        
        this.showMessage(`已生成 ${count} 个${this.getEnemyTypeName(enemyType)}`, '#ff6b6b');
    }
    
    // 获取敌人类型名称
    getEnemyTypeName(type) {
        const names = {
            'normal': '普通敌人',
            'chaser': '追身怪',
            'titan': '泰坦',
            'guardian': '宝箱守卫'
        };
        return names[type] || type;
    }
    
    // 切换无敌模式
    gmToggleGodMode() {
        if (!this.player) return;
        
        this.player.godMode = !this.player.godMode;
        if (this.player.godMode) {
            this.player.health = 999999;
            this.player.maxHealth = 999999;
            this.showMessage('无敌模式已开启', '#00ff00');
        } else {
            this.player.maxHealth = CONFIG.player.maxHealth + this.shopSystem.getUpgradeBonus('health');
            this.player.health = Math.min(this.player.health, this.player.maxHealth);
            this.showMessage('无敌模式已关闭', '#ff0000');
        }
    }
    
    // 添加经验
    gmAddExperience(amount) {
        if (!this.player) return;
        
        this.state.addExperience(amount);
        this.showMessage(`已添加 ${amount} 点经验`, '#ffd700');
        
        // 检查是否升级
        if (this.state.experience < this.state.experienceRequired) {
            this.showLevelUpScreen();
        }
        this.updateUI();
    }
    
    // 生成宝箱
    gmSpawnTreasure() {
        if (!this.player) return;
        
        // 在玩家周围生成宝箱
        const angle = Math.random() * Math.PI * 2;
        const distance = 300 + Math.random() * 200;
        const x = this.player.x + Math.cos(angle) * distance;
        const y = this.player.y + Math.sin(angle) * distance;
        
        this.treasureChest = new TreasureChest(x, y);
        this.showMessage('宝箱已生成', '#ffd700');
        
        // 显示宝箱提示
        this.treasurePopupTime = Date.now();
    }
    
    // 生成血包
    gmSpawnHealthPacks(count) {
        if (!this.player) return;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 200;
            const x = this.player.x + Math.cos(angle) * distance;
            const y = this.player.y + Math.sin(angle) * distance;
            
            this.healthPacks.push(new HealthPack(x, y));
        }
        
        this.showMessage(`已生成 ${count} 个血包`, '#ff4444');
    }
    
    // 添加升级
    gmAddUpgrade(upgradeType) {
        if (!this.player) return;
        
        // 直接调用applyUpgrade来应用升级效果
        this.applyUpgrade(upgradeType);
        
        // 获取升级名称用于显示消息
        const upgradeNames = {
            'armor': '装甲增强',
            'damage': '火力升级',
            'speed': '高速引擎',
            'multishot': '多门大炮',
            'bulletsize': '杀伤弹丸',
            'energyfield': '能量力场',
            'bulletsplit': '子弹分裂',
            'heavy': '冗余装甲',
            'agile': '敏捷装甲',
            'shield': '反应装甲',
            'guidedweapon': '制导武器',
            'drone': '忠诚僚机'
        };
        
        const upgradeName = upgradeNames[upgradeType];
        if (upgradeName) {
            this.showMessage(`已添加升级: ${upgradeName}`, '#00ff00');
        }
        
        this.updateUI();
        // 如果暂停界面打开，更新暂停界面
        if (this.state.isPaused) {
            this.showPauseScreen();
        }
    }
    
    // 移除升级
    gmRemoveUpgrade(upgradeType) {
        if (!this.player) return;
        
        const upgradeNames = {
            'armor': '装甲增强',
            'damage': '火力升级',
            'speed': '高速引擎',
            'multishot': '多门大炮',
            'bulletsize': '杀伤弹丸',
            'energyfield': '能量力场',
            'bulletsplit': '子弹分裂',
            'heavy': '冗余装甲',
            'agile': '敏捷装甲',
            'shield': '反应装甲',
            'guidedweapon': '制导武器',
            'drone': '忠诚僚机'
        };
        
        const upgradeName = upgradeNames[upgradeType];
        if (!upgradeName) return;
        
        // 反向应用升级效果
        switch(upgradeType) {
            case 'armor':
                const healthDecrease = this.player.maxHealth * 0.2;
                this.player.maxHealth = Math.max(100, this.player.maxHealth - healthDecrease);
                this.player.health = Math.min(this.player.health, this.player.maxHealth);
                break;
            case 'damage':
                this.player.damage = Math.max(20, Math.floor(this.player.damage / 1.2));
                break;
            case 'speed':
                this.player.baseMaxSpeed = Math.max(4.8, this.player.baseMaxSpeed / 1.2);
                this.player.maxSpeed = this.player.baseMaxSpeed;
                break;
            case 'multishot':
                this.player.bulletCount = Math.max(1, this.player.bulletCount - 1);
                break;
            case 'bulletsize':
                this.player.bulletSize = Math.max(5, this.player.bulletSize / 1.1);
                break;
            case 'bulletsplit':
                this.player.bulletSplitLevel = Math.max(0, this.player.bulletSplitLevel - 1);
                break;
            case 'heavy':
                this.player.size = Math.max(20, this.player.size / 1.2);
                const heavyHealthDecrease = this.player.maxHealth * 0.5;
                this.player.maxHealth = Math.max(100, this.player.maxHealth - heavyHealthDecrease);
                this.player.health = Math.min(this.player.health, this.player.maxHealth);
                this.player.baseMaxSpeed = this.player.baseMaxSpeed / 0.8;
                this.player.maxSpeed = this.player.baseMaxSpeed;
                break;
            case 'agile':
                this.player.size = this.player.size / 0.8;
                const agileHealthIncrease = this.player.maxHealth * 0.5;
                this.player.maxHealth += agileHealthIncrease;
                this.player.health += agileHealthIncrease;
                this.player.baseMaxSpeed = this.player.baseMaxSpeed / 1.3;
                this.player.maxSpeed = this.player.baseMaxSpeed;
                break;
            case 'shield':
                if (this.player.shields.length > 0) {
                    this.player.shields.pop();
                }
                break;
            case 'drone':
                if (this.player.drones.length > 0) {
                    this.player.drones.pop();
                }
                break;
            case 'energyfield':
                if (this.player.energyField.level > 1) {
                    this.player.energyField.level--;
                    this.player.energyField.damage = Math.max(10, this.player.energyField.damage - 5);
                    this.player.energyField.radius = Math.max(52, this.player.energyField.radius / 1.5);
                } else if (this.player.energyField.enabled) {
                    this.player.energyField.enabled = false;
                    this.player.energyField.level = 0;
                }
                break;
            case 'guidedweapon':
                if (this.player.guidedWeapon.level > 1) {
                    this.player.guidedWeapon.level--;
                    this.player.guidedWeapon.cooldown = Math.floor(this.player.guidedWeapon.baseCooldown * Math.pow(0.7, this.player.guidedWeapon.level));
                    this.player.guidedWeapon.damage = Math.floor(this.player.guidedWeapon.baseDamage * Math.pow(1.2, this.player.guidedWeapon.level));
                    this.player.guidedWeapon.missileCount = 1 + Math.floor(this.player.guidedWeapon.level / 3);
                } else if (this.player.guidedWeapon.enabled) {
                    this.player.guidedWeapon.enabled = false;
                    this.player.guidedWeapon.level = 0;
                }
                break;
        }
        
        // 从升级列表中移除
        const index = this.state.upgrades.indexOf(upgradeName);
        if (index > -1) {
            this.state.upgrades.splice(index, 1);
        }
        
        this.showMessage(`已移除升级: ${upgradeName}`, '#ff0000');
        this.updateUI();
        // 如果暂停界面打开，更新暂停界面
        if (this.state.isPaused) {
            this.showPauseScreen();
        }
    }
    
    // 激活遗物
    gmActivateRelic(relicType) {
        const relicNames = {
            'bulletSplit': '子弹分裂',
            'gravityCapture': '引力捕获',
            'advancedRepair': '高级修理'
        };
        const relicName = relicNames[relicType] || relicType;
        
        // 检查是否已激活
        if (this.shopSystem.isRelicActive(relicType)) {
            this.showMessage(`遗物"${relicName}"已经处于激活状态`, '#ffaa00');
            return;
        }
        
        // 激活遗物
        const success = this.shopSystem.activateRelic(relicType);
        if (success) {
            this.showMessage(`遗物"${relicName}"已激活`, '#00ff00');
            this.updateShopUI();
            // 如果暂停界面打开，更新暂停界面
            if (this.state.isPaused) {
                this.showPauseScreen();
            }
        }
    }
    
    // 关闭遗物
    gmDeactivateRelic(relicType) {
        const relicNames = {
            'bulletSplit': '子弹分裂',
            'gravityCapture': '引力捕获',
            'advancedRepair': '高级修理'
        };
        const relicName = relicNames[relicType] || relicType;
        
        // 检查是否已关闭
        if (!this.shopSystem.isRelicActive(relicType)) {
            this.showMessage(`遗物"${relicName}"已经处于关闭状态`, '#ffaa00');
            return;
        }
        
        // 关闭遗物
        const success = this.shopSystem.deactivateRelic(relicType);
        if (success) {
            this.showMessage(`遗物"${relicName}"已关闭`, '#ff0000');
            this.updateShopUI();
            // 如果暂停界面打开，更新暂停界面
            if (this.state.isPaused) {
                this.showPauseScreen();
            }
        }
    }
    
    // 应用属性修改
    gmApplyStats(stats) {
        if (!this.player) return;
        
        this.player.maxSpeed = stats.speed;
        this.player.baseMaxSpeed = stats.speed;
        this.player.damage = stats.damage;
        this.player.size = stats.size;
        this.player.maxHealth = stats.health;
        this.player.health = Math.min(this.player.health, this.player.maxHealth);
        
        this.showMessage('属性已应用', '#00ff00');
        this.updateUI();
    }
    
    // 重置属性
    gmResetStats() {
        if (!this.player) return;
        
        // 应用商店的永久升级作为基础
        const healthBonus = this.shopSystem.getUpgradeBonus('health');
        const speedBonus = this.shopSystem.getUpgradeBonus('speed');
        const damageBonus = this.shopSystem.getUpgradeBonus('damage');
        
        this.player.maxSpeed = 4.8 * (1 + speedBonus);
        this.player.baseMaxSpeed = 4.8 * (1 + speedBonus);
        this.player.damage = CONFIG.bullet.damage + damageBonus;
        this.player.size = CONFIG.player.size;
        this.player.maxHealth = CONFIG.player.maxHealth + healthBonus;
        this.player.health = this.player.maxHealth;
        this.player.bulletCount = CONFIG.player.bulletCount;
        this.player.shields = [];
        this.player.drones = [];
        
        // 清除额外升级
        this.state.upgrades = [];
        
        this.showMessage('属性已重置', '#ff9800');
        this.updateUI();
    }
    
    // 显示GM消息（使用现有的popup机制）
    showMessage(text, color = '#ffffff') {
        // 创建临时消息元素
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: ${color};
            padding: 20px 40px;
            border-radius: 10px;
            border: 2px solid ${color};
            font-size: 24px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 0 20px ${color};
            animation: fadeInOut 2s ease-in-out;
        `;
        message.textContent = text;
        document.body.appendChild(message);
        
        // 2秒后移除
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 2000);
    }
    
    // 关卡系统方法
    loadUnlockedStages() {
        const saved = localStorage.getItem('unlockedStages');
        if (saved) {
            return JSON.parse(saved);
        }
        return [1]; // 默认只解锁第一关
    }
    
    saveUnlockedStages() {
        localStorage.setItem('unlockedStages', JSON.stringify(this.unlockedStages));
    }
    
    unlockNextStage() {
        const nextStage = this.currentStage + 1;
        if (nextStage <= 10 && !this.unlockedStages.includes(nextStage)) {
            this.unlockedStages.push(nextStage);
            this.saveUnlockedStages();
            this.showMessage(`解锁新关卡：第${nextStage}关`, '#ffd700');
        }
    }
    
    showStageSelect() {
        document.getElementById('gameStart').classList.add('hidden');
        document.getElementById('stageSelectScreen').classList.remove('hidden');
        this.updateStageSelectUI();
    }
    
    updateStageSelectUI() {
        document.querySelectorAll('.stage-card').forEach(card => {
            const stage = parseInt(card.getAttribute('data-stage'));
            const isUnlocked = this.unlockedStages.includes(stage);
            
            card.setAttribute('data-unlocked', isUnlocked);
            
            const icon = card.querySelector('.stage-icon');
            const status = card.querySelector('.stage-status');
            
            if (isUnlocked) {
                icon.classList.remove('locked');
                status.classList.remove('locked');
                status.classList.add('unlocked');
                status.textContent = '已解锁';
            } else {
                icon.classList.add('locked');
                status.classList.add('locked');
                status.classList.remove('unlocked');
                status.textContent = '未解锁';
            }
        });
    }
    
    selectStage(stage) {
        this.currentStage = stage;
        document.getElementById('stageSelectScreen').classList.add('hidden');
        this.start();
    }
}

// 初始化游戏
const game = new Game();