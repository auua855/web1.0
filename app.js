document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const searchForm = document.getElementById('search-form');
    const keywordInput = document.getElementById('keyword-input');
    const resultsContainer = document.getElementById('results-container');
    const loader = document.getElementById('loader');
    const welcomeState = document.getElementById('welcome-state');
    const historyContainer = document.getElementById('history-container');
    const currentDatetimeEl = document.getElementById('current-datetime');
    
    // Live Datetime Updates
    const updateDatetime = () => {
        if (!currentDatetimeEl) return;
        const now = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        currentDatetimeEl.textContent = now.toLocaleString('ja-JP', options);
    };
    updateDatetime();
    setInterval(updateDatetime, 1000);
    
    // Settings Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');

    // State
    let searchHistory = [];

    // Load settings from local storage
    const loadSettings = () => {
        const apiKey = localStorage.getItem('gemini_api_key');
        const model = localStorage.getItem('gemini_model');
        
        if (apiKey) apiKeyInput.value = apiKey;
        if (model) modelSelect.value = model;
        
        return { apiKey, model: model || 'gemini-3.1-pro-preview' };
    };

    // Save settings
    const saveSettings = () => {
        const apiKey = apiKeyInput.value.trim();
        const model = modelSelect.value;
        const isFirstTime = !localStorage.getItem('gemini_api_key');
        
        if (!apiKey) {
            alert('APIキーを入力してください。');
            return;
        }

        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('gemini_model', model);
        
        toggleModal(false);
        
        // Trigger initial search if there are no results yet
        if (isFirstTime || resultsContainer.innerHTML === '') {
            performSearch('いまネットでリアルタイムに話題になっている最近のトレンド');
        }
    };

    // Modal toggle
    const toggleModal = (show) => {
        if (show) {
            settingsModal.classList.remove('hidden');
        } else {
            settingsModal.classList.add('hidden');
        }
    };

    // Event Listeners for Settings
    settingsBtn.addEventListener('click', () => toggleModal(true));
    closeSettingsBtn.addEventListener('click', () => toggleModal(false));
    saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Close modal on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) toggleModal(false);
    });

    // Check if API key exists on load, if not prompt
    if (!localStorage.getItem('gemini_api_key')) {
        setTimeout(() => toggleModal(true), 500);
    } else {
        setTimeout(() => performSearch('いまネットでリアルタイムに話題になっている最近のトレンド'), 100);
    }

    // Google Search Handler
    const handleGoogleSearch = (query) => {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        window.open(url, '_blank');
    };

    // Deep Dive Handler
    const handleDeepDive = (query) => {
        keywordInput.value = query;
        performSearch(query);
    };

    // Render History Crumbs
    const renderHistory = () => {
        historyContainer.innerHTML = '';
        searchHistory.forEach((term, index) => {
            const crumb = document.createElement('div');
            crumb.className = 'crumb';
            crumb.textContent = term;
            crumb.onclick = () => {
                // If they click a previous history, truncate history to that point and search
                searchHistory = searchHistory.slice(0, index);
                keywordInput.value = term;
                performSearch(term, true);
            };
            
            historyContainer.appendChild(crumb);
            
            if (index < searchHistory.length - 1) {
                const sep = document.createElement('span');
                sep.className = 'crumb-separator';
                sep.textContent = '>';
                historyContainer.appendChild(sep);
            }
        });
    };

    // Determine Score Color
    const getScoreColor = (score) => {
        if (score >= 80) return 'var(--score-high)';
        if (score >= 50) return 'var(--score-mid)';
        return 'var(--score-low)';
    };

    // Render Result Card
    const renderCard = async (item, index) => {
        const card = document.createElement('div');
        card.className = 'trend-card';
        card.style.animationDelay = `${index * 0.1}s`;
        
        card.innerHTML = `
            <div class="card-header-compact">
                <div class="rank-badge-compact">${index + 1}</div>
                <div class="score-badge-compact">
                    <span class="score-dot" style="background-color: ${getScoreColor(item.score)}"></span>
                    注目度: ${item.score}
                </div>
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${item.title}">${item.title}</h3>
                <div class="card-actions">
                    <button class="secondary-btn deep-dive-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                        深堀
                    </button>
                    <button class="secondary-btn google-search-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        検索
                    </button>
                </div>
            </div>
        `;

        // Add Listeners
        card.querySelector('.deep-dive-btn').addEventListener('click', () => handleDeepDive(item.query || item.title));
        card.querySelector('.google-search-btn').addEventListener('click', () => handleGoogleSearch(item.query || item.title));

        resultsContainer.appendChild(card);
    };

    // Main Search Function
    const performSearch = async (keyword, isHistoryClick = false) => {
        const { apiKey, model } = loadSettings();
        
        if (!apiKey) {
            toggleModal(true);
            return;
        }

        if (!keyword.trim()) return;

        // Update UI states
        welcomeState.classList.add('hidden');
        resultsContainer.innerHTML = '';
        loader.classList.remove('hidden');

        // Update history
        if (!isHistoryClick) {
            searchHistory.push(keyword);
        }
        renderHistory();

        // Construct API Call
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const nowStr = new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const prompt = `あなたはネットのリアルタイムトレンドに詳しい優秀なAIエージェントです。
現在の日時は【 ${nowStr} 】です。必ずこの現在日時を基準にしてください。
指定されたキーワード「${keyword}」に関連する、いま現在のネット上の最前線の話題や関連語を10個推測して抽出してください。
※1ヶ月前の古いデータなどは絶対に除外し、現時点でのリアルタイムな情報のみを厳選して抽出すること。

以下のJSONスキーマの配列形式のみで出力してください。Markdownのコードブロック構文（\`\`\`json）やその他の説明テキストは一切含めないでください。純粋なJSON配列のみを出力すること。

[
  {
    "title": "トレンドのタイトルや具体的な関連名称",
    "score": 85, // 0-100の注目度スコア（AI推測で可）
    "query": "Google検索によく使われる具体的なキーワード"
  }
]`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'API request failed');
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            // Clean markdown logic if AI ignores instructions
            let jsonString = textResponse;
            if (jsonString.startsWith('\`\`\`')) {
                jsonString = jsonString.replace(/^\`\`\`json/i, '').replace(/^\`\`\`/i, '').replace(/\`\`\`$/i, '').trim();
            }

            const trends = JSON.parse(jsonString);

            // Hide loader
            loader.classList.add('hidden');

            // Sort by score
            trends.sort((a, b) => b.score - a.score);

            // Render
            trends.forEach((item, index) => renderCard(item, index));

        } catch (error) {
            console.error(error);
            loader.classList.add('hidden');
            resultsContainer.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon">⚠️</div>
                    <h2>エラーが発生しました</h2>
                    <p style="color:var(--score-high)">${error.message}</p>
                    <p style="margin-top:16px;">APIキーやモデルが正しいか設定を確認してください。</p>
                </div>
            `;
        }
    };

    // Form Submit
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch(keywordInput.value);
    });
});
