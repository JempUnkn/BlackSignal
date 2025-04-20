// Substitua COMPLETAMENTE seu script.js por este:
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed"); // Log inicial

    // --- Elementos do DOM ---
    // Adiciona logs para verificar se a seleção inicial funciona
    const channelsContainer = document.querySelector('.channels-container');
    console.log("channelsContainer selected:", channelsContainer);
    const channelCardTemplate = document.getElementById('channel-card-template');
    console.log("channelCardTemplate selected:", channelCardTemplate);
    const searchInput = document.getElementById('search-input');
    console.log("searchInput selected:", searchInput);
    const tagFilter = document.getElementById('tag-filter');
    console.log("tagFilter selected:", tagFilter);
    const gridViewBtn = document.getElementById('grid-view');
    console.log("gridViewBtn selected:", gridViewBtn);
    const listViewBtn = document.getElementById('list-view');
    console.log("listViewBtn selected:", listViewBtn);
    const themeSwitcher = document.querySelector('.theme-switcher');
    console.log("themeSwitcher selected:", themeSwitcher);
    const playerPopup = document.getElementById('player-popup');
    console.log("playerPopup selected:", playerPopup);
    const videoPlayer = document.getElementById('video-player');
    console.log("videoPlayer selected:", videoPlayer);
    const closePopupButton = document.getElementById('close-popup');
    console.log("closePopupButton selected:", closePopupButton);
    const popupChannelName = document.getElementById('popup-channel-name');
    console.log("popupChannelName selected:", popupChannelName);

    let hlsInstance = null;
    let allChannels = [];
    let currentFilter = { search: '', tag: 'all' };

    // --- Funções ---

    async function checkChannelStatus(channel) {
        // console.log(`Checking status for ${channel?.name}...`); // Log opcional (pode poluir muito)
        if (!channel || !channel.content || !channel.cardElement) return;
        const statusIndicator = channel.cardElement.querySelector('.status-indicator');
        if (!statusIndicator) return;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            // FORÇAR 'no-cors' TEMPORARIAMENTE para ver se o erro de CORS estava bloqueando algo mais
            // Isso fará com que a resposta seja opaca, mas *ainda* indica que o servidor respondeu.
            const response = await fetch(channel.content, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
            clearTimeout(timeoutId);
            // Se chegou aqui, o servidor respondeu (mesmo que a resposta seja opaca)
            updateStatusIndicator(channel.cardElement, 'ok');
        } catch (error) {
            // Apenas erros de rede (DNS, timeout, recusado) devem cair aqui com 'no-cors'
            console.warn(`Status check network error for ${channel.name}:`, error.name);
            updateStatusIndicator(channel.cardElement, 'error');
        }
    }

    function renderChannels(channelsToRender) {
        console.log("renderChannels called"); // Log
        if (!channelsContainer) { console.error("Cannot render: channelsContainer is null"); return; }
        channelsContainer.innerHTML = '';

        if (!channelsToRender || channelsToRender.length === 0) {
            channelsContainer.innerHTML = '<p class="no-results">Nenhum canal encontrado.</p>';
            return;
        }
        if (!channelCardTemplate) { console.error("Template 'channel-card-template' não encontrado!"); return; }

        channelsToRender.forEach((channel, index) => {
            // console.log(`Rendering channel ${index}: ${channel.name}`); // Log opcional
            try {
                const cardClone = channelCardTemplate.content.cloneNode(true);
                const cardElement = cardClone.querySelector('.channel-card');
                const logo = cardClone.querySelector('.channel-logo');
                const name = cardClone.querySelector('.channel-name');
                const tags = cardClone.querySelector('.channel-tags');
                const playButton = cardClone.querySelector('.play-button');
                const statusIndicator = cardClone.querySelector('.status-indicator'); // Pega o indicador aqui

                if (!cardElement || !logo || !name || !tags || !playButton || !statusIndicator) {
                    console.error(`Elementos faltando no template do card para: ${channel.name} (índice ${index})`);
                    return; // Pula este card
                }

                logo.src = channel.icon || 'placeholder.png';
                logo.alt = `Logo ${channel.name}`;
                name.textContent = channel.name;
                tags.textContent = `${channel.tag || ''} ${channel.type ? '| ' + channel.type : ''}`.trim();

                // Guarda referência do elemento ANTES de adicionar listeners
                channel.cardElement = cardElement;

                 // *** Adiciona listeners AGORA, que temos certeza que os elementos existem na 'cardClone' ***
                 console.log(`Adding listeners for ${channel.name}`); // Log

                 playButton.addEventListener('click', (e) => {
                     e.stopPropagation();
                     console.log(`---> Play BUTTON clicked for: ${channel.name}`); // Log de clique específico
                     playChannel(channel, cardElement); // Passa cardElement aqui
                 });

                 cardElement.addEventListener('click', () => {
                     console.log(`---> Card clicked for: ${channel.name}`); // Log de clique específico
                     playChannel(channel, cardElement); // Passa cardElement aqui
                 });

                 cardElement.addEventListener('keydown', (e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault();
                         console.log(`---> Card KEY activated for: ${channel.name}`); // Log de clique específico
                         playChannel(channel, cardElement); // Passa cardElement aqui
                     }
                 });

                // Adiciona ao DOM
                channelsContainer.appendChild(cardClone);

                // Inicia a verificação de status (já temos cardElement associado a channel)
                checkChannelStatus(channel);

            } catch (error) {
                console.error(`Erro ao renderizar o card para ${channel.name} (índice ${index}):`, error);
            }
        });
         console.log("renderChannels finished"); // Log
    }

    function filterAndRenderChannels() {
        console.log("Filtering and rendering channels..."); // Log
        if (!allChannels) { console.error("Cannot filter: allChannels is not defined."); return; }
        const searchTerm = currentFilter.search.toLowerCase().trim();
        const selectedTag = currentFilter.tag;

        const filteredChannels = allChannels.filter(channel => {
            const nameMatch = !searchTerm || (channel.name && channel.name.toLowerCase().includes(searchTerm));
            const tagMatch = selectedTag === 'all' || (channel.tag && channel.tag.toLowerCase() === selectedTag.toLowerCase());
            return nameMatch && tagMatch;
        });
        renderChannels(filteredChannels);
    }

    function playChannel(channel, cardElement) { // Recebe cardElement
        console.log(`---> playChannel called for: ${channel?.name}`); // Log no início da função
        if (!channel || !channel.content) { /* ... (erro) ... */ return; }
        if (!playerPopup || !videoPlayer || !popupChannelName) { console.error("Player elements missing!"); return; }

        popupChannelName.textContent = channel.name;

        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        videoPlayer.src = ''; videoPlayer.removeAttribute('src'); videoPlayer.onerror = null;

        // Garante que cardElement é válido antes de usá-lo
        if (cardElement) {
            cardElement.classList.remove('has-error');
            // updateStatusIndicator(cardElement, 'unknown'); // Comentado - manter status da checagem inicial
        } else {
             console.warn("cardElement was not passed correctly to playChannel for", channel.name);
        }


        const videoSrc = channel.content;
        console.log(`   Setting video source: ${videoSrc}`); // Log

        try {
            if (Hls.isSupported() && (videoSrc.includes('.m3u8') || videoSrc.includes('manifest'))) {
                // ... (lógica HLS.js com logs internos se necessário) ...
                 hlsInstance = new Hls();
                 hlsInstance.loadSource(videoSrc);
                 hlsInstance.attachMedia(videoPlayer);
                 hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(e => console.error("Play() failed:", e)));
                 hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                     console.error('HLS Error:', event, data);
                     if (cardElement) updateStatusIndicator(cardElement, 'error'); // Atualiza status no erro
                     if (data.fatal) closePopup();
                 });

            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl') && videoSrc.includes('.m3u8')) {
                // ... (lógica nativa) ...
                videoPlayer.src = videoSrc;
                videoPlayer.play().catch(e => console.error("Play() failed (native):", e));
                videoPlayer.onerror = (e) => {
                    console.error("Native video player error:", e);
                    if (cardElement) updateStatusIndicator(cardElement, 'error');
                    closePopup();
                };
            } else if (videoPlayer.canPlayType('audio/aac') && videoSrc.includes('.aac')) {
                // ... (lógica AAC) ...
                 videoPlayer.src = videoSrc;
                 videoPlayer.play().catch(e => console.error("Play() failed (AAC):", e));
                 videoPlayer.onerror = (e) => {
                    console.error("AAC audio player error:", e);
                    if (cardElement) updateStatusIndicator(cardElement, 'error');
                    closePopup();
                 };
            } else {
                console.error("Unsupported format or invalid URL:", videoSrc);
                alert(`Formato não suportado ou URL inválida para ${channel.name}.`);
                if (cardElement) updateStatusIndicator(cardElement, 'error');
                return;
            }

            playerPopup.classList.add('show');
            console.log("   Popup should be visible now."); // Log

        } catch (error) {
            console.error("Error setting up player:", error);
            alert(`Ocorreu um erro inesperado ao tentar tocar ${channel.name}.`);
            if (cardElement) updateStatusIndicator(cardElement, 'error');
        }
    }

    function closePopup() {
        console.log("Closing popup..."); // Log
        if (!playerPopup || !videoPlayer) return;
        playerPopup.classList.remove('show');
        videoPlayer.pause(); videoPlayer.src = ''; videoPlayer.removeAttribute('src');
        if (popupChannelName) popupChannelName.textContent = '';
        videoPlayer.onerror = null;
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    }

    function updateStatusIndicator(cardElement, status) {
        // console.log(`Updating status to ${status} for card:`, cardElement); // Log opcional
        if (cardElement) {
            const indicator = cardElement.querySelector('.status-indicator');
            if (indicator) {
                indicator.className = `status-indicator ${status}`;
                // ... (atualização de title) ...
            } else { console.warn("Status indicator not found in cardElement:", cardElement); }
        }
    }

    function setTheme(themeName) {
        console.log(`---> Setting theme to: ${themeName}`); // Log
        if (!document?.body) return;
        document.body.className = '';
        document.body.classList.add(themeName);
        localStorage.setItem('selectedTheme', themeName);
    }

    function loadTheme() {
        console.log("Loading theme..."); // Log
        const savedTheme = localStorage.getItem('selectedTheme');
        setTheme(savedTheme || 'theme-dark-purple');
    }

    // --- Event Listeners (com logs) ---

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            console.log(`---> Search input changed: ${e.target.value}`); // Log
            currentFilter.search = e.target.value;
            filterAndRenderChannels();
        });
    } else { console.error("Search input listener NOT added - element not found"); }

    if (tagFilter) {
        tagFilter.addEventListener('change', (e) => {
            console.log(`---> Tag filter changed: ${e.target.value}`); // Log
            currentFilter.tag = e.target.value;
            filterAndRenderChannels();
        });
    } else { console.error("Tag filter listener NOT added - element not found"); }

    if (gridViewBtn && listViewBtn && channelsContainer) {
        gridViewBtn.addEventListener('click', () => {
             console.log("---> Grid view button clicked"); // Log
            channelsContainer.classList.remove('list-view');
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
        });
        listViewBtn.addEventListener('click', () => {
             console.log("---> List view button clicked"); // Log
            channelsContainer.classList.add('list-view');
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
        });
         console.log("View button listeners added."); // Confirmação
    } else { console.error("View button listeners NOT added - elements not found"); }

    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', (e) => {
             console.log("Theme switcher container clicked. Target:", e.target); // Log importante
            // Verifica se o ALVO do clique é um BOTÃO e tem o atributo data-theme
            if (e.target.tagName === 'BUTTON' && e.target.dataset.theme) {
                const theme = e.target.dataset.theme;
                console.log(`   ---> Theme BUTTON clicked: ${theme}`); // Log específico
                setTheme(theme);
            } else {
                 console.log("   (Click was not on a theme button)"); // Log
            }
        });
         console.log("Theme switcher listener added."); // Confirmação
    } else { console.error("Theme switcher listener NOT added - element not found"); }

    if (closePopupButton) {
        closePopupButton.addEventListener('click', () => {
            console.log("---> Close popup button clicked"); // Log
            closePopup();
        });
         console.log("Close popup listener added."); // Confirmação
    } else { console.error("Close popup listener NOT added - element not found"); }

    if (playerPopup) {
        playerPopup.addEventListener('click', (e) => {
            if (e.target === playerPopup) {
                console.log("---> Popup background clicked (closing)"); // Log
                closePopup();
            }
        });
         console.log("Popup background close listener added."); // Confirmação
    } else { console.error("Popup background listener NOT added - element not found"); }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && playerPopup && playerPopup.classList.contains('show')) {
            console.log("---> Escape key pressed (closing popup)"); // Log
            closePopup();
        }
    });
    console.log("Escape key listener added."); // Confirmação

    // --- Inicialização ---
    function initialize() {
        console.log("--- Initializing Application ---");
        if (typeof canais !== 'undefined' && Array.isArray(canais)) {
            allChannels = canais;
            console.log(`Loaded ${allChannels.length} channels.`);
            loadTheme();
            channelsContainer?.classList.remove('list-view'); // Garante estado inicial
            gridViewBtn?.classList.add('active');
            listViewBtn?.classList.remove('active');
            filterAndRenderChannels(); // Renderiza e inicia verificações
            console.log("--- Initialization Complete ---");
        } else {
            console.error("Initialization failed: 'canais' array not found or invalid.");
            if (channelsContainer) channelsContainer.innerHTML = '<p class="error-loading">Erro fatal ao carregar canais.</p>';
        }
    }

    // Verifica elementos essenciais antes de iniciar
    if (channelsContainer && channelCardTemplate) {
        initialize();
    } else {
        console.error("Initialization aborted: Essential elements (channelsContainer or channelCardTemplate) not found.");
    }

}); // Fim do DOMContentLoaded