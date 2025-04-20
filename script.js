// ========================================================================
// script.js para BlackSignal Hub
// Contém a lógica principal da aplicação, incluindo renderização,
// filtros, player de vídeo/áudio HLS, troca de temas e
// atualização dinâmica de meta tags.
// ========================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed - Initializing BlackSignal Hub"); // Log inicial

    // --- Elementos do DOM ---
    // Adiciona logs para verificar se a seleção inicial funciona
    const channelsContainer = document.querySelector('.channels-container');
    console.log("DOM Element - channelsContainer:", channelsContainer);
    const channelCardTemplate = document.getElementById('channel-card-template');
    console.log("DOM Element - channelCardTemplate:", channelCardTemplate);
    const searchInput = document.getElementById('search-input');
    console.log("DOM Element - searchInput:", searchInput);
    const tagFilter = document.getElementById('tag-filter');
    console.log("DOM Element - tagFilter:", tagFilter);
    const gridViewBtn = document.getElementById('grid-view');
    console.log("DOM Element - gridViewBtn:", gridViewBtn);
    const listViewBtn = document.getElementById('list-view');
    console.log("DOM Element - listViewBtn:", listViewBtn);
    const themeSwitcher = document.querySelector('.theme-switcher');
    console.log("DOM Element - themeSwitcher:", themeSwitcher);
    const playerPopup = document.getElementById('player-popup');
    console.log("DOM Element - playerPopup:", playerPopup);
    const videoPlayer = document.getElementById('video-player');
    console.log("DOM Element - videoPlayer:", videoPlayer);
    const closePopupButton = document.getElementById('close-popup');
    console.log("DOM Element - closePopupButton:", closePopupButton);
    const popupChannelName = document.getElementById('popup-channel-name');
    console.log("DOM Element - popupChannelName:", popupChannelName);

    // --- Variáveis Globais do Script ---
    let hlsInstance = null; // Instância do HLS.js
    let allChannels = [];   // Array para guardar os dados dos canais de canais.js
    let currentFilter = { search: '', tag: 'all' }; // Estado atual dos filtros

    // --- Funções Auxiliares ---

    /**
     * Atualiza as meta tags (description, Open Graph, Twitter) dinamicamente.
     * @param {object|null} channel - O objeto do canal sendo visto, ou null/undefined para resetar para o padrão.
     */
    function updateMetaTags(channel = null) {
        console.log("Updating meta tags. Channel:", channel ? channel.name : "Default");

        // --- Valores Padrão ---
        // Tenta pegar os valores padrão do HTML primeiro, com fallbacks
        const defaultOgImage = document.querySelector('meta[property="og:image"]')?.content || 'URL_DA_IMAGEM_PADRAO_AQUI';
        const defaultOgUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;

        let title = "BlackSignal Hub";
        let description = "Explore e assista a uma variedade de canais de TV e Rádio ao vivo no BlackSignal Hub.";
        let ogTitle = "BlackSignal Hub - Central de Streaming Ao Vivo";
        let ogDescription = "Sua central para encontrar e assistir canais de TV e Rádio online.";
        let ogImage = defaultOgImage;
        let pageUrl = defaultOgUrl;

        // --- Valores Dinâmicos ---
        if (channel && channel.name) {
            title = `Assistindo ${channel.name} | BlackSignal Hub`;
            description = `Assista ao canal ${channel.name} ao vivo no BlackSignal Hub.`;
            ogTitle = `Assistindo: ${channel.name}`;
            ogDescription = `Transmissão ao vivo de ${channel.name} no BlackSignal Hub.`;
            if (channel.icon) {
                // Valida se o ícone é uma URL completa antes de usar
                try {
                    new URL(channel.icon); // Tenta criar uma URL, se falhar, não é válida
                    ogImage = channel.icon;
                } catch (_) {
                    console.warn(`Ícone do canal ${channel.name} não é uma URL válida, usando padrão.`);
                    ogImage = defaultOgImage; // Usa padrão se ícone for inválido
                }
            } else {
                 ogImage = defaultOgImage; // Usa padrão se não houver ícone
            }
            // pageUrl = `${defaultOgUrl}#channel=${encodeURIComponent(channel.name)}`; // Opcional: Adicionar hash
        }

        // --- Atualizar os Elementos Meta ---
        document.title = title;

        const setMetaTag = (attrType, attrValue, content) => {
            if (content === undefined || content === null) {
                 console.warn(`Conteúdo indefinido para meta [${attrType}="${attrValue}"]`);
                 return; // Não define meta tag com conteúdo vazio/nulo
            }
            let element = document.querySelector(`meta[${attrType}="${attrValue}"]`);
            if (element) {
                element.setAttribute('content', content);
            } else {
                element = document.createElement('meta');
                element.setAttribute(attrType, attrValue);
                element.setAttribute('content', content);
                document.head.appendChild(element);
                console.warn(`Created meta tag dynamically: [${attrType}="${attrValue}"]`);
            }
        };

        setMetaTag('name', 'description', description);
        setMetaTag('property', 'og:title', ogTitle);
        setMetaTag('property', 'og:description', ogDescription);
        setMetaTag('property', 'og:image', ogImage);
        setMetaTag('property', 'og:url', pageUrl);
        setMetaTag('name', 'twitter:title', ogTitle);
        setMetaTag('name', 'twitter:description', ogDescription);
        setMetaTag('name', 'twitter:image', ogImage);
        setMetaTag('name', 'twitter:url', pageUrl);

        console.log("Meta tags updated.");
    }

    /**
     * Tenta verificar rapidamente se a URL do stream é alcançável via HEAD request.
     * Atualiza o indicador visual do card (verde neon = servidor respondeu, cinza = erro de rede).
     */
    async function checkChannelStatus(channel) {
        if (!channel || !channel.content || !channel.cardElement) return;
        const statusIndicator = channel.cardElement.querySelector('.status-indicator');
        if (!statusIndicator) return;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            // Usar 'no-cors' para evitar bloqueios de CORS na verificação inicial,
            // focando apenas na alcançabilidade do servidor.
            await fetch(channel.content, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
            clearTimeout(timeoutId);
            updateStatusIndicator(channel.cardElement, 'ok');
        } catch (error) {
            console.warn(`Status check network error for ${channel.name}:`, error.name);
            updateStatusIndicator(channel.cardElement, 'error');
        }
    }

    /**
     * Atualiza a classe CSS e o título do indicador de status.
     */
    function updateStatusIndicator(cardElement, status) {
        if (cardElement) {
            const indicator = cardElement.querySelector('.status-indicator');
            if (indicator) {
                indicator.className = `status-indicator ${status}`;
                switch (status) {
                    case 'ok': indicator.title = 'Canal potencialmente online (servidor respondeu)'; break;
                    case 'error': indicator.title = 'Não foi possível alcançar o servidor ou erro ao tocar'; break;
                    default: indicator.title = 'Status desconhecido'; break;
                }
            } else { console.warn("Status indicator not found in cardElement:", cardElement); }
        }
    }

    /**
     * Aplica um tema CSS ao body e salva a preferência no localStorage.
     */
    function setTheme(themeName) {
        console.log(`---> Setting theme to: ${themeName}`);
        if (!document?.body || !themeName) return;
        // Remove classes de tema antigas baseadas em um padrão (ex: 'theme-')
        const themePrefix = 'theme-';
        document.body.classList.forEach(className => {
            if (className.startsWith(themePrefix)) {
                document.body.classList.remove(className);
            }
        });
        // Adiciona a nova classe de tema
        document.body.classList.add(themeName);
        localStorage.setItem('selectedTheme', themeName);
    }

    /**
     * Carrega o tema salvo do localStorage ou aplica o padrão.
     */
    function loadTheme() {
        console.log("Loading theme...");
        const savedTheme = localStorage.getItem('selectedTheme');
        // Valida se o tema salvo é um dos temas esperados (opcional, mas bom)
        const validThemes = ['theme-dark-purple', 'theme-cyber-blue', 'theme-red-alert', 'theme-pink-glow', 'theme-light-mode'];
        const themeToApply = (savedTheme && validThemes.includes(savedTheme)) ? savedTheme : 'theme-dark-purple'; // Padrão
        setTheme(themeToApply);
    }

    /**
     * Fecha o popup do player, para a reprodução e reseta o estado.
     */
    function closePopup() {
        console.log("Closing popup...");
        if (!playerPopup || !videoPlayer) return;
        playerPopup.classList.remove('show');
        videoPlayer.pause();
        videoPlayer.src = '';
        videoPlayer.removeAttribute('src');
        if (popupChannelName) popupChannelName.textContent = '';
        videoPlayer.onerror = null;
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        updateMetaTags(); // <<< Resetar meta tags para o padrão ao fechar
    }

    // --- Funções Principais ---

    /**
     * Renderiza os cards dos canais no container.
     * @param {Array} channelsToRender - Array de objetos de canal a serem exibidos.
     */
    function renderChannels(channelsToRender) {
        console.log(`renderChannels called with ${channelsToRender?.length || 0} channels`);
        if (!channelsContainer) { console.error("Cannot render: channelsContainer is null"); return; }
        channelsContainer.innerHTML = ''; // Limpa antes de adicionar

        if (!channelsToRender || channelsToRender.length === 0) {
            channelsContainer.innerHTML = '<p class="no-results">Nenhum canal encontrado para os filtros atuais.</p>';
            return;
        }
        if (!channelCardTemplate) { console.error("Template 'channel-card-template' não encontrado!"); return; }

        channelsToRender.forEach((channel, index) => {
            try {
                const cardClone = channelCardTemplate.content.cloneNode(true);
                const cardElement = cardClone.querySelector('.channel-card');
                const logo = cardClone.querySelector('.channel-logo');
                const name = cardClone.querySelector('.channel-name');
                const tags = cardClone.querySelector('.channel-tags');
                const playButton = cardClone.querySelector('.play-button');
                const statusIndicator = cardClone.querySelector('.status-indicator'); // Pega o indicador

                if (!cardElement || !logo || !name || !tags || !playButton || !statusIndicator) {
                    console.error(`Elementos faltando no template do card para: ${channel.name} (índice ${index})`);
                    return; // Pula este card
                }

                logo.src = channel.icon || 'placeholder.png';
                logo.alt = `Logo ${channel.name}`;
                name.textContent = channel.name;
                tags.textContent = `${channel.tag || ''} ${channel.type ? '| ' + channel.type : ''}`.trim();

                // Guarda referência do elemento para fácil acesso posterior (ex: status check)
                channel.cardElement = cardElement;

                // Adiciona listeners para interatividade
                playButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Impede clique duplo se o card também tiver listener
                    console.log(`---> Play BUTTON clicked for: ${channel.name}`);
                    playChannel(channel); // Passa só o canal, pegamos cardElement lá se precisar
                });

                cardElement.addEventListener('click', () => {
                    console.log(`---> Card clicked for: ${channel.name}`);
                    playChannel(channel);
                });

                cardElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault(); // Impede scroll com space
                        console.log(`---> Card KEY activated for: ${channel.name}`);
                        playChannel(channel);
                    }
                });

                // Adiciona o card clonado e preenchido ao DOM
                channelsContainer.appendChild(cardClone);

                // Inicia a verificação de status inicial para este canal (assíncrono)
                checkChannelStatus(channel);

            } catch (error) {
                console.error(`Erro ao renderizar o card para ${channel.name} (índice ${index}):`, error);
            }
        });
        console.log("renderChannels finished");
    }

    /**
     * Filtra a lista completa de canais baseado nos critérios atuais e chama renderChannels.
     */
    function filterAndRenderChannels() {
        console.log("Filtering and rendering channels based on:", currentFilter);
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

    /**
     * Inicia a reprodução de um canal no popup.
     * @param {object} channel - O objeto do canal a ser tocado.
     */
    function playChannel(channel) {
        console.log(`---> playChannel called for: ${channel?.name}`);
        if (!channel || !channel.content) {
             console.error("Dados do canal inválidos para reprodução.");
             alert("Não foi possível obter informações para tocar este canal.");
             return;
        }
        if (!playerPopup || !videoPlayer || !popupChannelName) {
             console.error("Elementos do Player Popup não encontrados!");
             alert("Erro interno: Player não encontrado.");
             return;
        }

        // --- Prepara o Player ---
        // Atualiza meta tags ANTES de mostrar o player
        updateMetaTags(channel); // <<< Definir metas do canal aqui

        popupChannelName.textContent = channel.name; // Nome no popup

        // Limpa estado anterior
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        videoPlayer.src = ''; videoPlayer.removeAttribute('src'); videoPlayer.onerror = null;

        // Remove erro visual do card, se houver
        const cardElement = channel.cardElement; // Pega a referência guardada
        if (cardElement) {
            cardElement.classList.remove('has-error');
        }

        const videoSrc = channel.content;
        console.log(`   Setting video source for HLS/Native playback: ${videoSrc}`);

        // --- Tenta Reproduzir ---
        try {
            if (Hls.isSupported() && (videoSrc.includes('.m3u8') || videoSrc.includes('manifest'))) {
                console.log("   Using HLS.js for playback.");
                hlsInstance = new Hls({ /* Configurações HLS opcionais */ });
                hlsInstance.loadSource(videoSrc);
                hlsInstance.attachMedia(videoPlayer);
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(e => console.error("HLS.js Play() failed:", e)));
                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    console.error('HLS.js Error:', event, data);
                    if (cardElement) updateStatusIndicator(cardElement, 'error'); // Marca status como erro
                    if (data.fatal) {
                         console.error("   Fatal HLS error encountered.");
                         alert(`Erro fatal ao carregar o canal ${channel.name}. Verifique o console.`);
                         closePopup();
                    }
                });

            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl') && videoSrc.includes('.m3u8')) {
                console.log("   Using Native HLS playback.");
                videoPlayer.src = videoSrc;
                videoPlayer.play().catch(e => console.error("Native Play() failed:", e));
                videoPlayer.onerror = (e) => {
                    console.error("Native video player error:", e);
                    if (cardElement) updateStatusIndicator(cardElement, 'error');
                     alert(`Erro ao carregar o canal ${channel.name} (nativo).`);
                    closePopup();
                };

            } else if (videoPlayer.canPlayType('audio/aac') && videoSrc.includes('.aac')) {
                 console.log("   Playing AAC audio stream.");
                 videoPlayer.src = videoSrc;
                 videoPlayer.play().catch(e => console.error("AAC Play() failed:", e));
                 videoPlayer.onerror = (e) => {
                    console.error("AAC audio player error:", e);
                    if (cardElement) updateStatusIndicator(cardElement, 'error');
                    alert(`Erro ao carregar a rádio ${channel.name}.`);
                    closePopup();
                 };
            } else {
                console.error("   Unsupported format or invalid URL:", videoSrc);
                alert(`Formato não suportado ou URL inválida para ${channel.name}.`);
                if (cardElement) updateStatusIndicator(cardElement, 'error');
                updateMetaTags(); // Reseta meta tags se não puder tocar
                return; // Não abre popup
            }

            // Mostra o popup APÓS configurar a fonte
            playerPopup.classList.add('show');
            console.log("   Player popup is now visible.");

        } catch (error) {
            console.error("   Error setting up player:", error);
            alert(`Ocorreu um erro inesperado ao tentar tocar ${channel.name}.`);
            if (cardElement) updateStatusIndicator(cardElement, 'error');
            updateMetaTags(); // Reseta meta tags no erro
        }
    }

    // --- Configuração dos Event Listeners ---

    function setupEventListeners() {
        console.log("Setting up event listeners...");

        // Filtro de busca
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                console.log(`---> Search input changed: ${e.target.value}`);
                currentFilter.search = e.target.value;
                filterAndRenderChannels();
            });
        } else { console.error("Search input listener NOT added - element not found"); }

        // Filtro de tag
        if (tagFilter) {
            tagFilter.addEventListener('change', (e) => {
                console.log(`---> Tag filter changed: ${e.target.value}`);
                currentFilter.tag = e.target.value;
                filterAndRenderChannels();
            });
        } else { console.error("Tag filter listener NOT added - element not found"); }

        // Botões de visualização (Grid/Lista)
        if (gridViewBtn && listViewBtn && channelsContainer) {
            gridViewBtn.addEventListener('click', () => {
                console.log("---> Grid view button clicked");
                channelsContainer.classList.remove('list-view');
                gridViewBtn.classList.add('active');
                listViewBtn.classList.remove('active');
            });
            listViewBtn.addEventListener('click', () => {
                console.log("---> List view button clicked");
                channelsContainer.classList.add('list-view');
                listViewBtn.classList.add('active');
                gridViewBtn.classList.remove('active');
            });
            console.log("View button listeners added.");
        } else { console.error("View button listeners NOT added - elements not found"); }

        // Botões de troca de tema (usando delegação)
        if (themeSwitcher) {
            themeSwitcher.addEventListener('click', (e) => {
                console.log("Theme switcher container clicked. Target:", e.target);
                if (e.target.tagName === 'BUTTON' && e.target.dataset.theme) {
                    const theme = e.target.dataset.theme;
                    console.log(`   ---> Theme BUTTON clicked: ${theme}`);
                    setTheme(theme);
                } else {
                    console.log("   (Click was not on a theme button)");
                }
            });
            console.log("Theme switcher listener added.");
        } else { console.error("Theme switcher listener NOT added - element not found"); }

        // Fechar popup (botão X e clique no fundo)
        if (closePopupButton) {
            closePopupButton.addEventListener('click', () => {
                console.log("---> Close popup button clicked");
                closePopup();
            });
            console.log("Close popup listener added.");
        } else { console.error("Close popup listener NOT added - element not found"); }

        if (playerPopup) {
            playerPopup.addEventListener('click', (e) => {
                if (e.target === playerPopup) { // Clique no fundo escuro
                    console.log("---> Popup background clicked (closing)");
                    closePopup();
                }
            });
            console.log("Popup background close listener added.");
        } else { console.error("Popup background listener NOT added - element not found"); }

        // Fechar popup com tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && playerPopup && playerPopup.classList.contains('show')) {
                console.log("---> Escape key pressed (closing popup)");
                closePopup();
            }
        });
        console.log("Escape key listener added.");

        console.log("Event listeners setup complete.");
    }


    // --- Inicialização da Aplicação ---
    function initialize() {
        console.log("--- Initializing Application ---");
        if (typeof canais !== 'undefined' && Array.isArray(canais)) {
            allChannels = canais; // Carrega os canais do arquivo canais.js
            console.log(`Loaded ${allChannels.length} channels from canais.js.`);

            loadTheme();          // Aplica o tema salvo ou padrão
            updateMetaTags();     // Define as meta tags padrão iniciais
            setupEventListeners();// Configura todos os listeners de UI

            // Define estado inicial da visualização
            channelsContainer?.classList.remove('list-view');
            gridViewBtn?.classList.add('active');
            listViewBtn?.classList.remove('active');

            // Renderiza os canais (que inclui a verificação de status inicial)
            filterAndRenderChannels();

            console.log("--- BlackSignal Hub Initialization Complete ---");
        } else {
            console.error("Initialization failed: 'canais' array not found or invalid. Check 'canais.js'.");
            if (channelsContainer) channelsContainer.innerHTML = '<p class="error-loading">Erro fatal ao carregar a lista de canais.</p>';
        }
    }

    // Garante que os elementos mínimos existem antes de tentar inicializar
    if (channelsContainer && channelCardTemplate) {
        initialize();
    } else {
        console.error("Initialization aborted: Essential elements (channelsContainer or channelCardTemplate) not found in the DOM.");
        alert("Erro crítico: Elementos essenciais da página não foram encontrados. A aplicação não pode iniciar.");
    }

}); // Fim do DOMContentLoaded