// src/composables/useUnity.js
import { ref, onUnmounted } from 'vue';

export function useUnity(canvasRef) {
    const unityInstance = ref(null);
    const progress = ref(0);
    const isLoaded = ref(false);

    const loadUnity = async (config) => {
        if (!canvasRef.value) {
            console.error('Canvas element not found.');
            return;
        }

        return new Promise((resolve, reject) => {
            // 1. 动态创建 script 标签来加载 Unity 的 loader.js
            const script = document.createElement('script');
            script.src = config.loaderUrl;

            script.onload = () => {
                // 2. loader 加载完毕后，调用全局的 createUnityInstance
                if (window.createUnityInstance) {
                    window.createUnityInstance(canvasRef.value, {
                        dataUrl: config.dataUrl,
                        frameworkUrl: config.frameworkUrl,
                        codeUrl: config.codeUrl,
                        streamingAssetsUrl: "StreamingAssets",
                        companyName: "DefaultCompany",
                        productName: "MyProject",
                        productVersion: "1.0",
                        // 可以在这里添加更多 Unity 配置
                    }, (p) => {
                        progress.value = p; // 更新加载进度
                    }).then((instance) => {
                        unityInstance.value = instance;
                        isLoaded.value = true;
                        resolve(instance);
                    }).catch((message) => {
                        reject(message);
                    });
                } else {
                    reject('Unity loader script loaded but createUnityInstance not found.');
                }
            };

            script.onerror = () => {
                reject('Failed to load Unity loader script.');
            };

            document.body.appendChild(script);
        });
    };

    // 销毁 Unity 实例，释放内存
    const unloadUnity = async () => {
        if (unityInstance.value) {
            await unityInstance.value.quit();
            unityInstance.value = null;
            isLoaded.value = false;
        }
    };

    // 组件卸载时自动清理
    onUnmounted(() => {
        // 注意：Unity WebGL 退出有时比较慢，或者需要特定处理，视情况开启
        // unloadUnity(); 
    });

    return {
        unityInstance,
        progress,
        isLoaded,
        loadUnity,
        unloadUnity
    };
}
