document.addEventListener('DOMContentLoaded', () => {

    // --- 定数 ---
    const DEFAULT_PROMPTS = {
        translate: `以下のテキストを適切な言語に翻訳してください。日本語の場合は英語に、英語やその他の言語の場合は日本語に翻訳してください。\n\nテキスト: {TEXT}`,
        summarize: `以下のテキストを日本語で要約してください。\n\nテキスト: {TEXT}`,
        explain: `以下のテキストについて、専門用語を避け、誰にでも理解できるように解説してください。\n\nテキスト: {TEXT}`
    };

    // --- DOM要素 ---
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelect = document.getElementById('model');
    const translateTextarea = document.getElementById('prompt-translate');
    const summarizeTextarea = document.getElementById('prompt-summarize');
    const explainTextarea = document.getElementById('prompt-explain');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');
    const resetTranslateBtn = document.getElementById('reset-translate');
    const resetSummarizeBtn = document.getElementById('reset-summarize');
    const resetExplainBtn = document.getElementById('reset-explain');

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
                model: 'gemini-2.5-flash',
                translate: DEFAULT_PROMPTS.translate,
                summarize: DEFAULT_PROMPTS.summarize,
                explain: DEFAULT_PROMPTS.explain
            });

            // 取得した値でフォームを埋める
            apiKeyInput.value = items.apiKey;
            modelSelect.value = items.model || 'gemini-2.5-flash';
            translateTextarea.value = items.translate || DEFAULT_PROMPTS.translate;
            summarizeTextarea.value = items.summarize || DEFAULT_PROMPTS.summarize;
            explainTextarea.value = items.explain || DEFAULT_PROMPTS.explain;

        } catch (error) {
            console.error('設定の読み込み中にエラーが発生しました:', error);
            showStatus('エラー: 設定を読み込めませんでした。', true);
        }
    }

    // フォームの内容を設定に保存する
    async function saveOptions() {
        const settings = {
            apiKey: apiKeyInput.value,
            model: modelSelect.value,
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

    restoreOptions();
}); 