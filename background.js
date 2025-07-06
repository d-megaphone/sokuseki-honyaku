// バックグラウンドスクリプト（Service Worker）：API通信を担当

// Gemini APIのエンドポイント
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// デフォルトプロンプト
const DEFAULT_PROMPTS = {
    translate: `以下のテキストを適切な言語に翻訳してください。日本語の場合は英語に、英語やその他の言語の場合は日本語に翻訳してください。\n\nテキスト: {TEXT}`,
    summarize: `以下のテキストを日本語で要約してください。\n\nテキスト: {TEXT}`,
    explain: `以下のテキストについて、専門用語を避け、誰にでも理解できるように解説してください。\n\nテキスト: {TEXT}`
};

// バックグラウンドスクリプト - メイン処理
let floatWindowOpen = false;
let currentActiveTab = null;

// 拡張機能のアイコンがクリックされたときの処理
chrome.action.onClicked.addListener(async (tab) => {
    currentActiveTab = tab;
    
    try {
        // フロートウィンドウの開閉をトグル
        if (floatWindowOpen) {
            // フロートウィンドウを閉じる
            chrome.tabs.sendMessage(tab.id, {
                type: 'closeFloatWindow'
            }).catch(() => {});
            floatWindowOpen = false;
        } else {
            // フロートウィンドウを開く
            chrome.tabs.sendMessage(tab.id, {
                type: 'openFloatWindow'
            }).catch(() => {});
            floatWindowOpen = true;
            
            // 現在の選択テキストを初期取得
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {type: 'getSelectedText'})
                    .then(response => {
                        if (response && response.text) {
                            notifyFloatWindow('textSelected', response.text);
                        }
                    })
                    .catch(() => {});
            }, 100);
        }
        
    } catch (error) {
        console.error('フロートウィンドウ操作エラー:', error);
    }
});

// フロートウィンドウにメッセージを送信する関数
function notifyFloatWindow(type, data) {
    if (floatWindowOpen && currentActiveTab) {
        chrome.tabs.sendMessage(currentActiveTab.id, {
            type: 'floatWindowMessage',
            messageType: type,
            data: data
        }).catch(() => {
            // コンテンツスクリプトが準備中の場合は無視
        });
    }
}

// メッセージリスナー：ポップアップからの翻訳・要約リクエストを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'translate') {
        handleTranslation(message, sendResponse);
        return true; // 非同期レスポンス
    } else if (message.type === 'summarize') {
        handleSummarization(message, sendResponse);
        return true; // 非同期レスポンス
    } else if (message.type === 'explain') {
        handleExplanation(message, sendResponse);
        return true; // 非同期レスポンス
    } else if (message.type === 'textSelected') {
        // content.jsからの選択テキスト通知をフロートウィンドウに転送
        notifyFloatWindow('selectedText', message.text);
        sendResponse({ success: true });
    } else if (message.type === 'textDeselected') {
        // 選択解除通知をフロートウィンドウに転送
        notifyFloatWindow('deselectedText');
        sendResponse({ success: true });
    } else if (message.type === 'floatWindowClosed') {
        // フロートウィンドウが閉じられた時の通知
        floatWindowOpen = false;
        sendResponse({ success: true });
    } else if (message.type === 'openOptionsPage') {
        chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
    } else if (message.type === 'updateShortcut') {
        // ショートカットキーの更新（実際の実装は複雑なため、ここでは通知のみ）
        console.log('ショートカットキーが更新されました:', message.shortcut);
        sendResponse({ success: true });
    } else if (message.type === 'getCurrentSelectedText') {
        // フロートウィンドウからの現在選択テキスト取得要求（初期化用）
        if (currentActiveTab) {
            chrome.tabs.sendMessage(currentActiveTab.id, {type: 'getSelectedText'})
                .then(response => {
                    sendResponse({ text: response?.text || '' });
                })
                .catch(() => {
                    sendResponse({ text: '' });
                });
        } else {
            sendResponse({ text: '' });
        }
        return true; // 非同期レスポンス
    }
});

// 翻訳処理
async function handleTranslation(message, sendResponse) {
    const { text, apiKey, model } = message;
    
    try {
        const { translate: promptTemplate } = await chrome.storage.local.get({ translate: DEFAULT_PROMPTS.translate });
        const prompt = promptTemplate.replace('{TEXT}', text);

        const result = await callGeminiAPI(prompt, apiKey, model);
        sendResponse({ success: true, result: result });
        
    } catch (error) {
        console.error('翻訳エラー:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 要約処理
async function handleSummarization(message, sendResponse) {
    const { text, apiKey, model } = message;
    
    try {
        const { summarize: promptTemplate } = await chrome.storage.local.get({ summarize: DEFAULT_PROMPTS.summarize });
        const prompt = promptTemplate.replace('{TEXT}', text);

        const result = await callGeminiAPI(prompt, apiKey, model);
        sendResponse({ success: true, result: result });
        
    } catch (error) {
        console.error('要約エラー:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 初学者向け解説処理
async function handleExplanation(message, sendResponse) {
    const { text, apiKey, model } = message;
    
    try {
        const { explain: promptTemplate } = await chrome.storage.local.get({ explain: DEFAULT_PROMPTS.explain });
        const prompt = promptTemplate.replace('{TEXT}', text);

        const result = await callGeminiAPI(prompt, apiKey, model);
        sendResponse({ success: true, result: result });
        
    } catch (error) {
        console.error('解説エラー:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Gemini APIを呼び出す関数
async function callGeminiAPI(prompt, apiKey, model = 'gemini-2.5-flash') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.5,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 65536,
        }
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
             throw new Error(`APIからブロックされました。理由: ${data.promptFeedback.blockReason}`);
        } else {
            throw new Error('予期しないAPIレスポンス形式です');
        }
        
    } catch (error) {
        console.error('Gemini API呼び出しエラー:', error);
        throw error;
    }
} 