class RitepadApp {
    constructor() {
        this.folders = JSON.parse(localStorage.getItem('ritepad-folders')) || this.getDefaultFolders();
        this.notes = JSON.parse(localStorage.getItem('ritepad-notes')) || [];
        this.currentNoteId = null;
        this.currentFolderId = null;
        this.isAutoSaving = false;
        this.autoSaveTimeout = null;
        this.collapsedFolders = new Set();
        this.textSize = parseInt(localStorage.getItem('ritepad-text-size')) || 100;
        this.draftNote = JSON.parse(localStorage.getItem('ritepad-draft')) || null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadFolders();
        this.initializeTheme();
        
        // Initialize text size and check for draft
        this.updateTextSize();
        
        if (this.draftNote) {
            this.restoreDraft();
        } else if (this.notes.length === 0) {
            this.showEmptyState();
        } else {
            this.selectFirstAvailableNote();
        }
    }
    
    getDefaultFolders() {
        return [
    }
    
    initializeElements() {
        // Sidebar elements
        this.searchInput = document.getElementById('search-input');
        this.folderSearchInput = document.getElementById('folder-search-input');
        this.notesList = document.getElementById('notes-list');
        this.newNoteBtn = document.getElementById('new-note-btn');
        this.newFolderBtn = document.getElementById('new-folder-btn');
        // Editor elements
        this.noteTitleInput = document.getElementById('note-title');
        this.editor = document.getElementById('editor');
        this.saveBtn = document.getElementById('save-btn');
        this.importBtn = document.getElementById('import-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.deleteBtn = document.getElementById('delete-btn');
        // Toolbar elements
        this.toolbarBtns = document.querySelectorAll('.toolbar-btn:not(.color-btn):not(#text-size-increase):not(#text-size-decrease)');
        this.colorBtns = document.querySelectorAll('.color-btn');
        this.textSizeIncrease = document.getElementById('text-size-increase');
        this.textSizeDecrease = document.getElementById('text-size-decrease');
        this.textSizeDisplay = document.getElementById('text-size-display');
        // Status elements
        this.wordCount = document.getElementById('word-count');
        this.lastSaved = document.getElementById('last-saved');
        // Theme
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeSelect = document.getElementById('theme-select');
        // Empty state and editor containers
        this.emptyState = document.getElementById('empty-state');
        this.editorHeader = document.querySelector('.editor-header');
        this.editorToolbar = document.querySelector('.editor-toolbar');
        this.editorContainer = document.querySelector('.editor-container');
        this.statusBar = document.querySelector('.status-bar');
    }
    
    bindEvents() {
        // Sidebar events
        this.newNoteBtn.addEventListener('click', () => this.createNewNote());
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        this.searchInput.addEventListener('input', (e) => this.searchNotes(e.target.value));
        this.folderSearchInput.addEventListener('input', (e) => this.searchFolders(e.target.value));
        
        // Editor events
        this.noteTitleInput.addEventListener('input', () => {
            this.autoSave();
            this.saveDraft();
        });
        this.editor.addEventListener('input', () => {
            this.updateWordCount();
            this.autoSave();
            this.saveDraft();
        });
        
        // Toolbar events
        this.toolbarBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const command = btn.dataset.command;
                this.executeCommand(command);
            });
        });
        
        // Action buttons
        this.saveBtn.addEventListener('click', () => this.saveCurrentNote());
        this.importBtn.addEventListener('click', () => this.importTextFile());
        this.exportBtn.addEventListener('click', () => this.exportCurrentNote());
        this.deleteBtn.addEventListener('click', () => this.deleteCurrentNote());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.themeSelect.addEventListener('change', (e) => this.setTheme(e.target.value));
        
        // Color picker events
        this.colorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const color = btn.dataset.color;
                this.applyTextColor(color);
            });
        });
        
        // Text size events
        this.textSizeIncrease.addEventListener('click', () => this.increaseTextSize());
        this.textSizeDecrease.addEventListener('click', () => this.decreaseTextSize());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    createNewNote() {
        if (this.folders.length === 0) {
            alert('Please create a folder first!');
            return;
        }
        // Use current folder or default to 'general'
        const folderId = this.currentFolderId || 'general';

        // Use current editor values for the new note
        const title = this.noteTitleInput.value.trim() || 'Untitled Note';
        const content = this.editor.innerHTML.trim() || '';

        const note = {
            id: this.generateId(),
            title: title,
            content: content,
            folderId: folderId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.loadFolders();
        this.selectNote(note.id);
        this.clearDraft(); // Clear draft since we saved the note

        // Clear the editor and title fields for the next note
        setTimeout(() => {
            this.noteTitleInput.value = '';
            this.editor.innerHTML = '';
            this.updateWordCount();
            this.showEditor();
            this.noteTitleInput.focus();
            this.noteTitleInput.select();
        }, 100);
    }
    
    createNewFolder() {
        const name = prompt('Enter folder name:');
        if (name && name.trim()) {
            const parentId = this.currentFolderId; // Create subfolder if a folder is selected
            const folder = {
                id: this.generateId(),
                name: name.trim(),
                color: this.getRandomColor(),
                parentId: parentId,
                createdAt: new Date().toISOString()
            };
            
            this.folders.push(folder);
            this.saveFolders();
            this.loadFolders();
        }
    }
    
    getRandomColor() {
        const colors = ['#6366f1', '#059669', '#7c3aed', '#e11d48', '#0ea5e9', '#f59e0b'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    exportCurrentNote() {
        if (!this.currentNoteId) {
            alert('No note selected to export');
            return;
        }
        
        const note = this.notes.find(n => n.id === this.currentNoteId);
        if (!note) return;
        
        const textContent = `${note.title}\n\n${this.getTextContent(note.content)}`;
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    importTextFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const lines = content.split('\n');
                    const title = lines[0] || 'Imported Note';
                    const noteContent = lines.slice(2).join('\n');
                    
                    const note = {
                        id: this.generateId(),
                        title: title,
                        content: noteContent.replace(/\n/g, '<br>'),
                        folderId: this.currentFolderId || 'general',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    this.notes.unshift(note);
                    this.saveNotes();
                    this.loadFolders();
                    this.selectNote(note.id);
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    deleteFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        const folderNotes = this.notes.filter(n => n.folderId === folderId);
        const subfolders = this.folders.filter(f => f.parentId === folderId);
        
        let message = `Delete folder "${folder.name}"?`;
        if (folderNotes.length > 0) {
            message = `Delete folder "${folder.name}" and ${folderNotes.length} notes?`;
        }
        if (subfolders.length > 0) {
            message = `Delete folder "${folder.name}", ${subfolders.length} subfolders, and ${folderNotes.length} notes?`;
        }
        
        if (!confirm(message)) {
            return;
        }
        
        // Delete all subfolders and their notes recursively
        const deleteRecursively = (fId) => {
            const children = this.folders.filter(f => f.parentId === fId);
            children.forEach(child => deleteRecursively(child.id));
            
            // Delete notes in this folder
            this.notes = this.notes.filter(n => n.folderId !== fId);
            // Delete the folder
            this.folders = this.folders.filter(f => f.id !== fId);
        };
        
        deleteRecursively(folderId);
        this.saveFolders();
        this.saveNotes();
        this.loadFolders();
        
        if (this.currentFolderId === folderId) {
            this.currentFolderId = null;
            this.currentNoteId = null;
            this.noteTitleInput.value = '';
            this.editor.innerHTML = '';
            this.updateWordCount();
        }
    }
    
    applyTextColor(color) {
        document.execCommand('foreColor', false, color);
        this.editor.focus();
        this.autoSave();
    }
    
    showAddNoteScreen() {
        // Only show the editor if a note is selected (currentNoteId exists)
        this.showEmptyState();
    }
    
    handleAddNoteClick() {
        this.createNewNote();
    }
    
    // Text size controls
    increaseTextSize() {
        if (this.textSize < 200) {
            this.textSize += 10;
            this.updateTextSize();
            this.saveTextSize();
        }
    }
    
    decreaseTextSize() {
        if (this.textSize > 50) {
            this.textSize -= 10;
            this.updateTextSize();
            this.saveTextSize();
        }
    }
    
    updateTextSize() {
        document.documentElement.style.setProperty('--editor-font-size', `${this.textSize / 100}rem`);
        this.textSizeDisplay.textContent = `${this.textSize}%`;
    }
    
    saveTextSize() {
        localStorage.setItem('ritepad-text-size', this.textSize.toString());
    }
    
    // Draft management for crash recovery
    saveDraft() {
        if (this.currentNoteId) return; // Don't save draft for existing notes
        
        const title = this.noteTitleInput.value.trim();
        const content = this.editor.innerHTML.trim();
        
        if (title || content) {
            const draft = {
                title: title,
                content: content,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('ritepad-draft', JSON.stringify(draft));
        } else {
            this.clearDraft();
        }
    }
    
    clearDraft() {
        localStorage.removeItem('ritepad-draft');
        this.draftNote = null;
    }
    
    restoreDraft() {
        if (this.draftNote) {
            this.currentNoteId = null;
            this.currentFolderId = null;
            this.noteTitleInput.value = this.draftNote.title || '';
            this.editor.innerHTML = this.draftNote.content || '';
            this.updateWordCount();
            this.lastSaved.textContent = `Draft from ${new Date(this.draftNote.timestamp).toLocaleString()}`;
            
            // Show recovery message
            setTimeout(() => {
                if (confirm('We found an unsaved draft from your last session. Would you like to save it as a new note?')) {
                    this.createNewNote();
                } else {
                    this.clearDraft();
                    this.showEmptyState(); // Changed from showAddNoteScreen()
                }
            }, 500);
        }
    }
    
    // Remove all welcome screen logic (showWelcomeScreen, hideWelcomeScreen, showBlankScreen, etc.)
    
    selectNote(noteId) {
        this.saveCurrentNote(); // Save previous note before switching
        
        this.currentNoteId = noteId;
        const note = this.notes.find(n => n.id === noteId);
        
        if (note) {
            this.showEditor();
            this.noteTitleInput.value = note.title;
            this.editor.innerHTML = note.content;
            this.updateWordCount();
            this.updateLastSaved(note.updatedAt);
            
            // Update active state in sidebar
            document.querySelectorAll('.note-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-note-id="${noteId}"]`)?.classList.add('active');
        } else {
            this.showEmptyState();
        }
    }
    
    saveCurrentNote() {
        if (!this.currentNoteId) return;
        
        const note = this.notes.find(n => n.id === this.currentNoteId);
        if (note) {
            const title = this.noteTitleInput.value.trim() || 'Untitled Note';
            const content = this.editor.innerHTML;
            
            if (note.title !== title || note.content !== content) {
                note.title = title;
                note.content = content;
                note.updatedAt = new Date().toISOString();
                
                this.saveNotes();
                this.renderNotes();
                this.updateLastSaved(note.updatedAt);
            }
        }
    }
    
    autoSave() {
        // Always save to localStorage for offline sync
        if (this.currentNoteId) {
            this.saveCurrentNote();
        } else {
            // If no current note, try to create one if there's content and a folder exists
            const title = this.noteTitleInput.value.trim();
            const content = this.editor.innerHTML.trim();
            if ((title || content) && this.folders.length > 0) {
                this.createNewNote();
            }
        }
    }
    
    deleteCurrentNote() {
        if (!this.currentNoteId) return;
        
        if (confirm('Are you sure you want to delete this note?')) {
            this.notes = this.notes.filter(n => n.id !== this.currentNoteId);
            this.saveNotes();
            this.renderNotes();
            
            if (this.notes.length > 0) {
                this.selectNote(this.notes[0].id);
            } else {
                this.currentNoteId = null;
                this.currentFolderId = null;
                this.noteTitleInput.value = '';
                this.editor.innerHTML = '';
                this.updateWordCount();
                this.showEmptyState(); // Changed from showWelcomeScreen()
            }
        }
    }
    
    searchNotes(query) {
        const filteredNotes = this.notes.filter(note => 
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase())
        );
        this.renderNotes(filteredNotes);
    }

    searchFolders(query) {
        this.folderSearchQuery = query.toLowerCase();
        this.renderNotes();
    }

    renderNotes(filteredNotes) {
        this.notesList.innerHTML = '';
        this.renderFolderTree(null, 0, filteredNotes);
    }

    renderFolderTree(parentId, depth, filteredNotes = null) {
        const folders = this.folders.filter(f => f.parentId === parentId);
        folders.forEach(folder => {
            // Folder search filter
            if (this.folderSearchQuery && !folder.name.toLowerCase().includes(this.folderSearchQuery)) {
                // If searching, skip folders that don't match
                // But still check subfolders for matches
                const hasMatchingSubfolder = this.hasMatchingSubfolder(folder.id, this.folderSearchQuery);
                if (!hasMatchingSubfolder) return;
            }
            const folderNotes = (filteredNotes || this.notes).filter(note => note.folderId === folder.id);
            const subfolders = this.folders.filter(f => f.parentId === folder.id);
            const isCollapsed = this.collapsedFolders.has(folder.id);
            // Create folder element
            const folderElement = document.createElement('div');
            folderElement.className = 'folder-item';
            folderElement.dataset.folderId = folder.id;
            folderElement.style.marginLeft = `${depth * 1.5}rem`;
            folderElement.innerHTML = `
                <div class="folder-info">
                    <i class="fas fa-folder" style="color: ${folder.color}"></i>
                    <span class="folder-name">${this.escapeHtml(folder.name)}</span>
                    <span class="folder-count">${folderNotes.length}</span>
                </div>
                <div class="folder-actions">
                    <button class="folder-export-btn" data-folder-id="${folder.id}" title="Export folder"><i class="fas fa-download"></i></button>
                    <button class="folder-delete-btn" data-folder-id="${folder.id}" title="Delete folder"><i class="fas fa-trash"></i></button>
                    ${(folderNotes.length > 0 || subfolders.length > 0) ? `<button class="folder-toggle">
                        <i class="fas fa-chevron-${isCollapsed ? 'right' : 'down'}"></i>
                    </button>` : ''}
                </div>
            `;
            folderElement.addEventListener('click', (e) => {
                if (e.target.closest('.folder-export-btn')) {
                    e.stopPropagation();
                    this.exportFolder(folder.id);
                } else if (e.target.closest('.folder-toggle')) {
                    this.toggleFolder(folder.id);
                } else if (e.target.closest('.folder-delete-btn')) {
                    this.deleteFolder(folder.id);
                } else {
                    this.selectFolder(folder.id);
                }
            });
            this.notesList.appendChild(folderElement);
            // Add notes and subfolders if not collapsed
            if (!isCollapsed) {
                // Add notes in folder
                if (folderNotes.length > 0) {
                    const folderNotesContainer = document.createElement('div');
                    folderNotesContainer.className = 'folder-notes';
                    folderNotesContainer.style.marginLeft = `${(depth + 1) * 1.5}rem`;
                    folderNotes.forEach(note => {
                        const noteElement = document.createElement('div');
                        noteElement.className = 'note-item';
                        noteElement.dataset.noteId = note.id;
                        const preview = this.getTextContent(note.content).substring(0, 80);
                        const date = new Date(note.updatedAt).toLocaleDateString();
                        noteElement.innerHTML = `
                            <h3>${this.escapeHtml(note.title)}</h3>
                            <p>${this.escapeHtml(preview)}${preview.length >= 80 ? '...' : ''}</p>
                            <div class="note-date">${date}</div>
                        `;
                        noteElement.addEventListener('click', () => this.selectNote(note.id));
                        folderNotesContainer.appendChild(noteElement);
                    });
                    this.notesList.appendChild(folderNotesContainer);
                }
                // Recursively render subfolders
                this.renderFolderTree(folder.id, depth + 1, filteredNotes);
            }
        });
    }

    hasMatchingSubfolder(folderId, query) {
        const subfolders = this.folders.filter(f => f.parentId === folderId);
        for (const sub of subfolders) {
            if (sub.name.toLowerCase().includes(query)) return true;
            if (this.hasMatchingSubfolder(sub.id, query)) return true;
        }
        return false;
    }

    async exportFolder(folderId) {
        // Gather all notes in this folder and subfolders
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return;
        const notesToExport = this.getNotesInFolderRecursive(folderId);
        // Use JSZip to create a zip file
        if (typeof JSZip === 'undefined') {
            alert('JSZip library is required for folder export.');
            return;
        }
        const zip = new JSZip();
        notesToExport.forEach(note => {
            const textContent = `${note.title}\n\n${this.getTextContent(note.content)}`;
            zip.file(`${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`, textContent);
        });
        // Optionally, add a folder info file
        zip.file('folder_info.txt', `Folder: ${folder.name}\nExported: ${new Date().toLocaleString()}`);
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folder.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getNotesInFolderRecursive(folderId) {
        let notes = this.notes.filter(n => n.folderId === folderId);
        const subfolders = this.folders.filter(f => f.parentId === folderId);
        for (const sub of subfolders) {
            notes = notes.concat(this.getNotesInFolderRecursive(sub.id));
        }
        return notes;
    }
    
    selectFolder(folderId) {
        this.currentFolderId = folderId;
        this.currentNoteId = null;
        this.showEmptyState();
        // Update active states
        document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.note-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-folder-id="${folderId}"]`)?.classList.add('active');
    }
    
    toggleFolder(folderId) {
        if (this.collapsedFolders.has(folderId)) {
            this.collapsedFolders.delete(folderId);
        } else {
            this.collapsedFolders.add(folderId);
        }
        this.loadFolders();
    }
    
    selectFirstAvailableNote() {
        if (this.notes.length > 0) {
            this.selectNote(this.notes[0].id);
        }
    }
    
    loadFolders() {
        this.notesList.innerHTML = '';
        this.renderFolderTree(null, 0);
        // Show or hide empty state in main content
        if (this.folders.length === 0) {
            this.showEmptyState();
            if (this.newNoteBtn) this.newNoteBtn.style.display = 'none';
        } else {
            if (this.newNoteBtn) this.newNoteBtn.style.display = '';
            if (!this.currentNoteId) {
                this.showEmptyState();
            }
        }
        // Restore active states
        if (this.currentFolderId) {
            document.querySelector(`[data-folder-id="${this.currentFolderId}"]`)?.classList.add('active');
        }
        if (this.currentNoteId) {
            document.querySelector(`[data-note-id="${this.currentNoteId}"]`)?.classList.add('active');
        }
    }
    
    saveNotes() {
        localStorage.setItem('ritepad-notes', JSON.stringify(this.notes));
    }
    
    saveFolders() {
        localStorage.setItem('ritepad-folders', JSON.stringify(this.folders));
    }
    
    executeCommand(command) {
        document.execCommand(command, false, null);
        this.editor.focus();
        this.autoSave();
    }
    
    updateWordCount() {
        const text = this.getTextContent(this.editor.innerHTML);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    }
    
    updateLastSaved(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        let timeText;
        if (diffMins < 1) {
            timeText = 'Just now';
        } else if (diffMins < 60) {
            timeText = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffMins < 1440) {
            const hours = Math.floor(diffMins / 60);
            timeText = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else {
            timeText = date.toLocaleDateString();
        }
        
        this.lastSaved.textContent = `Saved ${timeText}`;
    }
    
    getTextContent(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.saveCurrentNote();
                    break;
                case 'n':
                    e.preventDefault();
                    this.createNewNote();
                    break;
                case 'f':
                    e.preventDefault();
                    this.searchInput.focus();
                    break;
                case 'b':
                    if (document.activeElement === this.editor) {
                        e.preventDefault();
                        this.executeCommand('bold');
                    }
                    break;
                case 'i':
                    if (document.activeElement === this.editor) {
                        e.preventDefault();
                        this.executeCommand('italic');
                    }
                    break;
                case 'u':
                    if (document.activeElement === this.editor) {
                        e.preventDefault();
                        this.executeCommand('underline');
                    }
                    break;
            }
        }
    }
    
    initializeTheme() {
        const savedTheme = localStorage.getItem('ritepad-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.themeSelect.value = savedTheme;
        this.updateThemeIcon(savedTheme);
    }
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ritepad-theme', theme);
        this.themeSelect.value = theme;
        this.updateThemeIcon(theme);
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
    
    updateThemeIcon(theme) {
        const icon = this.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // Show the blank quote screen (empty state)
    showEmptyState() {
        if (this.emptyState) this.emptyState.style.display = 'flex';
        if (this.editorHeader) this.editorHeader.style.display = 'none';
        if (this.editorToolbar) this.editorToolbar.style.display = 'none';
        if (this.editorContainer) this.editorContainer.style.display = 'none';
        if (this.statusBar) this.statusBar.style.display = 'none';
    }

    // Show the note editor (untitled note or editing)
    showEditor() {
        if (this.emptyState) this.emptyState.style.display = 'none';
        if (this.editorHeader) this.editorHeader.style.display = '';
        if (this.editorToolbar) this.editorToolbar.style.display = '';
        if (this.editorContainer) this.editorContainer.style.display = '';
        if (this.statusBar) this.statusBar.style.display = '';
    }

    hideEmptyState() { /* Deprecated, use showEditor instead */ }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RitepadApp();
});
