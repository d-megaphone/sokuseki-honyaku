document.addEventListener('DOMContentLoaded', () => {

    // --- 定数 ---
    const DEFAULT_PROMPTS = {
        translate: `以下のテキストを適切な言語に翻訳してください。日本語の場合は英語に、英語やその他の言語の場合は日本語に翻訳してください。\n\nテキスト: {TEXT}`,
        summarize: `以下のテキストを日本語で要約してください。\n\nテキスト: {TEXT}`,
        explain: `以下のテキストについて、専門用語を避け、誰にでも理解できるように解説してください。\n\nテキスト: {TEXT}`
    };

    const DEFAULT_MODELS = {
        translate: 'gemini-2.5-flash',
        summarize: 'gemini-2.5-flash',
        explain: 'gemini-2.5-flash'
    };

    const DEFAULT_SHORTCUT = 'MacCtrl+A';

    // --- DOM要素 ---
    const apiKeyInput = document.getElementById('apiKey');
    const translateTextarea = document.getElementById('prompt-translate');
    const summarizeTextarea = document.getElementById('prompt-summarize');
    const explainTextarea = document.getElementById('prompt-explain');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');
    const resetTranslateBtn = document.getElementById('reset-translate');
    const resetSummarizeBtn = document.getElementById('reset-summarize');
    const resetExplainBtn = document.getElementById('reset-explain');

    // タブごとのモデル選択要素
    const translateModelSelect = document.getElementById('model-translate');
    const summarizeModelSelect = document.getElementById('model-summarize');
    const explainModelSelect = document.getElementById('model-explain');

    // ショートカットキー設定要素
    const shortcutInput = document.getElementById('shortcut-key');
    const resetShortcutBtn = document.getElementById('reset-shortcut');
    const currentShortcutSpan = document.getElementById('current-shortcut');

    // --- 関数 ---

    // ステータスメッセージを表示
    function showStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? 'red' : 'green';
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 3000);
    }

    // 設定をフォームに読み込む
    async function restoreOptions() {
        try {
            const items = await chrome.storage.local.get({
                apiKey: '',
                shortcutKey: DEFAULT_SHORTCUT,
                tabModels: DEFAULT_MODELS,
                translate: DEFAULT_PROMPTS.translate,
                summarize: DEFAULT_PROMPTS.summarize,
                explain: DEFAULT_PROMPTS.explain
            });

            // 取得した値でフォームを埋める
            apiKeyInput.value = items.apiKey;
            translateTextarea.value = items.translate || DEFAULT_PROMPTS.translate;
            summarizeTextarea.value = items.summarize || DEFAULT_PROMPTS.summarize;
            explainTextarea.value = items.explain || DEFAULT_PROMPTS.explain;

            // タブごとのモデル設定を読み込み
            const tabModels = items.tabModels || DEFAULT_MODELS;
            translateModelSelect.value = tabModels.translate || DEFAULT_MODELS.translate;
            summarizeModelSelect.value = tabModels.summarize || DEFAULT_MODELS.summarize;
            explainModelSelect.value = tabModels.explain || DEFAULT_MODELS.explain;

            // ショートカットキー設定を読み込み
            const shortcutKey = items.shortcutKey || DEFAULT_SHORTCUT;
            shortcutInput.value = shortcutKey;
            currentShortcutSpan.textContent = shortcutKey;

        } catch (error) {
            console.error('設定の読み込み中にエラーが発生しました:', error);
            showStatus('エラー: 設定を読み込めませんでした。', true);
        }
    }

    // フォームの内容を設定に保存する
    async function saveOptions() {
        const settings = {
            apiKey: apiKeyInput.value,
            shortcutKey: shortcutInput.value,
            tabModels: {
                translate: translateModelSelect.value,
                summarize: summarizeModelSelect.value,
                explain: explainModelSelect.value
            },
            translate: translateTextarea.value,
            summarize: summarizeTextarea.value,
            explain: explainTextarea.value
        };

        try {
            await chrome.storage.local.set(settings);
            showStatus('設定を保存しました。');
        } catch (error) {
            console.error('設定の保存中にエラーが発生しました:', error);
            showStatus('エラー: 設定を保存できませんでした。', true);
        }
    }

    // ショートカットキー入力の処理
    let isRecordingShortcut = false;
    let recordedKeys = [];

    function formatShortcut(keys) {
        return keys.map(key => {
            if (key === 'Control') return 'Ctrl';
            if (key === 'Meta') return 'Mac';
            if (key === 'Alt') return 'Alt';
            if (key === 'Shift') return 'Shift';
            return key;
        }).join('+');
    }

    function handleKeyDown(e) {
        if (!isRecordingShortcut) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const key = e.key;
        const modifiers = [];
        
        if (e.ctrlKey) modifiers.push('Control');
        if (e.metaKey) modifiers.push('Meta');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        
        // 修飾キー以外のキーが押された場合
        if (!['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
            recordedKeys = [...modifiers, key];
            shortcutInput.value = formatShortcut(recordedKeys);
            currentShortcutSpan.textContent = formatShortcut(recordedKeys);
            isRecordingShortcut = false;
            shortcutInput.classList.remove('recording');
            shortcutInput.blur();
        }
    }

    function handleKeyUp(e) {
        if (!isRecordingShortcut) return;
        
        // 修飾キーのみの場合は記録しない
        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            recordedKeys = [];
            shortcutInput.value = '';
        }
    }

    // --- 初期化処理 ---
    saveButton.addEventListener('click', saveOptions);
    
    resetTranslateBtn.addEventListener('click', () => {
        translateTextarea.value = DEFAULT_PROMPTS.translate;
    });
    
    resetSummarizeBtn.addEventListener('click', () => {
        summarizeTextarea.value = DEFAULT_PROMPTS.summarize;
    });
    
    resetExplainBtn.addEventListener('click', () => {
        explainTextarea.value = DEFAULT_PROMPTS.explain;
    });

    // ショートカットキー設定のイベントリスナー
    shortcutInput.addEventListener('click', () => {
        isRecordingShortcut = true;
        recordedKeys = [];
        shortcutInput.classList.add('recording');
        shortcutInput.value = 'キーを押してください...';
        shortcutInput.focus();
    });

    resetShortcutBtn.addEventListener('click', () => {
        shortcutInput.value = DEFAULT_SHORTCUT;
        currentShortcutSpan.textContent = DEFAULT_SHORTCUT;
    });

    // キーボードイベントリスナー
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    restoreOptions();
}); 