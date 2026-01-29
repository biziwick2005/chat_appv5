// Global variables
let socket;
let currentRoom = 1;
let currentUser = null;
let messagesPage = 1;
let messagesLimit = 50;
let typingTimeout = null;
let uploadedFiles = [];
let emojiPicker = null;

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
    roomUserCount: document.getElementById('roomUserCount')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
    loadRooms();
    loadOnlineUsers();
});

async function initializeApp() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        elements.usernameDisplay.textContent = currentUser.username;
        
        // Initialize Socket.io - UPDATED URL
        const serverUrl = window.location.origin;
        socket = io(serverUrl, {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        
        setupSocketListeners();
        
        // Load initial messages
        await loadMessages();
        
        // Join default room
        joinRoom(currentRoom);
        
        // Initialize emoji picker
        initializeEmojiPicker();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize. Please try again.', 'error');
        setTimeout(logout, 2000);
    }
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
        updateUserStatus(true);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateUserStatus(false);
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showToast('Connection error. Please check your internet.', 'error');
    });
    
    socket.on('newMessage', (message) => {
        renderMessage(message);
        scrollToBottom();
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
    });
    
    socket.on('userOffline', (user) => {
        removeOnlineUser(user.id);
    });
    
    socket.on('roomOnlineUsers', (users) => {
        updateRoomUserCount(users.length);
    });
    
    socket.on('messageError', ({ error }) => {
        showToast(error, 'error');
    });
}

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
    elements.messageInput.addEventListener('input', () => {
        socket.emit('typing', { roomId: currentRoom, isTyping: true });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { roomId: currentRoom, isTyping: false });
        }, 1000);
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
    const performSearch = document.getElementById('performSearch');
    const globalSearch = document.getElementById('globalSearch');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', openSearchModal);
    }
    
    if (closeSearch) {
        closeSearch.addEventListener('click', closeSearchModal);
    }
    
    if (performSearch) {
        performSearch.addEventListener('click', performSearch);
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
}

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
                <div class="room-meta">${room.message_count || 0} messages</div>
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
    
    // Update typing indicator
    elements.typingIndicator.textContent = '';
    
    // Close mobile menu on mobile
    if (window.innerWidth <= 1024) {
        toggleMobileMenu();
    }
}

async function loadMessages() {
    try {
        const response = await fetch(`/api/chat/messages/${currentRoom}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load messages');
        
        const messages = await response.json();
        
        if (messagesPage === 1) {
            elements.messagesDiv.innerHTML = '';
        }
        
        messages.forEach(renderMessage);
        
        // Hide load more button since we're not using pagination
        if (elements.loadMore) {
            elements.loadMore.style.display = 'none';
        }
        
        scrollToBottom();
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
    messageElement.className = `message ${msg.user_id === currentUser.id ? 'user' : 'other'}`;
    messageElement.dataset.messageId = msg.id;
    
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
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
                <span class="message-time">${time}</span>
            </div>
            ${content}
            ${msg.user_id === currentUser.id ? `
                <div class="message-actions">
                    <button class="message-action delete-message" data-message-id="${msg.id}" title="Delete message">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        `;
        
        // Add delete event listener
        if (msg.user_id === currentUser.id) {
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
        
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Failed to delete message', 'error');
    }
}

async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    
    for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showToast(`File ${file.name} is too large (max 10MB)`, 'error');
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
                    <i class="fas fa-file"></i>
                    <span>${file.name}</span>
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

function initializeEmojiPicker() {
    // Simple emoji picker implementation
    if (elements.emojiPicker) {
        const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
        
        const emojiContainer = document.createElement('div');
        emojiContainer.className = 'emoji-grid';
        emojiContainer.style.display = 'grid';
        emojiContainer.style.gridTemplateColumns = 'repeat(8, 1fr)';
        emojiContainer.style.gap = '5px';
        emojiContainer.style.padding = '10px';
        emojiContainer.style.maxHeight = '200px';
        emojiContainer.style.overflowY = 'auto';
        
        emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.textContent = emoji;
            emojiBtn.style.background = 'none';
            emojiBtn.style.border = 'none';
            emojiBtn.style.fontSize = '1.5rem';
            emojiBtn.style.cursor = 'pointer';
            emojiBtn.style.padding = '5px';
            emojiBtn.style.borderRadius = '5px';
            
            emojiBtn.addEventListener('click', () => {
                elements.messageInput.value += emoji;
                elements.messageInput.focus();
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
        if (user.id === currentUser.id) return;
        
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
    if (!elements.onlineUsers || !elements.onlineCount || user.id === currentUser.id) return;
    
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
        elements.onlineCount.textContent = parseInt(elements.onlineCount.textContent || '0') - 1;
    }
}

function updateTypingIndicator(userId, username, isTyping) {
    if (!elements.typingIndicator) return;
    
    if (isTyping) {
        elements.typingIndicator.textContent = `${username} is typing...`;
    } else {
        elements.typingIndicator.textContent = '';
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

function toggleMobileMenu() {
    if (elements.sidebar && elements.mobileOverlay) {
        elements.sidebar.classList.toggle('active');
        elements.mobileOverlay.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    }
}

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

function scrollToBottom() {
    if (elements.messagesDiv) {
        elements.messagesDiv.scrollTop = elements.messagesDiv.scrollHeight;
    }
}

function logout() {
    // Notify server
    fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).catch(console.error);
    
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login
    window.location.href = 'index.html';
}

// Utility functions
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

function showToast(message, type = 'info') {
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

// Add toast styles if not already present
if (!document.querySelector('#toast-styles')) {
    const toastStyles = document.createElement('style');
    toastStyles.id = 'toast-styles';
    toastStyles.textContent = `
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 300px;
        }
        .toast.show {
            transform: translateX(0);
            opacity: 1;
        }
        .toast-info { background: #007AFF; }
        .toast-success { background: #34C759; }
        .toast-error { background: #FF3B30; }
        .toast-warning { background: #FF9500; }
    `;
    document.head.appendChild(toastStyles);
}

// Add image modal styles if not already present
if (!document.querySelector('#image-modal-styles')) {
    const imageModalStyles = document.createElement('style');
    imageModalStyles.id = 'image-modal-styles';
    imageModalStyles.textContent = `
        .image-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        }
        .image-modal-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
        }
        .image-modal-content img {
            max-width: 100%;
            max-height: 90vh;
            border-radius: 8px;
        }
        .close-modal {
            position: absolute;
            top: -40px;
            right: 0;
            background: none;
            border: none;
            color: white;
            font-size: 2rem;
            cursor: pointer;
        }
        .message-image {
            max-width: 300px;
            max-height: 300px;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        .message-image:hover {
            transform: scale(1.02);
        }
        .highlight {
            animation: highlightPulse 2s ease;
        }
        @keyframes highlightPulse {
            0%, 100% { background: transparent; }
            50% { background: rgba(255, 235, 59, 0.3); }
        }
        .message-actions {
            position: absolute;
            top: 5px;
            right: 5px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .message:hover .message-actions {
            opacity: 1;
        }
        .message-action {
            background: rgba(0, 0, 0, 0.1);
            border: none;
            border-radius: 4px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: inherit;
            font-size: 0.8rem;
        }
        .message.user .message-action {
            background: rgba(255, 255, 255, 0.2);
        }
    `;
    document.head.appendChild(imageModalStyles);
}

// Auto-resize textarea
if (elements.messageInput) {
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// Join room on load
function joinRoom(roomId) {
    if (socket) {
        socket.emit('joinRoom', roomId);
    }
}

// Initialize room joining
if (socket) {
    socket.on('connect', () => {
        joinRoom(currentRoom);
    });
}


// Add to chat.js - offline detection
window.addEventListener('online', () => {
  showToast('You are back online', 'success');
  document.querySelector('.offline-indicator')?.classList.remove('show');
  
  // Sync messages when back online
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