<template>
  <div class="tour-viewport">

    <!-- 1. 可拖拽的"世界"层 (图片 + POI) -->
    <div class="draggable-world" :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
      @mousedown="startDrag" @touchstart="startDrag" @mousemove="onDrag" @touchmove="onDrag" @mouseup="endDrag"
      @mouseleave="endDrag" @touchend="endDrag" ref="worldRef">
      <!-- 背景全景大图 -->
      <img :src="bgImage" alt="长城全景" class="panorama-bg" draggable="false" @load="initPositionTopRight" />

      <!-- POI 点 (现在是相对于图片的绝对定位) -->
      <!-- style 中的 top/left 使用百分比，确保永远钉在图片的特定位置 -->
      <div class="poi-marker" style="top: 18%; left: 88%;" @click.stop="handlePoiClick('北八楼', $event)">
        <div class="poi-icon-wrapper">
          <i class="fa-solid fa-location-dot"></i>
        </div>
        <div class="poi-label">北八楼讲解点</div>
      </div>

      <div class="poi-marker" style="top: 45%; left: 65%;" @click.stop="handlePoiClick('好汉坡', $event)">
        <div class="poi-icon-wrapper">
          <i class="fa-solid fa-location-dot"></i>
        </div>
        <div class="poi-label">好汉坡讲解点</div>
      </div>
    </div>

    <!-- 2. 固定 UI 层 (不受拖拽影响) -->
    <div class="ui-layer">
      <!-- 遮罩 (可选，增加氛围，不阻挡鼠标事件) -->
      <!-- <div class="vignette-overlay"></div> -->

      <!-- 顶部导航 -->
      <div class="header-bar">
        <span class="page-title">{{ title }}</span>
        <button class="back-btn" @click="goHome">
          <i class="fa-solid fa-arrow-left"></i> 返回
        </button>
      </div>

      <!-- 拖拽提示 (仅在初始显示) -->
      <!-- <div class="drag-hint" v-if="showHint">
        <i class="fa-solid fa-hand-pointer"></i> 拖拽探索全景
      </div> -->

      <!-- 数字人区域 -->
      <div class="guide-area">
        <!-- <div class="speech-bubble" :class="{ 'hidden': !isGuideActive }">
          <strong>[Ether]</strong> <span v-html="currentText"></span>
        </div> -->

        <div class="toggle-switch" :class="{ 'active': isGuideActive }" @click="togglePanel">
          <i class="fa-solid fa-robot"></i>
        </div>

        <div class="panel" :class="{ 'hidden': !isPanelOpen }">
          <button class="panel-btn" @click="switchModel('萧儿')">
            <i class="fa-solid fa-user"></i> 萧儿
          </button>
          <button class="panel-btn" @click="switchModel('芍药')">
            <i class="fa-solid fa-user"></i> 芍药
          </button>
          <button class="panel-btn" @click="toggleGuide">
            <i class="fa-solid fa-eye"></i> {{ isGuideActive ? '隐藏' : '展示' }}
          </button>
        </div>

        <div class="digital-human-avatar" :class="{ 'hidden': !isGuideActive }" :style="avatarStyle"
          @mousedown="startAvatarDrag" @touchstart="startAvatarDrag" @mousemove="onAvatarDrag" @touchmove="onAvatarDrag"
          @mouseup="endAvatarDrag" @touchend="endAvatarDrag" @mouseleave="endAvatarDrag" ref="avatarRef"
          >
          <div class="live2d-container" ref="live2dContainer">
            <canvas ref="canvas" id="live2d-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';

// @ 符号在 Vue 中通常代表 src 目录
import bgImage from '@/assets/gw.jpeg';

// eslint-disable-next-line no-undef
defineOptions({ name: 'DigitalTour' });

defineProps({
  title: { type: String, default: '八达岭长城：数字导览' },
});

// 引用canvas元素
const canvas = ref(null);
const live2dContainer = ref(null);
// 保存model引用以便在组件中使用
let model = null;
// let motionSync = null;
let app1 = null;
// 定义全局变量
let PIXI = null;
let live2d = null;

// --- 状态 ---
const isGuideActive = ref(true);
const isPanelOpen = ref(true);
const currentText = ref('欢迎来到八达岭。这张全景图包含了长城的精华路段。您可以<b>拖动屏幕</b>来自由浏览，寻找发光的讲解点。');
const showHint = ref(true);

// --- 拖拽逻辑 ---
const worldRef = ref(null);
const position = reactive({ x: -200, y: -100 }); // 初始偏移量，让画面居中一点
const isDragging = ref(false);
const startPos = { x: 0, y: 0 };
const lastPos = { x: 0, y: 0 };

// 获取事件坐标 (兼容鼠标和触摸)
const getClientCoords = (e) => {
  if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
};

const startDrag = (e) => {
  isDragging.value = true;
  showHint.value = false; // 开始拖拽后隐藏提示
  const coords = getClientCoords(e);
  startPos.x = coords.x;
  startPos.y = coords.y;
  lastPos.x = position.x;
  lastPos.y = position.y;
};

const onDrag = (e) => {
  if (!isDragging.value || !worldRef.value) return;
  e.preventDefault();

  const coords = getClientCoords(e);
  const deltaX = coords.x - startPos.x;
  const deltaY = coords.y - startPos.y;

  // 1. 计算原本想移动到的位置
  let newX = lastPos.x + deltaX;
  let newY = lastPos.y + deltaY;

  // 2. 获取当前视口和图片的尺寸
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const worldW = worldRef.value.offsetWidth; // 图片(容器)的实际宽度
  const worldH = worldRef.value.offsetHeight; // 图片(容器)的实际高度

  // 3. 计算 X 轴边界
  // 如果图片比窗口宽，才允许拖动，否则居中或固定
  if (worldW > viewportW) {
    const minX = viewportW - worldW; // 右边界极限 (负数)
    const maxX = 0;                  // 左边界极限
    // Math.max 取下限，Math.min 取上限，实现限制
    newX = Math.min(Math.max(newX, minX), maxX);
  } else {
    newX = (viewportW - worldW) / 2; // 图片不够宽时强制居中
  }

  // 4. 计算 Y 轴边界
  if (worldH > viewportH) {
    const minY = viewportH - worldH; // 下边界极限
    const maxY = 0;                  // 上边界极限
    newY = Math.min(Math.max(newY, minY), maxY);
  } else {
    newY = (viewportH - worldH) / 2; // 图片不够高时强制居中
  }

  // 5. 应用位置
  position.x = newX;
  position.y = newY;
};


const endDrag = () => {
  isDragging.value = false;
};

// --- 业务逻辑 ---
const togglePanel = () => {
  isPanelOpen.value = !isPanelOpen.value;
};

const toggleGuide = () => {
  isGuideActive.value = !isGuideActive.value;
  isPanelOpen.value = false;
  if (isGuideActive.value) {
    currentText.value = "导览已继续。拖动画面寻找下一个景点吧。";
  }
};

const XIAOER_MODEL_PATH = "./models/萧儿/萧儿 -全身.model3.json";
const XIAOER_MODEL_SCALE = 0.09;
const XIAOER_MODEL_X = -28;
const XIAOER_MODEL_Y = -40;

// const XIAOER_AUDIO_PATH = "./models/萧儿/萧儿声音.mp3";
const SHAOYAO_MODEL_PATH = "./models/芍药/芍药身体运动.model3.json";
const SHAOYAO_MODEL_SCALE = 0.11;
const SHAOYAO_MODEL_X = -25;
const SHAOYAO_MODEL_Y = -10;
// const SHAOYAO_AUDIO_PATH = "./models/芍药/芍药声音.mp3";

const loadModel = async (model_path, model_scale = 0.5, x = 0, y = 0) => {
  try {
    const modelPath = model_path;
    const loadedModel2 = await live2d.Live2DModel.from(modelPath, { autoInteract: true });

    // loadedModel2.pivot.set(0.5, 1); // 锚点设为底部中心
    loadedModel2.position.x = x
    loadedModel2.position.y = y


    // motionSync = new MotionSync(loadedModel2.internalModel);
    // motionSync.loadMotionSyncFromUrl("./models/蓝风铃/铃兰分层.motionsync3.json");

    // 设置模型大小和位置...
    // const containerWidth = live2dContainer.value.clientWidth;

    // const scale = containerWidth / loadedModel2.width;

    console.log("缩放比例", model_scale);
    loadedModel2.scale.set(model_scale);
    model = loadedModel2;
    // 设置点击事件
    loadedModel2.on("hit", (hitAreas) => {
      if (hitAreas.includes("Body")) {
        loadedModel2.motion("Tap");
      }
      if (hitAreas.includes("Head")) {
        loadedModel2.expression();
      }
    });
    app1.stage.addChild(loadedModel2);
  } catch (error) {
    console.error(error);
  }
};

const switchModel = async (modelName) => {
  console.log(`切换到数字人: ${modelName}`);
  isPanelOpen.value = false;
  isGuideActive.value = true; // 切换模型时自动显示数字人
  // 这里可以添加切换数字人的逻辑
  try {
    // 清除当前模型
    if (model) {
      app1.stage.removeChild(model);
      model.destroy();
    }

    const modelPath = modelName === '萧儿' ? XIAOER_MODEL_PATH : SHAOYAO_MODEL_PATH;
    const modelScale = modelName === '萧儿' ? XIAOER_MODEL_SCALE : SHAOYAO_MODEL_SCALE;
    const x = modelName === '萧儿' ? XIAOER_MODEL_X : SHAOYAO_MODEL_X;
    const y = modelName === '萧儿' ? XIAOER_MODEL_Y : SHAOYAO_MODEL_Y;
    loadModel(modelPath, modelScale, x, y);
  } catch (error) {
    console.error("切换模型失败:", error);
  }
};


// --- 新增状态 ---
// 用来控制数字人的位置样式
const avatarStyle = reactive({
  position: 'fixed', // 必须是 fixed，这样才能统一坐标系
  bottom: '20px',    // 默认停靠在右下角
  right: '20px',
  left: 'auto',      // 清除 left
  top: 'auto',       // 清除 top
  transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)', // 添加平滑飞行效果
  zIndex: 200        // 保证在最上层
});

const isDocked = ref(true); // 标记是否在默认位置
// const avatarRef = ref(null);
const handlePoiClick = async (name, event) => {
  if (isDragging.value) return; // 防止拖拽误触

  // 1. 激活导览
  // 1. 激活显示 (如果之前是隐藏的，需要先显示才能获取宽度)
  if (!isGuideActive.value) {
    isGuideActive.value = true;
    await nextTick(); // 等待 DOM 渲染出 display:block
  }

  isPanelOpen.value = false;

  // 2. 获取点击目标的屏幕坐标
  // event.currentTarget 确保拿到的是 .poi-marker 元素，而不是里面的图标
  const targetEl = event.currentTarget;
  const rect = targetEl.getBoundingClientRect();

  // rect.top / rect.left 就是该元素相对于屏幕左上角的像素位置
  console.log('POI屏幕坐标:', rect.top, rect.left);

  // 3. 计算数字人应该飞去的目标位置
  // --- 关键修正 1: 获取数字人容器的【真实渲染宽度】 ---
  // 如果获取失败，回退到 200 (比 CSS 里的 180 大一点，宁宽勿窄)
  const realAvatarWidth = avatarRef.value?.offsetWidth || 200;
  const realAvatarHeight = avatarRef.value?.offsetHeight || 220;

  console.log(`数字人真实尺寸: ${realAvatarWidth}x${realAvatarHeight}`);

  // --- 关键修正 2: 坐标计算逻辑 ---
  const poiCenterX = rect.left + rect.width / 2;
  const poiCenterY = rect.top + rect.height / 2;
  const viewportW = window.innerWidth;
  
  // 安全半径：增加一点，设为 70px
  const safeRadius = 70; 

  let targetX, targetY;

  // X 轴计算
  if (poiCenterX < viewportW / 2) {
    // POI 在左半屏 -> 数字人去右边
    // 目标 Left = POI中心 + 半径
    targetX = poiCenterX + safeRadius + realAvatarWidth;
  } else {
    // POI 在右半屏 -> 数字人去左边
    // 目标 Left = POI中心 - 半径 - 数字人真实宽度
    targetX = poiCenterX - safeRadius - realAvatarWidth;
  }

  // Y 轴计算 (垂直居中)
  targetY = poiCenterY - (realAvatarHeight / 2);

  // 边界保护
  const padding = 20;
  const topHeaderHeight = 80;
  
  // 防止飞出左/右边界
  if (targetX < padding) targetX = padding;
  if (targetX + realAvatarWidth > viewportW - padding) targetX = viewportW - realAvatarWidth - padding;

  // 防止飞出上/下边界
  if (targetY < topHeaderHeight) targetY = topHeaderHeight;
  if (targetY + realAvatarHeight > window.innerHeight - padding) targetY = window.innerHeight - realAvatarHeight - padding;

  // --- 关键修正 3: 状态重置与应用 ---
  isDocked.value = false;

  // 先清除 bottom/right，确保 top/left 优先级最高
  // 注意：不需要 await nextTick，直接赋值即可，Vue 会合并更新
  avatarStyle.bottom = 'auto';
  avatarStyle.right = 'auto';
  
  // 直接应用计算出的绝对坐标
  avatarStyle.left = `${targetX}px`;
  avatarStyle.top = `${targetY}px`;

  // 5. 播放讲解逻辑 (保持不变)
  // let spk = "";
  // if (name === '北八楼') {
  //   currentText.value = "这是<b>北八楼</b>...";
  //   spk = "./beibalou.mp3";
  // } else if (name === '好汉坡') {
  //   currentText.value = "不到长城非好汉！...";
  //   spk = "./haohanpo.mp3";
  // }
  // playTestAudio(spk);
};


// --- 新增：重置位置函数 (可选) ---
// 比如点击背景或者点击关闭导览时，飞回右下角
// eslint-disable-next-line
const resetAvatarPosition = () => {
  if (isDocked.value) return;
  
  isDocked.value = true;
  // 先把当前位置定死，防止样式切换时的瞬移（可选优化）
  
  // 切换回 Right/Bottom 定位
  // 注意：CSS transition 会处理从 left/top 到 right/bottom 的插值吗？
  // 通常浏览器处理 left/right 混合过渡效果不好。
  // 建议：始终使用 left/top 定位，或者计算出右下角的 left/top 坐标。
  
  // 简单方案：直接切回 class 控制，或者如下：
  avatarStyle.left = window.innerWidth - 180 - 20 + 'px'; // 屏幕宽 - 头像宽 - margin
  avatarStyle.top = window.innerHeight - 180 - 20 + 'px'; // 屏幕高 - 头像高 - margin
  
  // 稍微延迟后清空 style，恢复响应式布局（可选）
  setTimeout(() => {
     avatarStyle.left = 'auto';
     avatarStyle.top = 'auto';
     avatarStyle.right = '20px';
     avatarStyle.bottom = '20px';
  }, 800); // 等动画播完
};

const goHome = () => { console.log("返回主页"); };



// 初始化：设置一个合适的初始位置（例如居中）
onMounted(() => {
  // 实际项目中可以计算图片宽度居中，这里暂时写死
  // 确保所需的库已经在全局可用
  PIXI = window.PIXI;
  live2d = PIXI.live2d;

  if (!PIXI || !live2d) {
    console.error("PIXI或live2d库未加载");
    return;
  }

  try {
    // 创建第一个应用和渲染上下文
    app1 = new PIXI.Application({
      view: canvas.value,
      autoStart: true,
      resizeTo: live2dContainer.value,
      autoResize: true,
      transparent: true,
      backgroundAlpha: 0,
      antialias: true,
    });

  } catch (error) {
    console.error(error);
  }

  setTimeout(loadModel, 3000, XIAOER_MODEL_PATH, XIAOER_MODEL_SCALE, XIAOER_MODEL_X, XIAOER_MODEL_Y); // 500毫秒延迟
});



const isPlaying = ref(false);
// 播放测试音频
// eslint-disable-next-line
const playTestAudio = (spk) => {
  console.log("播放测试音频");
  console.log(model);
  console.log(model.speak);
  if (model) {
    if (isPlaying.value) {
      // Stop the current playback
      // model.stopSpeak();
      isPlaying.value = false;
      console.log("已停止播放音频");
    } else {
      // 使用模型说话功能播放音频
      model.speak(spk, {
        volume: 1,
        expression: 8,
        resetExpression: true,
        crossOrigin: "anonymous",
      });
      // isPlaying.value = true;
    }
    // motionSync.play("./1.wav").then(() => {
    //   console.log("play end");
    // });
  } else {
    console.warn("模型未加载，无法播放音频");
  }
};

// --- 修改：初始化位置为右上角 ---
const initPositionTopRight = () => {
  if (!worldRef.value) return;

  // 稍微延迟确保 DOM 尺寸计算完成
  setTimeout(() => {
    const viewportW = window.innerWidth;
    // const viewportH = window.innerHeight; // 上对齐不需要用到屏幕高度
    const worldW = worldRef.value.offsetWidth;

    // 计算 X 轴：(屏幕宽 - 图片宽) = 图片右边缘贴合屏幕右边缘
    // 假设屏幕1000，图片3000，结果是 -2000，即向左偏移2000，显示最右侧内容
    position.x = viewportW - worldW;

    // 计算 Y 轴：0 = 图片上边缘贴合屏幕上边缘
    position.y = 0;

    // 重要：同步更新 lastPos，防止第一次拖动时位置跳变
    lastPos.x = position.x;
    lastPos.y = position.y;
  }, 100); // 100ms 延迟比较稳妥
};


// 数字人容器的拖拽逻辑
const avatarRef = ref(null);
const isDraggingAvatar = ref(false);
const avatarStartPos = { x: 0, y: 0 };
const avatarCurrentPos = reactive({ x: 0, y: 0 });

const startAvatarDrag = (e) => {
  isDraggingAvatar.value = true;
  const coords = getClientCoords(e);
  avatarStartPos.x = coords.x - avatarCurrentPos.x;
  avatarStartPos.y = coords.y - avatarCurrentPos.y;
};

const onAvatarDrag = (e) => {
  if (!isDraggingAvatar.value) return;
  e.preventDefault();
  const coords = getClientCoords(e);
  avatarCurrentPos.x = coords.x - avatarStartPos.x;
  avatarCurrentPos.y = coords.y - avatarStartPos.y;
};

const endAvatarDrag = () => {
  isDraggingAvatar.value = false;
};

</script>

<style scoped>
/* 引入图标库 */
@import url('https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css');

/* --- 1. 视口容器 --- */
.tour-viewport {
  /* --- 关键修改：从 relative 改为 fixed --- */
  position: fixed;
  /* 强制固定在窗口，脱离父级元素的 padding/margin 干扰 */
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;

  /* --- 保持原有的 --- */
  overflow: hidden;
  /* 彻底禁止滚动条 */
  background-color: #111;
  cursor: grab;
  user-select: none;
  z-index: 999;
  /* 确保层级最高，盖住原有的页面内容 */
}

.tour-viewport:active {
  cursor: grabbing;
}

/* --- 2. 可拖拽的世界层 --- */
.draggable-world {
  position: absolute;
  top: 0;
  left: 0;
  /* 必须保证图片够大，这里不设宽高，由内容撑开 */
  transform-origin: 0 0;
  will-change: transform;
  /* 性能优化 */
}

.panorama-bg {
  /* 强制图片不缩放，保持原始分辨率或设为极高宽度 */
  height: 120vh;
  /* 略高于屏幕，允许上下拖动 */
  width: auto;
  /* 宽度自适应 */
  min-width: 150vw;
  /* 保证宽度足够横向拖动 */
  object-fit: cover;
  display: block;
  pointer-events: none;
  /* 禁止图片本身的拖拽行为干扰 */
}

/* --- 3. POI 标记 (绝对定位在世界层中) --- */
.poi-marker {
  position: absolute;
  /* 坐标由内联样式 style 控制 (百分比) */
  z-index: 10;
  cursor: pointer;
  transform: translate(-50%, -100%);
  /* 让锚点在图标底部中心 */
  display: flex;
  flex-direction: column;
  align-items: center;
}

.poi-icon-wrapper {
  position: relative;
  color: #f87171;
  font-size: 2.5rem;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
}

.poi-marker:hover .poi-icon-wrapper {
  transform: scale(1.2) translateY(-10px);
  color: #ef4444;
}

/* 呼吸动画圆环 */
.poi-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #f87171;
  opacity: 0;
  animation: pulse 2s infinite;
}

.poi-label {
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.85rem;
  white-space: nowrap;
  backdrop-filter: blur(4px);
  pointer-events: none;
  /* 防止遮挡点击 */
}

/* --- 4. UI 层 (固定悬浮) --- */
.ui-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* 让点击穿透 UI 层，直达下方的拖拽层 */
  z-index: 100;
}

/* 让 UI 层里的按钮和交互元素恢复点击 */
.header-bar,
.guide-area,
.back-btn {
  pointer-events: auto;
}

.vignette-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, transparent 50%, rgba(0, 0, 0, 0.6) 100%);
  z-index: -1;
}

/* --- 顶部导航栏 --- */
.header-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  /* 占满屏幕宽度 */

  /* --- 关键修复：让 padding 包含在宽度内，防止溢出 --- */
  box-sizing: border-box;
  padding: 20px 40px;
  /* 默认内边距 */

  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
  z-index: 10;
  pointer-events: auto;
  /* 确保可以点击 */
}

.page-title {
  color: white;
  font-weight: 700;
  font-size: 1.5rem;
  text-shadow: 0 0 10px rgba(139, 92, 246, 0.5);

  /* 防止标题过长挤掉按钮 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 20px;
  /* 给右边按钮留出间隙 */
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: 0.3s;

  /* --- 关键修复：禁止按钮被压缩 --- */
  flex-shrink: 0;
  white-space: nowrap;
  /* 禁止文字换行 */
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

.back-btn:hover {
  background: white;
  color: black;
}

/* 拖拽提示 */
.drag-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.7);
  border: 1px dashed rgba(255, 255, 255, 0.3);
  padding: 15px 30px;
  border-radius: 30px;
  animation: fadeOut 0.5s 3s forwards;
  /* 3秒后自动消失 */
  pointer-events: none;
}

/* 数字人区域 (与之前相同) */
.guide-area {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  /* 允许点击穿透到背景层 */
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-end;
  gap: 10px;
  z-index: 100;
  /* 确保 UI 层在背景层之上 */
}

/* 恢复内部交互元素的点击事件 */

.toggle-switch,
.digital-human-avatar {
  pointer-events: auto;
}

.digital-human-avatar {

  /* 1. 尺寸改为正方形，稍微小一点 */
  width: 160px;
  height: 160px;
  /* 2. 圆形裁剪 */
  border-radius: 50%;
  overflow: hidden;
  /* 关键：超出圆形的部分会被切掉 */
  /* 3. 干净的背景 */
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  /* 柔和的浅灰蓝渐变 */
  /* 或者纯白背景： background: rgba(255, 255, 255, 0.9); */
  /* 4. 边框装饰 */
  border: 4px solid #fff;
  box-shadow:
    0 0 0 2px #8b5cf6,
    /* 外层紫色细环 */
    0 10px 20px rgba(0, 0, 0, 0.3);
  /* 强投影 */

  position: absolute;
  left: 50vw;
  /* 使用视口单位确保居中 */
  /* 水平居中 */
  bottom: 40px;
  /* 保持在底部 */
  transform: translateX(-50%);
  /* background: radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.4) 0%, transparent 100%); */
  /* border-radius: 8px; */
  cursor: grab;
  transition: transform 0.5s ease-out;
  /* 平滑过渡效果 */
  user-select: none;
  display: inline-block;

  /* 关键：增加 z-index，防止被遮挡 */
  z-index: 200; 
  /* 确保 transition 存在，这样坐标变化时才会“飞”过去 */
  transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);

}

.digital-human-avatar::after {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ccc;
  font-size: 0.8rem;
}

.digital-human-avatar.hidden {
  opacity: 0;
  transform: scale(0.5) translateY(20px);
  /* 缩小并下沉消失 */
  pointer-events: none;
}

.live2d-container {
  width: 160px;
  /* 设置数字人容器的初始宽度 */
  height: 160px;
  /* 设置数字人容器的初始高度 */
  position: relative;
}

.speech-bubble {
  width: 320px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 15px;
  color: #fff;
  font-size: 0.9rem;
  border-left: 3px solid #8b5cf6;
  transition: 0.3s;
}

.speech-bubble.hidden {
  opacity: 0;
  transform: translateY(20px);
}

.toggle-switch {
  right: 40px;
  /* 距离右侧 20px */
  bottom: 20px;
  /* 距离底部 20px */
  width: 50px;
  height: 50px;
  background: #444;
  border-radius: 50%;
  position: absolute;
  cursor: pointer;
  margin-bottom: 10px;
  transition: 0.3s;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.toggle-switch.active {
  background: linear-gradient(135deg, #8b5cf6, #3b82f6);
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.5);
}

.toggle-switch i {
  color: white;
  font-size: 1.2rem;
}

.panel {
  position: absolute;
  bottom: 85px;
  right: 50px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
  transition: 0.3s;
  backdrop-filter: blur(10px);
  pointer-events: auto;
}

.panel.hidden {
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
}

.panel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: 0.2s;
}

.panel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 动画 */
@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.8;
  }

  100% {
    transform: translate(-50%, -50%) scale(2);
    opacity: 0;
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
    visibility: hidden;
  }
}

/* 移动端适配 */
/* --- 移动端/小屏幕适配 --- */
@media (max-width: 768px) {
  .header-bar {
    /* 小屏幕减小内边距，留给内容更多空间 */
    padding: 15px 15px;
  }

  .page-title {
    font-size: 1.1rem;
    /* 缩小标题字号 */
  }

  .back-btn {
    padding: 6px 12px;
    /* 缩小按钮尺寸 */
    font-size: 0.8rem;
  }
}
</style>
