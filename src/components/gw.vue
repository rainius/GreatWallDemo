<template>
  <div class="page-container">
    <div class="background-image">
      <!-- 使用require或import方式引入图片 -->
      
    </div>

    <div class="content-overlay"></div>

    <div class="header-bar">
      <span class="page-title">八达岭长城：数字导览</span>
      <router-link to="/" class="back-btn">
        <font-awesome-icon icon="arrow-left" /> 返回主页
      </router-link>
    </div>

    <div class="poi-indicator" @click="togglePoiInfo">
      <font-awesome-icon icon="location-dot" />
      <div class="poi-label">敌楼讲解点</div>
    </div>

    <div class="guide-area">
      <div class="speech-bubble" :class="{ hidden: !isGuideActive }">
        <strong>[Ether]</strong> {{ currentSpeech }}
      </div>

      <div class="toggle-switch" :class="{ active: isGuideActive }" @click="toggleGuide">
        <div class="toggle-switch-handle"></div>
      </div>

      <div class="digital-human-avatar" :class="{ hidden: !isGuideActive }">
        <!-- 数字人形象占位，可以替换为实际组件 -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GreatWallView',
  data() {
    return {
      isGuideActive: true,
      currentSpeech: '欢迎来到八达岭长城。您现在看到的是典型的"城墙+敌楼"结构。这不仅是军事防御，更是古代中国宏大工程的象征！',
      backgroundImage: require('@/assets/gw.jpeg') // 根据实际路径调整
    }
  },
  methods: {
    toggleGuide() {
      this.isGuideActive = !this.isGuideActive
      
      if (this.isGuideActive) {
        this.currentSpeech = '您好，数字导览已开启。请点击感兴趣的地点或听我继续讲解。'
      } else {
        this.currentSpeech = '导览已关闭。需要时随时开启。'
      }
    },
    togglePoiInfo() {
      // 这里可以添加点击兴趣点后的逻辑
      if (this.isGuideActive) {
        this.currentSpeech = '这是八达岭长城的敌楼，主要用于驻守士兵和存放武器。敌楼通常建在城墙的拐角处或制高点上。'
      }
    }
  },
  mounted() {
    // 组件挂载后的初始化逻辑
    console.log('GreatWallView component mounted')
  }
}
</script>

<style scoped>
/* --- 1. 基础样式与全局变量 --- */
:root {
  --bg-color: #000000;
  --accent-purple: #8b5cf6; 
  --text-white: #ffffff;
  --text-gray: #a1a1aa;
  --card-bg: rgba(0, 0, 0, 0.7); /* 半透明黑，用于信息卡片 */
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.page-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

/* --- 2. 沉浸式背景与遮罩 --- */
.background-image {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url('@/assets/gw.jpeg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* 移除背景图的变换效果 */
.page-container:hover .background-image {
  transform: none;
}

/* 沉浸感遮罩层 */
.content-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4); /* 40%透明度的黑，压住背景，突出前景文字 */
}

/* --- 3. 顶部信息栏 --- */
.header-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
}

.page-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-white);
  text-shadow: 0 0 10px rgba(139, 92, 246, 0.5); 
}

.back-btn {
  color: var(--text-gray);
  padding: 8px 15px;
  border: 1px solid var(--text-gray);
  border-radius: 4px;
  transition: 0.3s;
  font-size: 0.9rem;
}
.back-btn:hover { color: white; border-color: white; }

/* --- 4. 数字人形象与控制 (核心元素) --- */
.guide-area {
  position: fixed;
  right: 50px;
  bottom: 30px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

/* 数字人开关 */
.toggle-switch {
  width: 60px;
  height: 30px;
  background: #444;
  border-radius: 15px;
  position: relative;
  cursor: pointer;
  margin-bottom: 10px;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  transition: 0.3s;
}
.toggle-switch.active { background: var(--accent-purple); }

.toggle-switch-handle {
  width: 26px;
  height: 26px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: 0.3s;
}
.toggle-switch.active .toggle-switch-handle {
  transform: translateX(30px);
}

/* 数字人形象占位符 */
.digital-human-avatar {
  width: 180px; /* 尺寸适中 */
  height: 250px;
  background: radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.4) 0%, transparent 60%);
  border-radius: 8px;
  position: relative;
  box-shadow: 0 5px 25px rgba(0,0,0,0.5);
  transition: opacity 0.5s ease-in-out;
  opacity: 1; /* 默认显示 */
}
/* 隐藏状态 */
.digital-human-avatar.hidden { opacity: 0; pointer-events: none; }

.digital-human-avatar::after {
  content: '数字人 ETHER 形象占位';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.8rem;
  color: var(--text-gray);
  text-align: center;
}

/* 讲解气泡 */
.speech-bubble {
  width: 350px;
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  position: relative;
  font-size: 0.95rem;
  color: #e2e2e2;
  border-left: 3px solid var(--accent-purple);
  box-shadow: 0 5px 20px rgba(0,0,0,0.5);
  transition: all 0.5s ease-in-out;
  transform: translateY(10px);
}
/* 气泡三角箭头 */
.speech-bubble::after {
  content: '';
  position: absolute;
  right: 25px;
  bottom: -15px;
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 15px solid var(--card-bg);
}

/* 隐藏时的气泡 */
.speech-bubble.hidden { opacity: 0; transform: translateY(30px); pointer-events: none; }

/* --- 5. 核心内容点 (可选：用作讲解目标) --- */
.poi-indicator {
  position: absolute;
  top: 50%;
  left: 20%;
  color: white;
  z-index: 30;
  cursor: pointer;
  text-align: center;
}
.poi-indicator i {
  font-size: 2rem;
  color: #fca5a5;
  transition: 0.3s;
  filter: drop-shadow(0 0 5px black);
}
.poi-indicator:hover i { color: #f87171; transform: scale(1.1); }
.poi-label {
  background: rgba(0,0,0,0.7);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-top: 5px;
}

/* --- 6. 移动端适配 --- */
@media (max-width: 768px) {
  .header-bar { padding: 15px 20px; }
  .page-title { font-size: 1.4rem; }
  
  .guide-area {
    right: 10px;
    bottom: 10px;
    align-items: center;
  }
  .digital-human-avatar { width: 120px; height: 180px; }
  .speech-bubble { 
    width: 90vw; /* 占据大部分屏幕宽度 */
    margin-bottom: 10px;
    right: auto;
    left: 50%;
    transform: translateX(-50%); /* 居中 */
    font-size: 0.9rem;
  }
  .speech-bubble::after { display: none; } /* 移动端隐藏箭头，简化设计 */
  .poi-indicator { top: 70%; left: 10%; }
}
</style>