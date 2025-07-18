// コンテンツスクリプト：選択されたテキストの取得とフロートウィンドウ表示を担当

// 選択テキストの監視用変数
let lastSelectedText = '';
let isWindowInteraction = false; // ウィンドウ操作中フラグ

// フロートウィンドウ関連の変数
let floatWindow = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let statusAnimationInterval = null;
const apiCache = {}; // API結果のキャッシュ
let lastActiveTab = 'translate'; // 最後に開いていたタブ

// 選択テキストを取得する関数
function getSelectedText() {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    return text;
}

// ページ全体のテキストを取得する関数
function getPageText() {
    // 不要な要素を除外
    const excludeSelectors = [
        'script', 'style', 'noscript', 'iframe', 'object', 'embed',
        'nav', 'header', 'footer', 'aside', '.ad', '.advertisement',
        '.sidebar', '.menu', '.navigation', '.footer', '.header'
    ];
    
    // 除外する要素を非表示にする
    const excludedElements = [];
    excludeSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el.style.display !== 'none') {
                excludedElements.push(el);
                el.style.display = 'none';
            }
        });
    });
    
    // ページ全体のテキストを取得
    const pageText = document.body.innerText || document.body.textContent || '';
    
    // 除外した要素を元に戻す
    excludedElements.forEach(el => {
        el.style.display = '';
    });
    
    // テキストをクリーンアップ
    return pageText
        .replace(/\s+/g, ' ')  // 連続する空白を単一の空白に
        .replace(/\n\s*\n/g, '\n')  // 連続する改行を単一の改行に
        .trim();
}

// 選択変更イベントの監視
document.addEventListener('mouseup', () => {
    if (isWindowInteraction) {
        isWindowInteraction = false;
        return;
    }
    const selectedText = getSelectedText();
    if (selectedText.length > 0 && selectedText !== lastSelectedText) {
        lastSelectedText = selectedText;
        // キャッシュをクリア
        Object.keys(apiCache).forEach(key => delete apiCache[key]); 
        
        if (floatWindow) {
            // 現在表示中のタブの内容を更新
            const activeTab = floatWindow.querySelector('.tab-item.active').dataset.tab;
            handleApiRequest(activeTab, selectedText);
        }
        
    } else if (selectedText.length === 0 && lastSelectedText) {
        lastSelectedText = '';
    }
});

// フロートウィンドウを作成する関数
function createFloatWindow() {
    if (floatWindow) return;

    floatWindow = document.createElement('div');
    floatWindow.id = 'immediate-translate-float-window';
    floatWindow.innerHTML = `
        <div class="header" id="float-header">
            <div class="tabs">
                <button class="tab-item ${lastActiveTab === 'translate' ? 'active' : ''}" data-tab="translate">翻訳</button>
                <button class="tab-item ${lastActiveTab === 'summarize' ? 'active' : ''}" data-tab="summarize">要約</button>
                <button class="tab-item ${lastActiveTab === 'explain' ? 'active' : ''}" data-tab="explain">解説</button>
            </div>
            <div class="actions">
                 <span id="status-indicator"></span>
                 <select id="model-selector" class="model-selector" title="モデル選択">
                     <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                     <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                     <option value="gemini-2.5-flash-lite-preview-06-17">Gemini 2.5 Flash-Lite</option>
                     <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                     <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                 </select>
                 <button class="action-btn" id="copy-btn" title="コピー" disabled>コピー</button>
                 <button class="action-btn" id="settings-btn" title="設定">⚙️</button>
                 <button class="action-btn" id="close-btn" title="閉じる">×</button>
            </div>
        </div>
        <div class="content-area">
            <div class="tab-content ${lastActiveTab === 'translate' ? 'active' : ''}" id="translate-content">
                <div class="empty-state">テキストを選択すると翻訳が開始されます</div>
            </div>
            <div class="tab-content ${lastActiveTab === 'summarize' ? 'active' : ''}" id="summarize-content">
                 <div class="empty-state"></div>
            </div>
            <div class="tab-content ${lastActiveTab === 'explain' ? 'active' : ''}" id="explain-content">
                <div class="empty-state"></div>
            </div>
        </div>
        <div class="resize-handle" id="resize-handle"></div>
    `;

    // CSSスタイルを注入
    if (!document.getElementById('immediate-translate-styles')) {
        const styles = document.createElement('style');
        styles.id = 'immediate-translate-styles';
        styles.textContent = getFloatWindowStyles();
        document.head.appendChild(styles);
    }

    // フロートウィンドウをページに追加
    document.body.appendChild(floatWindow);

    // イベントリスナーを設定
    setupFloatWindowEventListeners();

    // 初期位置を設定 (右下)
    floatWindow.style.right = '20px';
    floatWindow.style.bottom = '20px';
    floatWindow.style.top = 'auto';
    floatWindow.style.left = 'auto';

    // 初期モデル選択を設定
    updateModelSelector(lastActiveTab);

    // 選択テキストがある場合は即座に処理を開始
    if (lastSelectedText) {
        handleApiRequest(lastActiveTab, lastSelectedText);
    }
}

// フロートウィンドウのスタイルを取得
function getFloatWindowStyles() {
    // 新しいCSSスタイル
    return `
        #immediate-translate-float-window {
            position: fixed;
            width: 800px; /* 初期幅を2倍に変更 */
            min-width: 350px; /* 最小幅 */
            height: 220px; /* 初期高さ */
            min-height: 150px; /* 最小高さ */
            max-height: 80vh;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 5px 15px rgba(0,0,0,0.1);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 1px solid #e0e0e0;
            /* Flexboxコンテナとして設定 */
            display: flex;
            flex-direction: column;
            overflow: hidden; /* 子要素のはみ出しを隠す */
        }

        .header {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            border-bottom: 1px solid #e9ecef;
            cursor: move;
            user-select: none;
            flex-shrink: 0; /* ヘッダーが縮まないようにする */
        }

        .tabs {
            display: flex;
            gap: 4px;
        }

        .tab-item {
            padding: 5px 10px;
            font-size: 14px;
            font-weight: 500;
            color: #495057;
            background-color: transparent;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .tab-item.active {
            background-color: #e9ecef;
            color: #212529;
            font-weight: 600;
        }
        
        .tab-item:hover:not(.active) {
            background-color: #f8f9fa;
        }

        .actions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: auto; /* ★これにより右端に寄せる */
        }

        #status-indicator {
            font-size: 12px;
            color: #868e96;
            width: 70px;
            text-align: right;
            white-space: nowrap;
        }
        
        .action-btn {
            background-color: #f1f3f5;
            border: 1px solid #dee2e6;
            color: #495057;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .action-btn:hover:not(:disabled) {
            background-color: #e9ecef;
        }
        .action-btn:disabled {
            background-color: #f8f9fa;
            color: #adb5bd;
            cursor: not-allowed;
        }
        /* 閉じるボタンのスタイルを他と統一 */
        #close-btn, #settings-btn {
            padding: 2px 6px;
            font-size: 18px;
            line-height: 1.2;
        }
        
        .model-selector {
            background-color: #f1f3f5;
            border: 1px solid #dee2e6;
            color: #495057;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            min-width: 120px;
        }
        .model-selector:hover {
            background-color: #e9ecef;
        }
        .model-selector:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }


        .content-area {
            overflow-y: auto;
            padding: 16px;
            flex-grow: 1; /* ★残りの垂直スペースをすべて埋める */
        }

        .tab-content { display: none; }
        .tab-content.active { display: block; }

        .result-text {
            font-size: 14px;
            line-height: 1.7;
            white-space: pre-wrap;
            word-wrap: break-word;
            color: #343a40;
        }

        .empty-state {
            color: #868e96;
            font-size: 14px;
            text-align: center;
            padding: 20px 0;
        }

        .resize-handle {
            position: absolute;
            right: 0;
            bottom: 0;
            width: 14px;
            height: 14px;
            cursor: nwse-resize;
            z-index: 10;
        }
        .resize-handle::after {
            content: '';
            position: absolute;
            right: 3px;
            bottom: 3px;
            width: 5px;
            height: 5px;
            border-right: 2px solid #adb5bd;
            border-bottom: 2px solid #adb5bd;
            opacity: 0.7;
        }
    `;
}

// フロートウィンドウのイベントリスナーを設定
function setupFloatWindowEventListeners() {
    const header = floatWindow.querySelector('.header');
    const closeBtn = floatWindow.querySelector('#close-btn');
    const settingsBtn = floatWindow.querySelector('#settings-btn');
    const resizeHandle = floatWindow.querySelector('#resize-handle');
    const tabItems = floatWindow.querySelectorAll('.tab-item');
    const copyBtn = floatWindow.querySelector('#copy-btn');
    const modelSelector = floatWindow.querySelector('#model-selector');

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        isWindowInteraction = true;
        const rect = floatWindow.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag, { once: true });
    });

    closeBtn.addEventListener('click', closeFloatWindow);

    settingsBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'openOptionsPage' });
    });

    tabItems.forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isWindowInteraction = true;
        const startWidth = floatWindow.offsetWidth;
        const startHeight = floatWindow.offsetHeight;
        const startX = e.clientX;
        const startY = e.clientY;

        const handleResize = (e) => {
            const newWidth = Math.max(parseFloat(getComputedStyle(floatWindow).minWidth), startWidth + e.clientX - startX);
            const newHeight = Math.max(parseFloat(getComputedStyle(floatWindow).minHeight), startHeight + e.clientY - startY);
            floatWindow.style.width = newWidth + 'px';
            floatWindow.style.height = newHeight + 'px';
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', handleResize);
            isWindowInteraction = false;
        };

        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize, { once: true });
    });

    copyBtn.addEventListener('click', () => {
        const activeTab = floatWindow.querySelector('.tab-item.active').dataset.tab;
        const content = apiCache[activeTab];
        if (content) {
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = 'コピー' }, 1500);
            });
        }
    });

    // モデル選択のイベントリスナー
    modelSelector.addEventListener('change', async () => {
        const activeTab = floatWindow.querySelector('.tab-item.active').dataset.tab;
        const selectedModel = modelSelector.value;
        
        // 現在のタブのモデル設定を更新
        const settings = await chrome.storage.local.get(['tabModels']);
        const tabModels = settings.tabModels || {};
        tabModels[activeTab] = selectedModel;
        await chrome.storage.local.set({ tabModels });
        
        // キャッシュをクリアして再実行
        if (lastSelectedText) {
            delete apiCache[activeTab];
            handleApiRequest(activeTab, lastSelectedText);
        }
    });
}

function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
}

function handleDrag(e) {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    floatWindow.style.left = `${x}px`;
    floatWindow.style.top = `${y}px`;
    floatWindow.style.right = 'auto';
    floatWindow.style.bottom = 'auto';
}

// タブ切り替えロジック
async function switchTab(tabName) {
    if (!floatWindow) return;
    
    // API呼び出し（キャッシュがなければ）
    const activeTabContent = floatWindow.querySelector(`#${tabName}-content`);
    if (!activeTabContent) return;

    floatWindow.querySelectorAll('.tab-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });
    floatWindow.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-content`);
    });

    // 最後に開いていたタブを保存
    lastActiveTab = tabName;

    // モデル選択を現在のタブに合わせて更新
    await updateModelSelector(tabName);

    if (lastSelectedText && !apiCache[tabName]) {
        handleApiRequest(tabName, lastSelectedText);
    } else {
        updateFloatWindowContent(tabName, apiCache[tabName] || '');
    }
}

// プロンプトテンプレートを処理する関数
function processPromptTemplate(template, selectedText) {
    let processedText = selectedText;
    let processedTemplate = template;
    
    // {PAGE}キーワードが含まれている場合
    if (template.includes('{PAGE}')) {
        const pageText = getPageText();
        processedTemplate = template.replace(/{PAGE}/g, pageText);
        // 選択テキストが空の場合は、ページ全体のテキストを使用
        if (!selectedText) {
            processedText = pageText;
        }
    }
    
    // {TEXT}を選択テキストで置換
    processedTemplate = processedTemplate.replace(/{TEXT}/g, processedText);
    
    return processedTemplate;
}

// APIリクエストのハンドリング
async function handleApiRequest(type, text) {
    if (!text) return;
    
    setProcessingState(true);
    updateFloatWindowContent(type, ''); // 表示をクリア

    const settings = await chrome.storage.local.get(['apiKey', 'model', 'tabModels', 'translate', 'summarize', 'explain']);
    if (!settings.apiKey) {
        updateFloatWindowContent(type, 'APIキーが設定されていません', true);
        setProcessingState(false, 'error');
        return;
    }

    // タブごとのモデル設定を取得（なければデフォルト）
    const tabModels = settings.tabModels || {};
    const model = tabModels[type] || settings.model || 'gemini-2.5-flash';

    // プロンプトテンプレートを取得
    const promptTemplate = settings[type] || '';
    
    try {
        // プロンプトテンプレートを処理
        const processedPrompt = processPromptTemplate(promptTemplate, text);
        
        const response = await chrome.runtime.sendMessage({
            type: type, 
            text: text, 
            prompt: processedPrompt,
            apiKey: settings.apiKey, 
            model: model
        });
        if (response.success) {
            apiCache[type] = response.result;
            updateFloatWindowContent(type, response.result);
            setProcessingState(false, 'success');
        } else {
            updateFloatWindowContent(type, response.error || '失敗しました', true);
            setProcessingState(false, 'error');
        }
    } catch (error) {
        updateFloatWindowContent(type, '処理中にエラーが発生しました', true);
        setProcessingState(false, 'error');
    }
}

// フロートウィンドウのコンテンツ更新
function updateFloatWindowContent(type, text, isError = false) {
    if (!floatWindow) return;
    const contentArea = floatWindow.querySelector(`#${type}-content`);
    if (!contentArea) return;
    
    if (!text && !isError) {
        contentArea.innerHTML = `<div class="empty-state">テキストを選択してください</div>`;
    } else {
         contentArea.innerHTML = `<div class="result-text">${text}</div>`;
    }

    floatWindow.querySelector('#copy-btn').disabled = isError || !text;
}

// モデル選択を更新する関数
async function updateModelSelector(tabName) {
    if (!floatWindow) return;
    
    const modelSelector = floatWindow.querySelector('#model-selector');
    if (!modelSelector) return;
    
    try {
        const settings = await chrome.storage.local.get(['tabModels', 'model']);
        const tabModels = settings.tabModels || {};
        const defaultModel = settings.model || 'gemini-2.5-flash';
        
        // 現在のタブのモデル設定を取得（なければデフォルト）
        const currentModel = tabModels[tabName] || defaultModel;
        modelSelector.value = currentModel;
    } catch (error) {
        console.error('モデル設定の取得に失敗しました:', error);
        modelSelector.value = 'gemini-2.5-flash';
    }
}

// 処理中状態の設定
function setProcessingState(isProcessing, resultType = null) {
    if (!floatWindow) return;
    const status = floatWindow.querySelector('#status-indicator');
    const copyBtn = floatWindow.querySelector('#copy-btn');
    clearInterval(statusAnimationInterval);
    
    if (isProcessing) {
        status.textContent = '処理中';
        let dotCount = 0;
        statusAnimationInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            status.textContent = '処理中' + '.'.repeat(dotCount);
        }, 400);
        copyBtn.disabled = true;
    } else {
        status.textContent = ''; // Idle
        if (resultType === 'success') {
            copyBtn.disabled = false;
        } else if (resultType === 'error') {
            copyBtn.disabled = true;
        }
    }
}

function closeFloatWindow() {
    if (floatWindow) {
        // 現在のタブ状態を保存
        const activeTab = floatWindow.querySelector('.tab-item.active');
        if (activeTab) {
            lastActiveTab = activeTab.dataset.tab;
        }
        
        floatWindow.remove();
        floatWindow = null;
        chrome.runtime.sendMessage({ type: 'floatWindowClosed' }).catch(() => {});
    }
}

// バックグラウンドからのメッセージハンドラ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'openFloatWindow':
            createFloatWindow();
            sendResponse({ success: true });
            break;
        case 'closeFloatWindow':
            closeFloatWindow();
            sendResponse({ success: true });
            break;
        case 'getSelectedText':
            sendResponse({ text: getSelectedText() });
            break;
    }
    return true; // 非同期レスポンスを正しく処理するため
});

// ページ読み込み時の処理は空
window.addEventListener('load', () => {});