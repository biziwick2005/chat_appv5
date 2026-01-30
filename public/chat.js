// ==============================
// GLOBAL VARIABLES & CONFIG
// ==============================
let socket;
let currentRoom = 1;
let currentUser = null;
let messagesPage = 1;
let messagesLimit = 50;
let typingTimeout = null;
let uploadedFiles = [];
let emojiPicker = null;
let isTyping = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// DOM Elements
const elements = {
    messagesDiv: document.getElementById('messages'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    logoutBtn: document.getElementById('logoutBtn'),
    currentRoom: document.getElementById('currentRoom'),
    onlineUsers: document.getElementById('onlineUsers'),
    onlineCount: document.getElementById('onlineCount'),
    roomList: document.getElementById('roomList'),
    usernameDisplay: document.getElementById('usernameDisplay'),
    userStatus: document.getElementById('userStatus'),
    typingIndicator: document.getElementById('typingIndicator'),
    emojiPicker: document.getElementById('emojiPicker'),
    fileUpload: document.getElementById('fileUpload'),
    filePreview: document.getElementById('filePreview'),
    searchModal: document.getElementById('searchModal'),
    searchResults: document.getElementById('searchResults'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileOverlay: document.getElementById('mobileOverlay'),
    sidebar: document.querySelector('.sidebar'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    loadMore: document.getElementById('loadMore'),
    roomUserCount: document.getElementById('roomUserCount'),
    userAvatar: document.getElementById('userAvatar'),
    themeToggleBtn: document.getElementById('themeToggle'),
    themeToggleHeader: document.getElementById('themeToggleHeader')
};

// ==============================
// INITIALIZATION
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Chat Application...');
    
    // Check authentication
    if (!await checkAuth()) return;
    
    // Initialize theme
    initTheme();
    
    // Initialize app
    await initializeApp();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    await loadRooms();
    await loadOnlineUsers();
    
    // Check for updates
    setTimeout(checkForAppUpdates, 3000);
    
    console.log('✅ Chat application initialized successfully');
});

// ==============================
// AUTHENTICATION
// ==============================
async function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        console.log('❌ No authentication found, redirecting to login');
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        // Verify token is still valid
        const response = await fetch('/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Token invalid');
        }
        
        currentUser = JSON.parse(user);
        elements.usernameDisplay.textContent = currentUser.username;
        
        // Set user avatar
        if (elements.userAvatar) {
            elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
        }
        
        return true;
    } catch (error) {
        console.error('Authentication error:', error);
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
            localStorage.clear();
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }
}

// ==============================
// THEME MANAGEMENT
// ==============================
function initTheme() {
    console.log('🌗 Initializing theme...');
    
    // Get saved theme or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Setup toggle buttons
    [elements.themeToggleBtn, elements.themeToggleHeader].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', toggleTheme);
            updateToggleButton(btn);
        }
    });
    
    console.log(`✅ Theme initialized: ${savedTheme}`);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Set theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update all toggle buttons
    [elements.themeToggleBtn, elements.themeToggleHeader].forEach(btn => {
        if (btn) updateToggleButton(btn);
    });
    
    console.log(`🌗 Theme changed to: ${newTheme}`);
    showToast(`Switched to ${newTheme} mode`, 'info');
}

function updateToggleButton(button) {
    if (!button) return;
    
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const slider = button.querySelector('.theme-toggle-slider');
    
    if (slider) {
        if (currentTheme === 'dark') {
            slider.style.transform = 'translateX(30px)';
            slider.style.background = '#333';
            button.title = 'Switch to light mode';
        } else {
            slider.style.transform = 'translateX(0)';
            slider.style.background = 'white';
            button.title = 'Switch to dark mode';
        }
    }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        [elements.themeToggleBtn, elements.themeToggleHeader].forEach(btn => {
            if (btn) updateToggleButton(btn);
        });
    }
});

// ==============================
// MAIN APP INITIALIZATION
// ==============================
async function initializeApp() {
    try {
        const token = localStorage.getItem('token');
        const serverUrl = window.location.origin;
        
        // Initialize Socket.io
        socket = io(serverUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        
        setupSocketListeners();
        
        // Load initial messages
        await loadMessages();
        
        // Join default room
        joinRoom(currentRoom);
        
        // Initialize emoji picker
        initializeEmojiPicker();
        
        // Setup mobile keyboard handling
        setupMobileKeyboardHandling();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize. Please refresh.', 'error');
    }
}

// ==============================
// SOCKET.IO HANDLERS
// ==============================
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ Connected to server');
        updateUserStatus(true);
        reconnectAttempts = 0;
        showToast('Connected to chat server', 'success');
    });
    
    socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        updateUserStatus(false);
        
        if (reason === 'io server disconnect') {
            // Server initiated disconnect, need to manually reconnect
            socket.connect();
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reconnectAttempts++;
        
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            showToast('Connection failed. Please check your internet.', 'error');
        }
    });
    
    socket.on('reconnecting', (attemptNumber) => {
        console.log(`🔄 Reconnecting (attempt ${attemptNumber})...`);
        showToast(`Reconnecting... (${attemptNumber}/${MAX_RECONNECT_ATTEMPTS})`, 'warning');
    });
    
    socket.on('reconnect_failed', () => {
        console.error('Reconnection failed');
        showToast('Connection lost. Please refresh the page.', 'error');
    });
    
    // Chat events
    socket.on('newMessage', (message) => {
        renderMessage(message);
        scrollToBottom();
        
        // Notification for new messages not from current user
        if (message.user_id !== currentUser?.id) {
            showNotification('New message', `${message.username}: ${message.content?.substring(0, 50)}...`);
        }
    });
    
    socket.on('messageDeleted', ({ messageId }) => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.classList.add('deleted');
            messageElement.innerHTML = `
                <div class="message-content">
                    <i>This message was deleted</i>
                </div>
            `;
        }
    });
    
    socket.on('userTyping', ({ userId, username, isTyping }) => {
        updateTypingIndicator(userId, username, isTyping);
    });
    
    socket.on('userOnline', (user) => {
        addOnlineUser(user);
        showToast(`${user.username} is now online`, 'info');
    });
    
    socket.on('userOffline', (user) => {
        removeOnlineUser(user.id);
        showToast(`${user.username} went offline`, 'warning');
    });
    
    socket.on('roomOnlineUsers', (users) => {
        updateRoomUserCount(users.length);
    });
    
    socket.on('messageError', ({ error }) => {
        showToast(error, 'error');
    });
    
    socket.on('roomCreated', (room) => {
        showToast(`New room created: ${room.name}`, 'success');
        loadRooms(); // Reload rooms list
    });
}

// ==============================
// EVENT LISTENERS
// ==============================
function setupEventListeners() {
    // Send message
    elements.sendButton.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Typing indicator
    elements.messageInput.addEventListener('input', handleTyping);
    
    // Auto-resize textarea
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Logout
    elements.logoutBtn.addEventListener('click', logout);
    
    // File upload
    elements.fileUpload.addEventListener('change', handleFileUpload);
    
    // Emoji picker
    const emojiToggleBtn = document.getElementById('emojiToggleBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    
    if (emojiToggleBtn) {
        emojiToggleBtn.addEventListener('click', toggleEmojiPicker);
    }
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', toggleEmojiPicker);
    }
    
    // Search
    const searchBtn = document.getElementById('searchBtn');
    const closeSearch = document.querySelector('.close-search');
    const performSearchBtn = document.getElementById('performSearch');
    const globalSearch = document.getElementById('globalSearch');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', openSearchModal);
    }
    
    if (closeSearch) {
        closeSearch.addEventListener('click', closeSearchModal);
    }
    
    if (performSearchBtn) {
        performSearchBtn.addEventListener('click', performSearch);
    }
    
    if (globalSearch) {
        globalSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    // Mobile menu
    elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    elements.mobileOverlay.addEventListener('click', toggleMobileMenu);
    
    // Load more messages
    if (elements.loadMoreBtn) {
        elements.loadMoreBtn.addEventListener('click', loadMoreMessages);
    }
    
    // Close modals on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearchModal();
            if (elements.emojiPicker) {
                elements.emojiPicker.style.display = 'none';
            }
        }
    });
    
    // Click outside emoji picker
    document.addEventListener('click', (e) => {
        if (elements.emojiPicker && 
            !e.target.closest('.emoji-picker') && 
            !e.target.closest('#emojiToggleBtn') && 
            !e.target.closest('#emojiBtn')) {
            elements.emojiPicker.style.display = 'none';
        }
    });
    
    // New room button
    const newRoomBtn = document.querySelector('.new-room-btn');
    if (newRoomBtn) {
        newRoomBtn.addEventListener('click', createNewRoom);
    }
    
    // Notification button
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', toggleNotifications);
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }
    
    // Online user click
    if (elements.onlineUsers) {
        elements.onlineUsers.addEventListener('click', (e) => {
            const onlineUser = e.target.closest('.online-user');
            if (onlineUser) {
                const userId = onlineUser.dataset.userId;
                openPrivateChat(userId);
            }
        });
    }
}

// ==============================
// ROOM MANAGEMENT
// ==============================
async function loadRooms() {
    try {
        const response = await fetch('/api/chat/rooms', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load rooms');
        
        const rooms = await response.json();
        renderRooms(rooms);
    } catch (error) {
        console.error('Error loading rooms:', error);
        showToast('Failed to load rooms', 'error');
    }
}

function renderRooms(rooms) {
    if (!elements.roomList) return;
    
    elements.roomList.innerHTML = '';
    
    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = `room ${room.id === currentRoom ? 'active' : ''}`;
        roomElement.dataset.roomId = room.id;
        roomElement.innerHTML = `
            <i class="fas fa-hashtag"></i>
            <div class="room-info">
                <div class="room-name">${room.name}</div>
                <div class="room-meta">${room.message_count || 0} messages • ${room.user_count || 0} users</div>
            </div>
        `;
        
        roomElement.addEventListener('click', () => {
            if (room.id !== currentRoom) {
                switchRoom(room.id, room.name);
            }
        });
        
        elements.roomList.appendChild(roomElement);
    });
}

async function switchRoom(roomId, roomName) {
    // Update UI
    document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
    const roomElement = document.querySelector(`[data-room-id="${roomId}"]`);
    if (roomElement) {
        roomElement.classList.add('active');
    }
    
    currentRoom = roomId;
    elements.currentRoom.textContent = roomName;
    elements.messagesDiv.innerHTML = '';
    messagesPage = 1;
    
    // Join room via socket
    if (socket) {
        socket.emit('joinRoom', roomId);
    }
    
    // Load messages
    await loadMessages();
    
    // Clear typing indicator
    elements.typingIndicator.textContent = '';
    
    // Close mobile menu on mobile
    if (window.innerWidth <= 1024) {
        toggleMobileMenu();
    }
    
    showToast(`Joined ${roomName}`, 'success');
}

async function createNewRoom() {
    const roomName = prompt('Enter new room name:');
    if (!roomName || roomName.trim() === '') return;
    
    try {
        const response = await fetch('/api/chat/rooms', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: roomName.trim() })
        });
        
        if (!response.ok) throw new Error('Failed to create room');
        
        const room = await response.json();
        
        if (socket) {
            socket.emit('roomCreated', room);
        }
        
        showToast(`Room "${room.name}" created`, 'success');
        
    } catch (error) {
        console.error('Error creating room:', error);
        showToast('Failed to create room', 'error');
    }
}

// ==============================
// MESSAGES
// ==============================
async function loadMessages() {
    try {
        const response = await fetch(`/api/chat/messages/${currentRoom}?page=${messagesPage}&limit=${messagesLimit}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load messages');
        
        const messages = await response.json();
        
        if (messagesPage === 1) {
            elements.messagesDiv.innerHTML = '';
        }
        
        messages.forEach(renderMessage);
        
        // Show/hide load more button
        if (elements.loadMore) {
            if (messages.length >= messagesLimit) {
                elements.loadMore.style.display = 'block';
            } else {
                elements.loadMore.style.display = 'none';
            }
        }
        
        if (messagesPage === 1) {
            scrollToBottom();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        showToast('Failed to load messages', 'error');
    }
}

async function loadMoreMessages() {
    messagesPage++;
    await loadMessages();
}

function renderMessage(msg) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${msg.user_id === currentUser?.id ? 'user' : 'other'}`;
    messageElement.dataset.messageId = msg.id;
    
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.created_at).toLocaleDateString();
    
    if (msg.is_deleted) {
        messageElement.classList.add('deleted');
        messageElement.innerHTML = `
            <div class="message-content">
                <i>This message was deleted</i>
            </div>
        `;
    } else {
        let content = '';
        
        if (msg.message_type === 'text') {
            content = `<div class="message-content">${escapeHtml(msg.content)}</div>`;
        } else if (msg.message_type === 'image') {
            content = `
                <div class="message-content">
                    <img src="${msg.file_url}" alt="Image" class="message-image" loading="lazy" />
                </div>
            `;
        } else if (msg.message_type === 'file') {
            content = `
                <div class="message-content">
                    ${escapeHtml(msg.content || '')}
                    <div class="message-file">
                        <a href="${msg.file_url}" target="_blank" download="${msg.file_name}">
                            <i class="fas fa-file-download"></i>
                            <span>${msg.file_name} (${formatFileSize(msg.file_size)})</span>
                        </a>
                    </div>
                </div>
            `;
        } else if (msg.message_type === 'emoji') {
            content = `<div class="message-content" style="font-size: 2rem;">${msg.content}</div>`;
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${msg.username}</span>
                <span class="message-time" title="${date} ${time}">${time}</span>
            </div>
            ${content}
            ${msg.user_id === currentUser?.id ? `
                <div class="message-actions">
                    <button class="message-action delete-message" data-message-id="${msg.id}" title="Delete message">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        `;
        
        // Add delete event listener
        if (msg.user_id === currentUser?.id) {
            const deleteBtn = messageElement.querySelector('.delete-message');
            deleteBtn.addEventListener('click', () => deleteMessage(msg.id));
        }
        
        // Add click event for images
        if (msg.message_type === 'image') {
            const img = messageElement.querySelector('.message-image');
            img.addEventListener('click', () => openImageModal(msg.file_url));
        }
    }
    
    elements.messagesDiv.appendChild(messageElement);
}

async function sendMessage() {
    const content = elements.messageInput.value.trim();
    const files = uploadedFiles;
    
    if (!content && files.length === 0) return;
    
    try {
        // Send text message
        if (content) {
            socket.emit('sendMessage', {
                roomId: currentRoom,
                content: content,
                messageType: 'text'
            });
        }
        
        // Send files
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                socket.emit('sendMessage', {
                    roomId: currentRoom,
                    content: '',
                    messageType: 'image',
                    fileUrl: file.url,
                    fileName: file.name,
                    fileSize: file.size
                });
            } else {
                socket.emit('sendMessage', {
                    roomId: currentRoom,
                    content: file.name,
                    messageType: 'file',
                    fileUrl: file.url,
                    fileName: file.name,
                    fileSize: file.size
                });
            }
        }
        
        // Clear input and files
        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
        uploadedFiles = [];
        if (elements.filePreview) {
            elements.filePreview.innerHTML = '';
        }
        if (elements.fileUpload) {
            elements.fileUpload.value = '';
        }
        
        // Hide emoji picker
        if (elements.emojiPicker) {
            elements.emojiPicker.style.display = 'none';
        }
        
        // Clear typing indicator
        if (socket) {
            socket.emit('typing', { roomId: currentRoom, isTyping: false });
            isTyping = false;
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
        const response = await fetch(`/api/chat/message/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to delete message');
        
        if (socket) {
            socket.emit('deleteMessage', { messageId, roomId: currentRoom });
        }
        
        showToast('Message deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Failed to delete message', 'error');
    }
}

function handleTyping() {
    if (!isTyping) {
        socket.emit('typing', { roomId: currentRoom, isTyping: true });
        isTyping = true;
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { roomId: currentRoom, isTyping: false });
        isTyping = false;
    }, 1000);
}

function updateTypingIndicator(userId, username, isTyping) {
    if (!elements.typingIndicator) return;
    
    if (isTyping && userId !== currentUser?.id) {
        elements.typingIndicator.textContent = `${username} is typing...`;
    } else {
        elements.typingIndicator.textContent = '';
    }
}

// ==============================
// FILE UPLOAD
// ==============================
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    
    for (const file of files) {
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            showToast(`File ${file.name} is too large (max 10MB)`, 'error');
            continue;
        }
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            showToast(`File type ${file.type} not supported`, 'error');
            continue;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/api/chat/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            
            const data = await response.json();
            
            uploadedFiles.push({
                name: file.name,
                size: file.size,
                type: file.type,
                url: data.fileUrl
            });
            
            // Add to preview
            if (elements.filePreview) {
                const previewItem = document.createElement('div');
                previewItem.className = 'file-preview-item';
                previewItem.innerHTML = `
                    <i class="fas fa-${getFileIcon(file.type)}"></i>
                    <span>${file.name} (${formatFileSize(file.size)})</span>
                    <span class="remove-file" data-file-name="${file.name}">&times;</span>
                `;
                
                elements.filePreview.appendChild(previewItem);
                
                // Add remove event
                previewItem.querySelector('.remove-file').addEventListener('click', (e) => {
                    const fileName = e.target.dataset.fileName;
                    uploadedFiles = uploadedFiles.filter(f => f.name !== fileName);
                    previewItem.remove();
                });
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            showToast(`Failed to upload ${file.name}`, 'error');
        }
    }
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType === 'application/pdf') return 'file-pdf';
    if (fileType.includes('word')) return 'file-word';
    if (fileType.includes('excel')) return 'file-excel';
    return 'file';
}

// ==============================
// EMOJI PICKER
// ==============================
function initializeEmojiPicker() {
    if (!elements.emojiPicker) return;
    
    const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
    
    const emojiContainer = document.createElement('div');
    emojiContainer.className = 'emoji-grid';
    emojiContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 5px;
        padding: 10px;
        max-height: 200px;
        overflow-y: auto;
    `;
    
    emojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.textContent = emoji;
        emojiBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 5px;
            border-radius: 5px;
            transition: background 0.2s;
        `;
        
        emojiBtn.addEventListener('click', () => {
            elements.messageInput.value += emoji;
            elements.messageInput.focus();
            elements.messageInput.style.height = 'auto';
            elements.messageInput.style.height = (elements.messageInput.scrollHeight) + 'px';
        });
        
        emojiBtn.addEventListener('mouseenter', () => {
            emojiBtn.style.background = '#f0f0f0';
        });
        
        emojiBtn.addEventListener('mouseleave', () => {
            emojiBtn.style.background = 'none';
        });
        
        emojiContainer.appendChild(emojiBtn);
    });
    
    elements.emojiPicker.appendChild(emojiContainer);
}

function toggleEmojiPicker() {
    if (!elements.emojiPicker) return;
    
    if (elements.emojiPicker.style.display === 'block') {
        elements.emojiPicker.style.display = 'none';
    } else {
        elements.emojiPicker.style.display = 'block';
        elements.emojiPicker.style.bottom = '70px';
        elements.emojiPicker.style.right = '20px';
    }
}

// ==============================
// ONLINE USERS
// ==============================
async function loadOnlineUsers() {
    try {
        const response = await fetch('/api/auth/online-users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load online users');
        
        const users = await response.json();
        renderOnlineUsers(users);
    } catch (error) {
        console.error('Error loading online users:', error);
    }
}

function renderOnlineUsers(users) {
    if (!elements.onlineUsers || !elements.onlineCount) return;
    
    elements.onlineUsers.innerHTML = '';
    elements.onlineCount.textContent = users.length;
    
    users.forEach(user => {
        if (user.id === currentUser?.id) return;
        
        const userElement = document.createElement('div');
        userElement.className = 'online-user';
        userElement.dataset.userId = user.id;
        userElement.innerHTML = `
            <div class="avatar" style="background: #${Math.floor(Math.random()*16777215).toString(16)}">
                ${user.username.charAt(0).toUpperCase()}
            </div>
            <span>${user.username}</span>
            <div class="status-dot"></div>
        `;
        
        elements.onlineUsers.appendChild(userElement);
    });
}

function addOnlineUser(user) {
    if (!elements.onlineUsers || !elements.onlineCount || user.id === currentUser?.id) return;
    
    if (!document.querySelector(`[data-user-id="${user.id}"]`)) {
        const userElement = document.createElement('div');
        userElement.className = 'online-user';
        userElement.dataset.userId = user.id;
        userElement.innerHTML = `
            <div class="avatar" style="background: #${Math.floor(Math.random()*16777215).toString(16)}">
                ${user.username.charAt(0).toUpperCase()}
            </div>
            <span>${user.username}</span>
            <div class="status-dot"></div>
        `;
        
        elements.onlineUsers.appendChild(userElement);
        elements.onlineCount.textContent = parseInt(elements.onlineCount.textContent || '0') + 1;
    }
}

function removeOnlineUser(userId) {
    const userElement = document.querySelector(`[data-user-id="${userId}"]`);
    if (userElement && elements.onlineCount) {
        userElement.remove();
        const currentCount = parseInt(elements.onlineCount.textContent || '0');
        elements.onlineCount.textContent = Math.max(0, currentCount - 1);
    }
}

function updateRoomUserCount(count) {
    if (elements.roomUserCount) {
        elements.roomUserCount.textContent = count;
    }
}

function updateUserStatus(isOnline) {
    if (elements.userStatus) {
        elements.userStatus.textContent = isOnline ? 'Online' : 'Offline';
        elements.userStatus.className = `status ${isOnline ? 'online' : 'offline'}`;
    }
}

// ==============================
// SEARCH FUNCTIONALITY
// ==============================
function openSearchModal() {
    if (elements.searchModal) {
        elements.searchModal.style.display = 'flex';
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            globalSearch.focus();
        }
    }
}

function closeSearchModal() {
    if (elements.searchModal) {
        elements.searchModal.style.display = 'none';
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            globalSearch.value = '';
        }
        if (elements.searchResults) {
            elements.searchResults.innerHTML = '';
        }
    }
}

async function performSearch() {
    const globalSearch = document.getElementById('globalSearch');
    if (!globalSearch) return;
    
    const query = globalSearch.value.trim();
    
    if (!query || query.length < 2) {
        showToast('Please enter at least 2 characters', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/search?query=${encodeURIComponent(query)}&roomId=${currentRoom}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Search failed');
        
        const results = await response.json();
        displaySearchResults(results);
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed', 'error');
    }
}

function displaySearchResults(results) {
    if (!elements.searchResults) return;
    
    elements.searchResults.innerHTML = '';
    
    if (results.length === 0) {
        elements.searchResults.innerHTML = '<div class="no-results">No messages found</div>';
        return;
    }
    
    results.forEach(result => {
        const resultElement = document.createElement('div');
        resultElement.className = 'search-result-item';
        resultElement.innerHTML = `
            <div class="search-result-header">
                <strong>${result.username}</strong> in <em>${result.room_name || 'Unknown Room'}</em>
                <small>${new Date(result.created_at).toLocaleString()}</small>
            </div>
            <div class="search-result-content">${highlightSearchTerm(result.content, document.getElementById('globalSearch')?.value || '')}</div>
        `;
        
        resultElement.addEventListener('click', () => {
            if (result.room_id) {
                switchRoom(result.room_id, result.room_name || 'Room');
            }
            closeSearchModal();
            
            // Scroll to message
            setTimeout(() => {
                const messageElement = document.querySelector(`[data-message-id="${result.id}"]`);
                if (messageElement) {
                    messageElement.scrollIntoView({ behavior: 'smooth' });
                    messageElement.classList.add('highlight');
                    setTimeout(() => messageElement.classList.remove('highlight'), 2000);
                }
            }, 500);
        });
        
        elements.searchResults.appendChild(resultElement);
    });
}

function highlightSearchTerm(text, term) {
    if (!term || !text) return escapeHtml(text || '');
    const regex = new RegExp(`(${term})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

// ==============================
// MOBILE FUNCTIONALITY
// ==============================
function toggleMobileMenu() {
    if (elements.sidebar && elements.mobileOverlay) {
        elements.sidebar.classList.toggle('active');
        elements.mobileOverlay.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    }
}

function setupMobileKeyboardHandling() {
    // Only on mobile devices
    if (!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
    
    const messageInput = elements.messageInput;
    const messagesContainer = document.querySelector('.messages-container');
    
    if (!messageInput || !messagesContainer) return;
    
    // Focus handling
    messageInput.addEventListener('focus', () => {
        setTimeout(() => {
            // Scroll messages to bottom
            scrollToBottom();
            
            // Add visual feedback
            document.body.classList.add('keyboard-open');
            
            // Adjust container height
            messagesContainer.style.maxHeight = '60vh';
            
            // For iOS, we need extra handling
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 300);
            }
        }, 100);
    });
    
    messageInput.addEventListener('blur', () => {
        setTimeout(() => {
            document.body.classList.remove('keyboard-open');
            messagesContainer.style.maxHeight = '';
        }, 300);
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            scrollToBottom();
        }, 300);
    });
    
    // Handle window resize (for virtual keyboard)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (document.activeElement === messageInput) {
                scrollToBottom();
            }
        }, 100);
    });
}

// ==============================
// MODALS & MODAL WINDOWS
// ==============================
function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <button class="close-modal">&times;</button>
            <img src="${imageUrl}" alt="Full size" />
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function openPrivateChat(userId) {
    showToast('Private chat feature coming soon!', 'info');
    // Implement private chat functionality here
}

function toggleNotifications() {
    showToast('Notifications toggled', 'info');
    // Implement notification settings
}

function openSettings() {
    showToast('Settings panel coming soon!', 'info');
    // Implement settings modal
}

// ==============================
// UTILITY FUNCTIONS
// ==============================
function scrollToBottom() {
    if (elements.messagesDiv) {
        elements.messagesDiv.scrollTop = elements.messagesDiv.scrollHeight;
    }
}

function joinRoom(roomId) {
    if (socket) {
        socket.emit('joinRoom', roomId);
    }
}

function logout() {
    // Notify server
    fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).catch(console.error);
    
    // Clear local storage
    localStorage.clear();
    
    // Redirect to login
    window.location.href = 'index.html';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==============================
// NOTIFICATIONS & TOASTS
// ==============================
function showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function showNotification(title, body) {
    // Check if notifications are supported and permission is granted
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192x192.png' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, { body, icon: '/icon-192x192.png' });
            }
        });
    }
}

// ==============================
// VERSION CHECK & UPDATE HANDLING
// ==============================
async function checkForAppUpdates() {
    try {
        const response = await fetch('/version.json?v=' + Date.now());
        const data = await response.json();
        
        console.log(`📱 App version check: ${data.version}`);
        
        // Check if update is available
        if (data.update_required || data.update_message) {
            console.log('🔄 Update notification available');
            
            // Show update notification
            if (data.update_message) {
                showToast(data.update_message, 'info');
            }
        }
    } catch (error) {
        console.log('Version check failed:', error);
    }
}

// Listen for service worker update messages
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
            showToast(`Update available: ${event.data.message}`, 'info');
        }
    });
}

// ==============================
// OFFLINE DETECTION
// ==============================
window.addEventListener('online', () => {
    showToast('You are back online', 'success');
    document.querySelector('.offline-indicator')?.classList.remove('show');
    
    // Reconnect socket if disconnected
    if (socket && !socket.connected) {
        socket.connect();
    }
});

window.addEventListener('offline', () => {
    showToast('You are offline', 'warning');
    const offlineIndicator = document.createElement('div');
    offlineIndicator.className = 'offline-indicator show';
    offlineIndicator.textContent = 'You are offline. Some features may not work.';
    document.body.appendChild(offlineIndicator);
});

// Check initial connection
if (!navigator.onLine) {
    showToast('You are offline. Connecting...', 'warning');
}

// ==============================
// WINDOW EVENT HANDLERS
// ==============================
window.addEventListener('beforeunload', () => {
    // Clean up before leaving
    if (socket) {
        socket.emit('userLeaving');
    }
});

// Export for debugging
window.chatApp = {
    socket,
    currentRoom,
    currentUser,
    switchRoom,
    sendMessage,
    logout,
    toggleTheme
};

console.log('📱 Chat.js loaded successfully');