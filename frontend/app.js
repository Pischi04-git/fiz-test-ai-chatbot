/**
 * FIZ Karlsruhe – AI Research Assistant
 * Frontend Logic: SSE Streaming, Chat History, AI Titles
 */

const API_BASE = "http://localhost:8000";

// =====================================================
// CONSTANTS & STATE
// =====================================================

const STORAGE_KEY = "fiz_chats";        // localStorage key for all chats
const MAX_CHATS = 30;                    // Max saved chats to keep

let isStreaming = false;

// =====================================================
// CHAT STORE (localStorage)
// =====================================================

/**
 * Returns the full chats object from localStorage.
 * Structure: { [chatId]: { id, title, createdAt, messages: [{role, content, time}] } }
 */
function loadAllChats() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveAllChats(chats) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (e) {
        console.error("Failed to save chats:", e);
    }
}

function createNewChat() {
    const id = crypto.randomUUID();
    const chat = {
        id,
        title: "Neuer Chat",
        createdAt: Date.now(),
        messages: [],
    };
    const chats = loadAllChats();
    chats[id] = chat;
    // Limit to MAX_CHATS (remove oldest)
    const keys = Object.keys(chats).sort((a, b) => chats[a].createdAt - chats[b].createdAt);
    while (keys.length > MAX_CHATS) {
        delete chats[keys.shift()];
    }
    saveAllChats(chats);
    return chat;
}

function getChat(id) {
    return loadAllChats()[id] || null;
}

function saveMessage(chatId, role, content) {
    const chats = loadAllChats();
    if (!chats[chatId]) return;
    chats[chatId].messages.push({
        role,
        content,
        time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    });
    saveAllChats(chats);
}

function updateChatTitle(chatId, title) {
    const chats = loadAllChats();
    if (chats[chatId]) {
        chats[chatId].title = title;
        saveAllChats(chats);
    }
}

// =====================================================
// CURRENT SESSION
// =====================================================

let currentChatId = null;

function initSession() {
    const chats = loadAllChats();
    const keys = Object.keys(chats).sort((a, b) => chats[b].createdAt - chats[a].createdAt);
    if (keys.length > 0) {
        loadChat(keys[0]); // Load most recent
    } else {
        startNewChat();
    }
}

function startNewChat() {
    const chat = createNewChat();
    currentChatId = chat.id;
    renderChatHistorySidebar();
    clearChatMessages();
    updateHeaderTitle("FIZ AI Assistant");
    showWelcome(true);
}

function loadChat(chatId) {
    const chat = getChat(chatId);
    if (!chat) return;
    currentChatId = chatId;
    clearChatMessages();
    if (chat.messages.length === 0) {
        showWelcome(true);
        updateHeaderTitle("FIZ AI Assistant");
    } else {
        showWelcome(false);
        updateHeaderTitle(chat.title);
        chat.messages.forEach((msg) => {
            renderMessageFromHistory(msg.role, msg.content, msg.time);
        });
        scrollToBottom();
    }
    renderChatHistorySidebar();
}

// =====================================================
// DOM ELEMENTS
// =====================================================

const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const btnSend = document.getElementById("btn-send");
const btnNewChat = document.getElementById("btn-new-chat");
const btnMobileMenu = document.getElementById("btn-mobile-menu");
const welcomeEl = document.getElementById("welcome");
const chatTitle = document.getElementById("chat-title");
const chatHistoryList = document.getElementById("chat-history-list");
const sidebar = document.getElementById("sidebar");
const rightSidebar = document.getElementById("right-sidebar");
const btnSettings = document.getElementById("btn-settings");

// Upload modal elements
const btnUploadDocs = document.getElementById("btn-upload-docs");
const uploadModal = document.getElementById("upload-modal");
const uploadBackdrop = document.getElementById("upload-backdrop");
const btnUploadClose = document.getElementById("btn-upload-close");
const uploadDropzone = document.getElementById("upload-dropzone");
const uploadInput = document.getElementById("upload-input");
const btnUploadPick = document.getElementById("btn-upload-pick");
const btnUploadStart = document.getElementById("btn-upload-start");
const uploadSelected = document.getElementById("upload-selected");
const uploadStatus = document.getElementById("upload-status");

let pendingUploadFiles = [];

// =====================================================
// INIT
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    setupMarked();
    setupEventListeners();
    initSession();
    messageInput.focus();
});

// =====================================================
// MARKED.JS SETUP
// =====================================================

function setupMarked() {
    if (typeof marked !== "undefined") {
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false,
        });
    }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        sendMessage();
    });

    messageInput.addEventListener("input", () => {
        btnSend.disabled = !messageInput.value.trim() || isStreaming;
        autoResize();
    });

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!btnSend.disabled) sendMessage();
        }
    });

    btnNewChat.addEventListener("click", startNewChat);

    btnMobileMenu.addEventListener("click", () => {
        sidebar.classList.toggle("hidden");
        sidebar.classList.toggle("flex");
    });

    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            alert("Sitzungsprofil: Wolfram Horstmann\nEinstellungen sind in dieser Demo eingeschränkt.");
        });
    }

    // Suggestion chips
    document.querySelectorAll(".suggestion-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            messageInput.value = chip.dataset.suggestion;
            messageInput.dispatchEvent(new Event("input"));
            sendMessage();
        });
    });

    // Upload modal
    if (btnUploadDocs) btnUploadDocs.addEventListener("click", openUploadModal);
    if (btnUploadClose) btnUploadClose.addEventListener("click", closeUploadModal);
    if (uploadBackdrop) uploadBackdrop.addEventListener("click", closeUploadModal);
    if (btnUploadPick && uploadInput) btnUploadPick.addEventListener("click", () => uploadInput.click());

    if (uploadInput) {
        uploadInput.addEventListener("change", () => {
            pendingUploadFiles = Array.from(uploadInput.files || []);
            renderSelectedUploadFiles();
        });
    }

    if (uploadDropzone) {
        uploadDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            uploadDropzone.classList.add("border-fiz-blue");
            uploadDropzone.classList.add("bg-blue-50");
        });
        uploadDropzone.addEventListener("dragleave", () => {
            uploadDropzone.classList.remove("border-fiz-blue");
            uploadDropzone.classList.remove("bg-blue-50");
        });
        uploadDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            uploadDropzone.classList.remove("border-fiz-blue");
            uploadDropzone.classList.remove("bg-blue-50");
            const files = Array.from(e.dataTransfer?.files || []);
            if (files.length) {
                pendingUploadFiles = files;
                if (uploadInput) {
                    // Mirror into input (best effort; some browsers block programmatic FileList)
                    uploadInput.value = "";
                }
                renderSelectedUploadFiles();
            }
        });
    }

    if (btnUploadStart) {
        btnUploadStart.addEventListener("click", async () => {
            await uploadDocuments(pendingUploadFiles);
        });
    }
}

function openUploadModal() {
    if (!uploadModal) return;
    uploadModal.classList.remove("hidden");
    uploadModal.classList.add("flex");
    if (uploadStatus) uploadStatus.textContent = "";
    renderSelectedUploadFiles();
}

function closeUploadModal() {
    if (!uploadModal) return;
    uploadModal.classList.add("hidden");
    uploadModal.classList.remove("flex");
}

function renderSelectedUploadFiles() {
    if (!uploadSelected) return;
    if (!pendingUploadFiles || pendingUploadFiles.length === 0) {
        uploadSelected.textContent = "Keine Dateien ausgewählt.";
        return;
    }
    const names = pendingUploadFiles.map((f) => f.name).join(", ");
    uploadSelected.textContent = `${pendingUploadFiles.length} Datei(en): ${names}`;
}

async function uploadDocuments(files) {
    if (!uploadStatus) return;
    if (!files || files.length === 0) {
        uploadStatus.textContent = "Bitte zuerst Dateien auswählen.";
        return;
    }

    const form = new FormData();
    for (const f of files) {
        form.append("files", f, f.name);
    }

    uploadStatus.textContent = "Upload läuft…";
    if (btnUploadStart) btnUploadStart.disabled = true;
    if (btnUploadPick) btnUploadPick.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/documents/upload`, {
            method: "POST",
            body: form,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const detail = data?.detail || res.statusText;
            uploadStatus.textContent = `Fehler (${res.status}): ${detail}`;
            return;
        }

        uploadStatus.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        uploadStatus.textContent = `Fehler: ${e?.message || e}`;
    } finally {
        if (btnUploadStart) btnUploadStart.disabled = false;
        if (btnUploadPick) btnUploadPick.disabled = false;
    }
}

// =====================================================
// TEXTAREA AUTO-RESIZE
// =====================================================

function autoResize() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
}

// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isStreaming) return;

    showWelcome(false);

    // Is this the first message in this chat?
    const chat = getChat(currentChatId);
    const isFirstMessage = chat && chat.messages.length === 0;

    // Save user message
    saveMessage(currentChatId, "user", text);

    // Add user message to DOM
    const now = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    appendMessage("user", text, now);

    messageInput.value = "";
    messageInput.style.height = "auto";
    btnSend.disabled = true;
    isStreaming = true;

    // Append assistant bubble with typing indicator
    const { bubble } = appendMessage("assistant", "", now);
    showTypingIndicator(bubble);

    let fullText = "";

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                session_id: currentChatId || "default",
                user_id: "default",
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data === "[DONE]") continue;

                    let token = data;
                    try {
                        token = JSON.parse(data);
                    } catch { }

                    if (fullText === "") {
                        bubble.innerHTML = "";
                    }

                    fullText += token;
                    renderAssistantText(bubble, fullText);
                    scrollToBottom();
                }
            }
        }

        // Final render
        if (fullText) {
            renderAssistantText(bubble, fullText);
        } else {
            bubble.textContent = "⚠️ Keine Antwort erhalten.";
        }

        // Save assistant message
        saveMessage(currentChatId, "assistant", fullText);

        // Generate title from first message AFTER chat is done to avoid blocking local LM
        if (isFirstMessage) {
            const activeChatId = currentChatId;
            fetch(`${API_BASE}/api/chat/title`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.title) {
                        updateChatTitle(activeChatId, data.title);
                        if (currentChatId === activeChatId) {
                            updateHeaderTitle(data.title);
                        }
                        renderChatHistorySidebar();
                    }
                })
                .catch(err => console.error("Title generation failed:", err));
        }

    } catch (error) {
        console.error("Chat error:", error);
        bubble.innerHTML = "";
        bubble.textContent = `⚠️ Fehler: ${error.message}. Ist das Backend auf Port 8000 gestartet?`;
        saveMessage(currentChatId, "assistant", bubble.textContent);
    } finally {
        isStreaming = false;
        btnSend.disabled = !messageInput.value.trim();
        messageInput.focus();
        scrollToBottom();
    }
}

// =====================================================
// DOM – RENDER MESSAGES
// =====================================================

function appendMessage(role, content, time) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const avatarDiv = document.createElement("div");
    avatarDiv.className = `message-avatar ${role}`;
    if (role === "assistant") {
        avatarDiv.textContent = "FIZ";
    } else {
        avatarDiv.innerHTML = `
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
        `;
    }

    const contentDiv = document.createElement("div");
    contentDiv.className = `message-content ${role}`;

    const meta = document.createElement("p");
    meta.className = "message-meta";
    meta.textContent = role === "assistant"
        ? `Assistant • ${time}`
        : `Sie • ${time}`;

    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${role}`;

    if (content) {
        if (role === "assistant") {
            renderAssistantText(bubble, content);
        } else {
            bubble.textContent = content;
        }
    }

    contentDiv.appendChild(meta);
    contentDiv.appendChild(bubble);

    if (role === "user") {
        row.appendChild(contentDiv);
        row.appendChild(avatarDiv);
    } else {
        row.appendChild(avatarDiv);
        row.appendChild(contentDiv);
    }

    chatContainer.appendChild(row);
    scrollToBottom();

    // Trigger right sidebar update for context (demo)
    updateRightSidebar(role, content);

    return { row, bubble };
}

/**
 * Demo helper to show context in the right sidebar
 */
function updateRightSidebar(role, content) {
    if (!rightSidebar) return;
    // In a real app, this would show relevant docs or metadata for the message
}

function renderMessageFromHistory(role, content, time) {
    const { bubble } = appendMessage(role, "", time);
    if (role === "assistant") {
        renderAssistantText(bubble, content);
    } else {
        bubble.textContent = content;
    }
}

// =====================================================
// MARKDOWN RENDERING
// =====================================================

function processThinkTags(text) {
    let newText = text;
    // Match closed <think> blocks
    const closedRegex = /<think>([\s\S]*?)<\/think>/g;
    newText = newText.replace(closedRegex, (match, p1) => {
        return `<details class="think-block my-3 bg-slate-50 border border-slate-200 rounded-lg p-3 shadow-sm transition-all"><summary class="cursor-pointer text-slate-500 font-medium text-xs uppercase tracking-wide flex items-center gap-2 select-none hover:text-slate-800"><svg class="w-4 h-4 text-fiz-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Gedankenprozess</summary><div class="think-content text-slate-600 text-sm mt-3 pt-2 border-t border-slate-200">${marked.parse(p1)}</div></details>\n\n`;
    });

    // Check for unclosed <think> at the end
    const lastThink = newText.lastIndexOf("<think>");
    const lastEnd = newText.lastIndexOf("</think>");
    if (lastThink > lastEnd || (lastThink !== -1 && lastEnd === -1)) {
        const contentBefore = newText.slice(0, lastThink);
        const thinkContent = newText.slice(lastThink + 7);
        const streamingThinkHtml = `<details class="think-block my-3 bg-blue-50/50 border border-blue-100 rounded-lg p-3 shadow-sm transition-all" open><summary class="cursor-pointer text-fiz-blue font-medium text-xs uppercase tracking-wide flex items-center gap-2 select-none"><svg class="w-4 h-4 animate-spin text-fiz-blue" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Denkt nach...</summary><div class="think-content text-slate-600 text-sm mt-3 pt-2 border-t border-slate-200">${marked.parse(thinkContent)}<span class="inline-block w-1.5 h-3 ml-1 bg-fiz-blue animate-pulse"></span></div></details>`;
        return { text: contentBefore, suffix: streamingThinkHtml };
    }

    return { text: newText, suffix: "" };
}

function renderAssistantText(el, text) {
    if (typeof marked === "undefined") {
        el.textContent = text;
        return;
    }
    try {
        const { text: processedText, suffix } = processThinkTags(text);
        let finalHtml = marked.parse(processedText);
        el.innerHTML = finalHtml + suffix;
    } catch {
        el.textContent = text;
    }
}

// =====================================================
// TYPING INDICATOR
// =====================================================

function showTypingIndicator(bubble) {
    bubble.innerHTML = `
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
}

// =====================================================
// UI HELPERS
// =====================================================

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

function showWelcome(show) {
    if (welcomeEl) {
        welcomeEl.style.display = show ? "flex" : "none";
    }
}

function clearChatMessages() {
    // Remove all message rows
    chatContainer.querySelectorAll(".message-row").forEach((m) => m.remove());
}

function updateHeaderTitle(title) {
    if (title === "AI Research Assistant" || title === "Nexious AI Assistant" || title === "FIZ AI Assistant") {
        chatTitle.textContent = "FIZ AI Assistant";
    } else {
        chatTitle.textContent = title;
    }
}

// =====================================================
// SIDEBAR – CHAT HISTORY
// =====================================================

function renderChatHistorySidebar() {
    const chats = loadAllChats();
    const keys = Object.keys(chats).sort((a, b) => chats[b].createdAt - chats[a].createdAt);

    chatHistoryList.innerHTML = "";

    if (keys.length === 0) {
        chatHistoryList.innerHTML = `<li class="text-slate-600 text-xs px-3 py-2">Noch keine Chats</li>`;
        return;
    }

    keys.forEach((id) => {
        const c = chats[id];
        const li = document.createElement("li");

        const btn = document.createElement("button");
        btn.className = `chat-history-item ${id === currentChatId ? "active" : ""}`;
        btn.textContent = c.title;
        btn.title = c.title;

        btn.addEventListener("click", () => {
            if (id !== currentChatId) {
                // Save backend session for old chat (no-op here, backend uses session_id per request)
                loadChat(id);
            }
        });

        li.appendChild(btn);
        chatHistoryList.appendChild(li);
    });
}
