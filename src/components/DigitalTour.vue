<template>
  <div class="tour-viewport">

    <!-- 1. 可拖拽的"世界"层 (图片 + POI) -->
    <div class="unity-wrapper">
      <!-- 1. 定义 Canvas -->
      <canvas ref="canvasRef" id="unity-canvas"></canvas>

      <!-- 2. (可选) 加载进度条 -->
      <div v-if="!isLoaded" class="loading-overlay">
        加载中... {{ Math.round(progress * 100) }}%
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
          <button class="panel-btn" @click="switchModel('杜梨花')">
            <i class="fa-solid fa-user"></i> 杜梨花
          </button>
          <button class="panel-btn" @click="switchModel('芍药')">
            <i class="fa-solid fa-user"></i> 芍药
          </button>
          <button class="panel-btn" @click="toggleGuide">
            <i class="fa-solid fa-eye"></i> {{ isGuideActive ? '隐藏' : '展示' }}
          </button>
        </div>

        <!-- 1. 字幕面板 (移到了这里，与 Avatar 并列) -->
        <!-- 绑定新的样式对象 :style="subtitleStyle" -->
        <div class="subtitle-panel" :class="{ 'collapsed': !isBubbleExpanded, 'hidden': !isGuideActive }"
            @mousedown.stop @touchstart.stop>

          <div class="subtitle-header" @click="toggleBubble">
            <span class="role-badge">{{ currentBadgeText }}</span>
            <button class="collapse-btn">
              <i class="fa-solid" :class="isBubbleExpanded ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
            </button>
          </div>

          <div class="subtitle-content" v-show="isBubbleExpanded">
            <span v-html="displayedText"></span>
          </div>
        </div>


        <div class="digital-human-avatar" :class="{ 'hidden': !isGuideActive }" :style="avatarStyle"
          @mousedown="startAvatarDrag" @touchstart="startAvatarDrag" @mousemove="onAvatarDrag" @touchmove="onAvatarDrag"
          @mouseup="endAvatarDrag" @touchend="endAvatarDrag" @mouseleave="endAvatarDrag" ref="avatarRef">


          <div class="live2d-container" ref="live2dContainer">
            <canvas ref="canvas" id="live2d-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useUnity } from '@/composables/useUnity';

// eslint-disable-next-line no-undef
defineOptions({ name: 'DigitalTour' });

defineProps({
  title: { type: String, default: '八达岭长城：数字导览' },
});

const canvasRef = ref(null);

// 使用刚才封装的 hook
const { loadUnity, isLoaded, progress } = useUnity(canvasRef);

// --- 处理 Unity 点击回调 ---
const handleUnityClick = (id) => {
  console.log("Vue 收到 Unity 点击 ID:", id);
  // 这里可以写你的业务逻辑，比如打开弹窗
  let name = "北八楼";
  if (id === "btn_B8L") {
    name = "北八楼";
  } else if (id === "btn_HHP") {
    name = "好汉坡";
  } else if (id === "btn_start") {
    name = "八达岭长城";
  }
  handlePoiClick(name);
};

// 引用canvas元素
const canvas = ref(null);
const live2dContainer = ref(null);
// 保存model引用以便在组件中使用
let model = null;
let modelName = null;
// let motionSync = null;
let app1 = null;
// 定义全局变量
let PIXI = null;
let live2d = null;

// --- 状态 ---
const isGuideActive = ref(true);
const isPanelOpen = ref(true);
const currentText = ref('八达岭长城坐落于北京延庆的军都山关沟古道北口，是明长城中保存完整、开放最早的精华段。这座雄关自古便是护卫京师的战略要冲，素有“北门锁钥”之称，其巍峨城墙盘旋于山脊，宛若巨龙，展现了古代军事防御工程的智慧。如今，它已成为世界文化遗产，是中外游客领略中华文明的重要窗口。');

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

const XIAOER_MODEL_PATH = "./models/杜梨花/杜梨花合并稿1.model3.json";
const XIAOER_AUDIO_BBL = "./beibalou_dlh.mp3"
const XIAOER_AUDIO_HHP = "./haohanpo_dlh.mp3"
const XIAOER_AUDIO_BDL = "./badaling_dlh.mp3"
const XIAOER_MODEL_SCALE = 0.11;
const XIAOER_MODEL_X = -25;
const XIAOER_MODEL_Y = -10;

// const XIAOER_AUDIO_PATH = "./models/萧儿/萧儿声音.mp3";
const SHAOYAO_MODEL_PATH = "./models/芍药/芍药身体运动.model3.json";
const SHAOYAO_AUDIO_BBL = "./beibalou.mp3"
const SHAOYAO_AUDIO_HHP = "./haohanpo.mp3"
const SHAOYAO_AUDIO_BDL = "./badaling.mp3"
const SHAOYAO_MODEL_SCALE = 0.11;
const SHAOYAO_MODEL_X = -25;
const SHAOYAO_MODEL_Y = -10;
// const SHAOYAO_AUDIO_PATH = "./models/芍药/芍药声音.mp3";

const B8L_CONTENT = "八达岭长城制高点北八楼，海拔高度约888米。这座敌楼是明代长城防御体系的核心枢纽，因其地势最高，素有“观日台”之称。楼体结构上，北八楼的箭窗数量居全线之冠，便于守军瞭望关沟古道，一旦发现敌情，烽火可迅速传至居庸关。站在此处俯瞰群山苍茫，城墙如脊梁蜿蜒于山巅，堪称玉关天堑的缩影！";
const HHP_CONTENT = "好汉坡这段陡坡通往北八楼，坡度近70°，是体能与意志的双重挑战。坡顶矗立着“不到长城非好汉”石碑，源自毛主席诗词，寓意攀登者皆为英雄。古人巧妙利用山势，将台阶设计为高差不一的乱序阶高，以阻挠敌军骑兵冲锋。您脚下的每块条石重达千斤，当年劳动人民凭借肩扛手抬筑就此景，登顶后可尽览群山苍茫，感受千年历史的壮阔。";
const START_CONTENT = "八达岭长城坐落于北京延庆的军都山关沟古道北口，是明长城中保存最完整、开放最早的精华段。这座雄关自古便是护卫京师的战略要冲，素有“北门锁钥”之称。其巍峨城墙盘旋于山脊，宛若巨龙，展现了古代军事防御工程的智慧。如今，它已成为世界文化遗产，是中外游客领略中华文明的重要窗口。";

const loadModel = async (model_path, model_scale = 0.5, x = 0, y = 0) => {
  try {
    const modelPath = model_path;
    const loadedModel2 = await live2d.Live2DModel.from(modelPath, { autoInteract: true });

    // loadedModel2.pivot.set(0.5, 1); // 锚点设为底部中心
    loadedModel2.position.x = x
    loadedModel2.position.y = y


    // motionSync = new MotionSync(loadedModel2.internalModel);
    // motionSync.loadMotionSyncFromUrl("./models/蓝风铃/铃兰分层.motionsync3.json");

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

const switchModel = async (name) => {
  console.log(`切换到数字人: ${name}`);
  modelName = name;

  const modelPath = modelName === '杜梨花' ? XIAOER_MODEL_PATH : SHAOYAO_MODEL_PATH;
  const modelScale = modelName === '杜梨花' ? XIAOER_MODEL_SCALE : SHAOYAO_MODEL_SCALE;
  const x = modelName === '杜梨花' ? XIAOER_MODEL_X : SHAOYAO_MODEL_X;
  const y = modelName === '杜梨花' ? XIAOER_MODEL_Y : SHAOYAO_MODEL_Y;

  isPanelOpen.value = false;
  isGuideActive.value = true; // 切换模型时自动显示数字人
  // 这里可以添加切换数字人的逻辑
  try {
    // 清除当前模型
    if (model) {
      app1.stage.removeChild(model);
      model.destroy();
    }
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
  right: '180px',
  left: 'auto',      // 清除 left
  top: 'auto',       // 清除 top
  transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)', // 添加平滑飞行效果
  zIndex: 200,       // 保证在最上层
  // 确保鼠标手势正确
  cursor: 'grab',
  touchAction: 'none', // 关键：防止手机端拖拽时触发页面滚动
  // 【新增】强制重置可能导致跳变的属性
  margin: '0px',
  transform: 'none'
});

const isDocked = ref(true); // 标记是否在默认位置
// 定义徽章文字，默认可以是当前模型名字，或者“导览员”
const currentBadgeText = ref(null);
// const avatarRef = ref(null);
// eslint-disable-next-line
const handlePoiClick = (name) => {
  console.log("handlePoiClick", name);
  currentBadgeText.value = name; 
  // 1. 准备音频路径 (先做逻辑计算)
  let spk = "";
  // 注意：这里用 currentModelName 替代 modelName，确保变量名正确
  // 假设你有一个变量存着当前是哪个数字人
  let content = ""; 
  console.log("modelName", modelName);
  console.log(`切换到数字人: ${name}`);
  if (name === '北八楼') {
    content = B8L_CONTENT;
    spk = modelName === '杜梨花' ? XIAOER_AUDIO_BBL : SHAOYAO_AUDIO_BBL;
  } else if (name === '好汉坡') {
    content = HHP_CONTENT;
    spk = modelName === '杜梨花' ? XIAOER_AUDIO_HHP : SHAOYAO_AUDIO_HHP;
  } else if (name === '八达岭长城') {
    content = START_CONTENT;
    spk = modelName === '杜梨花' ? XIAOER_AUDIO_BDL : SHAOYAO_AUDIO_BDL;
  }
  

  // 【关键】启动打字机
  // 速度 50ms/字，越小越快
  typeWriter(content, 50); 
  
  // 确保字幕面板展开
  isBubbleExpanded.value = true;

  // 2. 【关键】立即触发音频播放 (不要 await)
  // 这样浏览器能明确知道这是点击事件的一部分
  playTestAudio(spk);

  // 3. 处理 UI 显示 (UI更新可以慢一点，没关系)
  if (!isGuideActive.value) {
    isGuideActive.value = true;
    // 如果你需要基于 DOM 尺寸做飞行动画，可以在这里用 nextTick
    nextTick(() => {
      // 这里放那些需要 DOM 宽高的飞行动画逻辑
      // updateAvatarPosition(...); 
    });
  }
  isPanelOpen.value = false;
};

// --- 打字机效果变量 ---
const displayedText = ref(''); // 界面上实际绑定的变量
let typeWriterTimer = null;    // 计时器引用，用于打断

// --- 打字机核心函数 ---
// fullText: 完整内容的 HTML 字符串
// speed: 打字速度 (毫秒/字)
const typeWriter = (fullText, speed = 50) => {
  // 1. 如果有正在进行的打字任务，先清除
  if (typeWriterTimer) {
    clearInterval(typeWriterTimer);
    typeWriterTimer = null;
  }

  // 2. 初始化
  displayedText.value = ''; // 先清空
  let index = 0;
  
  // 3. 处理 HTML 标签 (进阶优化)
  // 如果文本包含 <b> 等标签，逐字打印会破坏 HTML 结构。
  // 简单方案：先剥离 HTML 标签只打印纯文本，或者假设文本是纯文本。
  // 这里的方案是：简单处理，假设 fullText 是纯文本或者你可以接受标签被当作文本逐个打出来（不推荐）。
  
  // --- 推荐方案：纯文本打字机 + 最终渲染 HTML ---
  // 为了简单起见，我们先假设输入的是纯文本。
  // 如果必须包含 HTML (如 <b>北八楼</b>)，逻辑会很复杂。
  // 建议：打字过程中不渲染 HTML 样式，打完后再替换为带样式的 HTML。
  
  // 这里使用一个更通用的“纯文本逐字”逻辑：
  // 如果你的 currentText 里有 HTML 标签，建议在打字时先去除标签，或者使用更复杂的库。
  // 下面演示最通用的“逐字追加”逻辑：

  // const plainText = fullText.replace(/<[^>]+>/g, ''); // 提取纯文本用于计算长度(可选)
  // 实际打印还是用 fullText，但要注意标签闭合问题。
  // 简易版：直接逐字打印 fullText (可能会看到 <b> 源码一闪而过)
  
  // --- 最佳实践版：只打印纯文本，打完后替换为富文本 ---
  // 或者：完全不支持 HTML，只支持纯文本打字。
  
  // 让我们采用“逐字打印”逻辑 (假设主要是纯文本)
  typeWriterTimer = setInterval(() => {
    // 每次截取 0 到 index 的字符串
    // 这种方式比 += 更安全，支持 HTML 标签的一半状态（虽然浏览器会自动修复，但最好不要）
    
    // 修正：为了支持 HTML，我们通常不建议手动写简单的打字机。
    // 这里提供一个“智能”版本：直接一次性显示 HTML，或者只对纯文本做打字机。
    
    // 让我们用最简单的逻辑：逐字追加
    const char = fullText.charAt(index);
    
    // 如果遇到 <，直接找到 >，一次性把整个标签打出来
    if (char === '<') {
      const closingIndex = fullText.indexOf('>', index);
      if (closingIndex !== -1) {
        displayedText.value += fullText.substring(index, closingIndex + 1);
        index = closingIndex + 1;
      } else {
        displayedText.value += char;
        index++;
      }
    } else {
      displayedText.value += char;
      index++;
    }

    // 结束条件
    if (index >= fullText.length) {
      clearInterval(typeWriterTimer);
      typeWriterTimer = null;
    }
  }, speed);
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

  currentBadgeText.value = "八达岭长城";
  displayedText.value = START_CONTENT;

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

  modelName = "杜梨花";
  setTimeout(loadModel, 3000, XIAOER_MODEL_PATH, XIAOER_MODEL_SCALE, XIAOER_MODEL_X, XIAOER_MODEL_Y); // 500毫秒延迟

  // 1. 挂载全局函数供 Unity 调用
  window.handleUnityTextClick = handleUnityClick;

  // 2. 加载 Unity
  // 请务必核对下面的文件名，必须与你 public/unity-build/Build/ 下的文件名完全一致！
  loadUnity({
    loaderUrl: "./unity-build/Build/GW.loader.js",
    dataUrl: "./unity-build/Build/GW.data",
    frameworkUrl: "./unity-build/Build/GW.framework.js",
    codeUrl: "./unity-build/Build/GW.wasm",
  }).then(() => {
    console.log("Unity 加载完成！");
  }).catch((err) => {
    console.error("Unity 加载失败:", err);
  });
});

onBeforeUnmount(() => {
  // 清理全局函数
  window.handleUnityTextClick = null;
});

const isPlaying = ref(false);
// 播放测试音频
// eslint-disable-next-line
const playTestAudio = (spk) => {
  console.log("播放测试音频");
  console.log("数字人模型", model);
  console.log("播讲内容", spk);
  // console.log(model.speak);
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

// 数字人容器的拖拽逻辑
const avatarRef = ref(null);
const isDraggingAvatar = ref(false);
const avatarDragOffset = { x: 0, y: 0 };
// const avatarStartPos = { x: 0, y: 0 };
// const avatarCurrentPos = reactive({ x: 0, y: 0 });

const startAvatarDrag = (e) => {
  // 1. 阻止冒泡，防止背景地图跟着动
  e.stopPropagation();
  // e.preventDefault(); // 可选：如果发现内部点击失效，请注释掉这一行

  const avatarEl = avatarRef.value;
  if (!avatarEl) return;
  // 3. 【核心修复】坐标系锁定
  // 获取当前元素在屏幕上的绝对位置
  const rect = avatarEl.getBoundingClientRect();
  // 4. 计算鼠标相对于元素左上角的偏移
  const clientX = e.clientX || e.touches?.[0].clientX;
  const clientY = e.clientY || e.touches?.[0].clientY;
  avatarDragOffset.x = clientX - rect.left;
  avatarDragOffset.y = clientY - rect.top;

  isDraggingAvatar.value = true;
  isDocked.value = false;
  // 2. 【核心修复】强制关闭动画！解决“拖拽滞后”问题
  avatarStyle.transition = 'none';
  avatarStyle.cursor = 'grabbing';
  // 【关键】强制清除 margin 和 transform，防止坐标计算偏差
  // 如果 CSS 里有 margin，这里设为 0 后，位置由 left/top 全权接管，不会跳变
  avatarStyle.margin = '0px';
  avatarStyle.transform = 'none';
  // 立即把 bottom/right 模式转换为 left/top 模式
  // 这样无论之前是停靠还是飞行状态，现在都统一了
  avatarStyle.left = `${rect.left}px`;
  avatarStyle.top = `${rect.top}px`;
  avatarStyle.bottom = 'auto';
  avatarStyle.right = 'auto';


  // 5. 绑定全局事件
  window.addEventListener('mousemove', onAvatarDrag);
  window.addEventListener('touchmove', onAvatarDrag, { passive: false });
  window.addEventListener('mouseup', endAvatarDrag);
  window.addEventListener('touchend', endAvatarDrag);
};

const onAvatarDrag = (e) => {
  if (!isDraggingAvatar.value) return;
  // 阻止手机端默认滚动行为
  if (e.cancelable) e.preventDefault();

  const clientX = e.clientX || e.touches?.[0].clientX;
  const clientY = e.clientY || e.touches?.[0].clientY;

  let newX = clientX - avatarDragOffset.x;
  let newY = clientY - avatarDragOffset.y;

  // 边界检查
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const elW = avatarRef.value?.offsetWidth || 200;
  const elH = avatarRef.value?.offsetHeight || 220;

  if (newX < 0) newX = 0;
  if (newX > viewportW - elW) newX = viewportW - elW;
  if (newY < 0) newY = 0;
  if (newY > viewportH - elH) newY = viewportH - elH;

  avatarStyle.left = `${newX}px`;
  avatarStyle.top = `${newY}px`;
};

const endAvatarDrag = () => {
  isDraggingAvatar.value = false;
  avatarStyle.cursor = 'grab';

  // 【重要】拖拽结束后，不要恢复 transition！
  // 只有在点击 POI 飞行时才需要 transition。
  // 拖拽松手就是松手，不需要缓动。
  avatarStyle.transition = 'none';

  window.removeEventListener('mousemove', onAvatarDrag);
  window.removeEventListener('touchmove', onAvatarDrag);
  window.removeEventListener('mouseup', endAvatarDrag);
  window.removeEventListener('touchend', endAvatarDrag);
};

// --- 字幕面板控制 ---
const isBubbleExpanded = ref(true); // 默认展开

const toggleBubble = () => {
  isBubbleExpanded.value = !isBubbleExpanded.value;
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

.unity-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #000;
  /* Unity 加载前显示黑色背景 */
}

#unity-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 20px;
  pointer-events: none;
}

/* 引入一个好看的中文字体 (可选，这里用 Google Fonts 的 Noto Serif SC) */
/* 定义字体 */
@font-face {
  font-family: 'FZQKBYSJW';
  /* 给字体起个名字 */
  src: url('@/assets/fonts/FZQKBYSJW.TTF') format('truetype');
  /* Vue中 @ 代表 src 目录 */
  font-weight: normal;
  font-style: normal;
  font-display: swap;
  /* 优化加载体验 */
}

/* --- 字幕面板容器 --- */
.subtitle-panel {
  position: absolute;
  top: 20%;
  right: 50px;
  /* 移除 absolute, bottom, left, transform 等定位属性 */
  /* 因为这些现在由 :style="subtitleStyle" 接管了 */
  
  /* 保持尺寸和视觉风格 */
  width: 320px;
  
  background: rgba(20, 20, 30, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  
  overflow: hidden;
  pointer-events: auto;
  
  /* 隐藏时的动画 (配合 Vue 的 transition 或 class) */
  opacity: 1;
}

.subtitle-panel.hidden {
  opacity: 0;
  pointer-events: none;
}

/* 折叠状态 */
.subtitle-panel.collapsed {
  width: 100px;
  background: rgba(20, 20, 30, 0.6);
  /* 注意：折叠后高度变小，JS 的定位逻辑依然有效（底部对齐） */
}

/* --- 顶部栏 --- */
.subtitle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  /* 整个头部可点击切换 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.subtitle-header:hover {
  background: rgba(255, 255, 255, 0.1);
}

.role-badge {
  font-size: 1rem;
  font-weight: 700;
  color: #ffffff;
  /* 紫色高亮 */
  text-transform: uppercase;
  letter-spacing: 1px;
}

.collapse-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
  transition: 0.3s;
}

.collapse-btn:hover {
  color: white;
}

/* --- 内容区域 --- */
.subtitle-content {
  padding: 12px 15px;
  color: #e2e8f0;
  font-size: 1.2rem;
  line-height: 1.8;
  letter-spacing: 1px;
  text-align: justify;

  /* 指定字体：衬线体更有“念白”的故事感 */
  font-family: 'FZQKBYSJW', 'Songti SC', serif;

  /* 限制最大高度，防止文字太长遮挡屏幕 */
  max-height: 480px;
  overflow-y: auto;
}

/* 自定义滚动条 */
.subtitle-content::-webkit-scrollbar {
  width: 4px;
}

.subtitle-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* --- 移动端适配 --- */
@media (max-width: 768px) {
  .subtitle-panel {
    width: 220px;
    /* 移动端稍微窄一点 */
  }
}
</style>
