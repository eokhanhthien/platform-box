/**
 * Notes Module — notes.js
 * Entry: initNotesModule(currentUser)
 */
(function () {
    // ── State ──────────────────────────────────────────────────────────────
    let _currentUser = null;
    let _allNotes = [];
    let _allTags = [];
    let _editingNoteId = null;
    let _filterTag = '';
    let _filterColor = 'all';
    let _filterQuery = '';
    let _currentTags = [];
    let _isPinned = false;
    let _isLocked = false;
    let _searchDebounce = null;
    let _selectedColor = 'default';

    // ── Color meta ──────────────────────────────────────────────────────────
    const COLORS = ['default', 'yellow', 'green', 'blue', 'purple', 'pink', 'orange', 'red'];
    const COLOR_DOT = {
        default: '#e5e7eb', yellow: '#fbbf24', green: '#22c55e', blue: '#3b82f6',
        purple: '#8b5cf6', pink: '#ec4899', orange: '#f97316', red: '#ef4444'
    };

    // ── Templates ───────────────────────────────────────────────────────────
    const TEMPLATES = {
        meeting: `<p><strong>📅 Buổi họp:</strong> [Tên buổi họp]</p>
<p><strong>🕒 Thời gian:</strong> [Ngày / Giờ]</p>
<p><strong>👥 Tham dự:</strong></p>
<ul><li>[Người tham dự 1]</li><li>[Người tham dự 2]</li></ul>
<p><strong>📋 Nội dung thảo luận:</strong></p>
<ol><li>[Điểm 1]</li><li>[Điểm 2]</li></ol>
<p><strong>✅ Kết luận / Hành động:</strong></p>
<ul><li>[Hành động 1 — Người chịu trách nhiệm]</li></ul>`,
        plan: `<p><strong>🎯 Mục tiêu:</strong> [Mô tả mục tiêu]</p>
<p><strong>📅 Thời hạn:</strong> [Ngày hoàn thành]</p>
<p><strong>📋 Các bước thực hiện:</strong></p>
<ol><li>[Bước 1]</li><li>[Bước 2]</li><li>[Bước 3]</li></ol>
<p><strong>⚠️ Rủi ro / Ghi chú:</strong></p>
<ul><li>[Ghi chú]</li></ul>`,
        checklist: `<p><strong>✅ Checklist:</strong> [Tên checklist]</p>
<ul>
<li>☐ [Việc cần làm 1]</li>
<li>☐ [Việc cần làm 2]</li>
<li>☐ [Việc cần làm 3]</li>
<li>☐ [Việc cần làm 4]</li>
<li>☐ [Việc cần làm 5]</li>
</ul>`,
        idea: `<p><strong>💡 Ý tưởng:</strong> [Tên ý tưởng]</p>
<p><strong>🔍 Vấn đề giải quyết:</strong></p>
<ul><li>[Vấn đề]</li></ul>
<p><strong>🚀 Giải pháp đề xuất:</strong></p>
<ul><li>[Giải pháp]</li></ul>
<p><strong>📊 Lợi ích kỳ vọng:</strong></p>
<ul><li>[Lợi ích]</li></ul>`,
        daily: `<p><strong>🌅 Ngày: [${new Date().toLocaleDateString('vi-VN')}]</strong></p>
<p><strong>✨ 3 điều tốt hôm nay:</strong></p>
<ol><li>[Điều 1]</li><li>[Điều 2]</li><li>[Điều 3]</li></ol>
<p><strong>📋 Nhiệm vụ hôm nay:</strong></p>
<ul><li>☐ [Nhiệm vụ 1]</li><li>☐ [Nhiệm vụ 2]</li></ul>
<p><strong>💭 Cảm nhận / Ghi chú:</strong></p>
<p>[Ghi chú tự do...]</p>`
    };

    // ── Init ────────────────────────────────────────────────────────────────
    async function initNotesModule(currentUser) {
        _currentUser = currentUser;

        const sectionEl = document.getElementById('section-notes');
        if (!sectionEl || !sectionEl.querySelector('.notes-root')) return; // Template not loaded yet

        // Guard: avoid double-init if already initialized
        if (sectionEl.dataset.initialized === '1') {
            await _loadNotes();
            await _loadTags();
            return;
        }
        sectionEl.dataset.initialized = '1';

        // Bind events after DOM is ready
        _bindEvents();
        await _loadNotes();
        await _loadTags();
    }

    function _bindEvents() {
        // Search
        const searchEl = document.getElementById('notesSearch');
        if (searchEl) {
            searchEl.addEventListener('input', () => {
                clearTimeout(_searchDebounce);
                _searchDebounce = setTimeout(() => {
                    _filterQuery = searchEl.value.trim();
                    _renderGrid();
                }, 280);
            });
        }

        // Color filter dots
        document.querySelectorAll('#notesColorFilter .color-dot-filter').forEach(dot => {
            dot.addEventListener('click', () => {
                document.querySelectorAll('#notesColorFilter .color-dot-filter').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                _filterColor = dot.dataset.color;
                _renderGrid();
            });
        });

        // Tag sidebar
        const tagList = document.getElementById('notesTagList');
        if (tagList) {
            tagList.addEventListener('click', e => {
                const item = e.target.closest('.notes-tag-item');
                if (!item) return;
                document.querySelectorAll('.notes-tag-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                _filterTag = item.dataset.tag;
                _renderGrid();
            });
        }

        // Modal color swatches
        document.querySelectorAll('.notes-modal .color-swatch, .notes-color-row .color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                sw.classList.add('active');
                _selectedColor = sw.dataset.color;
            });
        });

        // Tag input
        const tagInput = document.getElementById('noteModalTagInput');
        if (tagInput) {
            tagInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const val = tagInput.value.trim().toLowerCase().replace(/,/g, '');
                    if (val && !_currentTags.includes(val)) {
                        _currentTags.push(val);
                        _renderTagChips();
                    }
                    tagInput.value = '';
                }
                if (e.key === 'Backspace' && !tagInput.value && _currentTags.length) {
                    _currentTags.pop();
                    _renderTagChips();
                }
            });
        }

        // Close modal on overlay click
        const overlay = document.getElementById('notesModalOverlay');
        if (overlay) {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) noteCloseModal();
            });
        }
    }

    // ── Data loading ────────────────────────────────────────────────────────
    async function _loadNotes() {
        const res = await window.api.getNotes({ owner_id: _currentUser.id });
        if (res.success) {
            _allNotes = res.data;
            _renderGrid();
            _renderStats();
        }
    }

    async function _loadTags() {
        const res = await window.api.getAllTags(_currentUser.id);
        if (res.success) {
            _allTags = res.data;
            _renderTagSidebar();
        }
    }

    // ── Grid rendering ──────────────────────────────────────────────────────
    function _renderGrid() {
        const grid = document.getElementById('notesGrid');
        const emptyEl = document.getElementById('notesEmpty');
        const emptyMsg = document.getElementById('notesEmptyMsg');
        const countLabel = document.getElementById('noteCountLabel');
        if (!grid) return;

        let notes = [..._allNotes];

        // Special tag filters
        if (_filterTag === '__pinned__') {
            notes = notes.filter(n => n.is_pinned);
        } else if (_filterTag === '__reminder__') {
            notes = notes.filter(n => n.reminder_date);
        } else if (_filterTag) {
            notes = notes.filter(n => n.tags && n.tags.includes(_filterTag));
        }

        // Color filter
        if (_filterColor && _filterColor !== 'all') {
            notes = notes.filter(n => n.color === _filterColor);
        }

        // Text search
        if (_filterQuery) {
            const q = _filterQuery.toLowerCase();
            notes = notes.filter(n =>
                (n.title || '').toLowerCase().includes(q) ||
                _stripHtml(n.content || '').toLowerCase().includes(q)
            );
        }

        if (notes.length === 0) {
            grid.innerHTML = '';
            emptyEl.style.display = 'block';
            if (_filterQuery) {
                emptyMsg.innerHTML = `Không có kết quả cho <b>"${_filterQuery}"</b>`;
            } else {
                emptyMsg.innerHTML = 'Chưa có ghi chú nào. Nhấn <b>+ Ghi chú mới</b> để bắt đầu!';
            }
            countLabel.textContent = '';
            return;
        }

        emptyEl.style.display = 'none';
        countLabel.textContent = `${notes.length} ghi chú`;

        grid.innerHTML = notes.map(n => _noteCardHtml(n)).join('');
    }

    function _noteCardHtml(n) {
        const color = n.color || 'default';
        const pinBadge = n.is_pinned ? `<span class="note-badge badge-pin" title="Đã ghim"><i class="fas fa-thumbtack"></i></span>` : '';
        const lockBadge = n.is_locked ? `<span class="note-badge badge-lock" title="Đã khóa"><i class="fas fa-lock"></i></span>` : '';
        const tags = (n.tags || []).map(t => `<span class="note-tag-chip">#${t}</span>`).join('');
        const plainContent = _stripHtml(n.content || '');
        const reminder = _reminderBadge(n.reminder_date, n.reminder_time);
        const updatedTime = _relativeTime(n.updated_at);

        return `
        <div class="note-card color-${color}" data-id="${n.id}" onclick="noteCardClick(${n.id}, event)">
            <div class="note-card-stripe"></div>
            <div class="note-card-inner">
                <div class="note-card-top">
                    <div class="note-card-title">${_escHtml(n.title) || '<span style="color:#9ca3af;font-style:italic;font-weight:400;">Không có tiêu đề</span>'}</div>
                    <div class="note-card-badges">
                        ${pinBadge}${lockBadge}
                        <div class="note-card-actions">
                            <button class="note-action-btn" title="Chỉnh sửa" onclick="noteEditById(${n.id},event)"><i class="fas fa-pen"></i></button>
                            <button class="note-action-btn" title="${n.is_pinned ? 'Bỏ ghim' : 'Ghim'}" onclick="noteTogglePinById(${n.id},event)"><i class="fas fa-thumbtack"></i></button>
                            <button class="note-action-btn danger" title="Xóa" onclick="noteDeleteById(${n.id},event)"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                </div>
                ${plainContent ? `<div class="note-card-body">${_escHtml(plainContent)}</div>` : ''}
                <div class="note-card-footer">
                    ${tags}
                    ${reminder}
                    <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${updatedTime}</span>
                </div>
            </div>
        </div>`;
    }

    function _renderStats() {
        const total = _allNotes.length;
        const pinned = _allNotes.filter(n => n.is_pinned).length;
        const locked = _allNotes.filter(n => n.is_locked).length;
        const reminder = _allNotes.filter(n => n.reminder_date).length;
        _setText('noteStatTotal', total);
        _setText('noteStatPinned', pinned);
        _setText('noteStatLocked', locked);
        _setText('noteStatReminder', reminder);
    }

    function _renderTagSidebar() {
        const listEl = document.getElementById('notesTagList');
        if (!listEl) return;

        // Update total count
        _setText('tagCountAll', _allNotes.length);

        // Remove old dynamic items
        listEl.querySelectorAll('.notes-tag-item.dynamic').forEach(el => el.remove());

        // Add dynamic tags
        _allTags.forEach(t => {
            const item = document.createElement('div');
            item.className = 'notes-tag-item dynamic';
            item.dataset.tag = t.tag;
            item.innerHTML = `<span><i class="fas fa-hashtag"></i>${t.tag}</span><span class="notes-tag-count">${t.count}</span>`;
            listEl.appendChild(item);
        });

        // Re-bind click
        listEl.querySelectorAll('.notes-tag-item').forEach(item => {
            item.addEventListener('click', () => {
                listEl.querySelectorAll('.notes-tag-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                _filterTag = item.dataset.tag;
                _renderGrid();
            });
        });
    }

    function _renderTagChips() {
        const preview = document.getElementById('noteModalTagsPreview');
        if (!preview) return;
        preview.innerHTML = _currentTags.map((tag, idx) =>
            `<span class="notes-tag-chip-rm" onclick="noteRemoveTag(${idx})">
                #${tag} <i class="fas fa-times"></i>
            </span>`
        ).join('');
    }

    // ── Modal ───────────────────────────────────────────────────────────────
    function noteOpenModal(noteData) {
        _editingNoteId = noteData ? noteData.id : null;
        _currentTags = noteData ? [...(noteData.tags || [])] : [];
        _isPinned = noteData ? !!noteData.is_pinned : false;
        _isLocked = noteData ? !!noteData.is_locked : false;
        _selectedColor = noteData ? (noteData.color || 'default') : 'default';

        const titleEl = document.getElementById('noteModalTitle');
        const editorEl = document.getElementById('noteEditorArea');
        const reminderEl = document.getElementById('noteModalReminder');
        const reminderTimeEl = document.getElementById('noteModalReminderTime');
        const pinBtn = document.getElementById('notePinBtn');
        const lockBtn = document.getElementById('noteLockBtn');
        const deleteBtn = document.getElementById('noteDeleteBtn');

        if (titleEl) titleEl.value = noteData ? (noteData.title || '') : '';
        if (editorEl) {
            editorEl.innerHTML = noteData ? (noteData.content || '') : '';
            // If locked, disable editing
            editorEl.contentEditable = (!noteData || !noteData.is_locked) ? 'true' : 'false';
            editorEl.style.opacity = (noteData && noteData.is_locked) ? '0.65' : '1';
        }
        if (reminderEl) reminderEl.value = noteData ? (noteData.reminder_date || '') : '';
        if (reminderTimeEl) reminderTimeEl.value = noteData ? (noteData.reminder_time || '08:00') : '08:00';
        if (deleteBtn) deleteBtn.style.display = noteData ? 'inline-flex' : 'none';

        // Checkbox: checked if note has a reminder date
        const reminderCheck = document.getElementById('noteReminderCheck');
        const hasReminder = !!(noteData && noteData.reminder_date);
        if (reminderCheck) {
            reminderCheck.checked = hasReminder;
            _setReminderInputsEnabled(hasReminder);
        }

        // Color swatch
        document.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.color === _selectedColor);
        });

        // Bind swatch click (ensure fresh binding)
        document.querySelectorAll('.color-swatch').forEach(sw => {
            sw.onclick = () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                sw.classList.add('active');
                _selectedColor = sw.dataset.color;
            };
        });

        _updateToggleBtns(pinBtn, lockBtn);
        _renderTagChips();

        const overlay = document.getElementById('notesModalOverlay');
        if (overlay) overlay.classList.add('active');
        if (titleEl) setTimeout(() => titleEl.focus(), 80);
    }

    function _updateToggleBtns(pinBtn, lockBtn) {
        if (pinBtn) pinBtn.classList.toggle('on', _isPinned);
        if (lockBtn) lockBtn.classList.toggle('on', _isLocked);
    }

    function noteCloseModal() {
        const overlay = document.getElementById('notesModalOverlay');
        if (overlay) overlay.classList.remove('active');
        document.getElementById('noteTemplateDropdown').classList.remove('open');
    }

    async function noteSave() {
        const title = (document.getElementById('noteModalTitle').value || '').trim();
        const content = document.getElementById('noteEditorArea').innerHTML || '';
        const reminderCheck = document.getElementById('noteReminderCheck');
        const reminder = (reminderCheck && reminderCheck.checked)
            ? (document.getElementById('noteModalReminder').value || null)
            : null;
        const reminderTime = (reminderCheck && reminderCheck.checked)
            ? (document.getElementById('noteModalReminderTime').value || '08:00')
            : '08:00';

        if (!title && !_stripHtml(content)) {
            Swal.fire({ icon: 'warning', title: 'Chú ý', text: 'Vui lòng nhập tiêu đề hoặc nội dung ghi chú.', timer: 2000, showConfirmButton: false });
            return;
        }

        const btn = document.getElementById('noteSaveBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...'; }

        const payload = {
            title,
            content,
            color: _selectedColor,
            is_pinned: _isPinned ? 1 : 0,
            is_locked: _isLocked ? 1 : 0,
            reminder_date: reminder,
            reminder_time: reminderTime,
            tags: _currentTags,
            owner_id: _currentUser.id
        };

        let res;
        if (_editingNoteId) {
            res = await window.api.updateNote(_editingNoteId, payload);
        } else {
            res = await window.api.addNote(payload);
        }

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Lưu'; }

        if (res.success) {
            noteCloseModal();
            await _loadNotes();
            await _loadTags();
            Swal.fire({ icon: 'success', title: 'Đã lưu!', timer: 1200, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: res.error || 'Không thể lưu ghi chú.' });
        }
    }

    async function noteDeleteCurrent() {
        if (!_editingNoteId) return;
        await noteDeleteById(_editingNoteId);
    }

    // ── Card actions (global functions) ────────────────────────────────────
    window.noteOpenModal = noteOpenModal;
    window.noteCloseModal = noteCloseModal;
    window.noteSave = noteSave;
    window.noteDeleteCurrent = noteDeleteCurrent;

    window.noteCardClick = async function (id, e) {
        if (e.target.closest('.note-action-btn') || e.target.closest('[data-stop]')) return;
        const note = _allNotes.find(n => n.id === id);
        if (note) noteOpenModal(note);
    };

    window.noteEditById = async function (id, e) {
        e.stopPropagation();
        const note = _allNotes.find(n => n.id === id);
        if (note) noteOpenModal(note);
    };

    window.noteDeleteById = async function (id, e) {
        if (e) e.stopPropagation();
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Xóa ghi chú?',
            text: 'Hành động này không thể hoàn tác.',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy'
        });
        if (!confirm.isConfirmed) return;
        const res = await window.api.deleteNote(id);
        if (res.success) {
            if (_editingNoteId === id) noteCloseModal();
            await _loadNotes();
            await _loadTags();
            Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1000, showConfirmButton: false });
        }
    };

    window.noteTogglePinById = async function (id, e) {
        e.stopPropagation();
        const note = _allNotes.find(n => n.id === id);
        if (!note) return;
        const res = await window.api.updateNote(id, {
            title: note.title, content: note.content, color: note.color,
            is_pinned: note.is_pinned ? 0 : 1,
            is_locked: note.is_locked, reminder_date: note.reminder_date, tags: note.tags
        });
        if (res.success) await _loadNotes();
    };

    window.noteTogglePin = function () {
        _isPinned = !_isPinned;
        document.getElementById('notePinBtn').classList.toggle('on', _isPinned);
    };

    window.noteToggleLock = function () {
        _isLocked = !_isLocked;
        document.getElementById('noteLockBtn').classList.toggle('on', _isLocked);
        const editorEl = document.getElementById('noteEditorArea');
        if (editorEl) {
            editorEl.contentEditable = _isLocked ? 'false' : 'true';
            editorEl.style.opacity = _isLocked ? '0.65' : '1';
        }
    };

    function _setReminderInputsEnabled(enabled) {
        const dateEl = document.getElementById('noteModalReminder');
        const timeEl = document.getElementById('noteModalReminderTime');
        [dateEl, timeEl].forEach(el => {
            if (!el) return;
            el.disabled = !enabled;
            el.style.opacity = enabled ? '1' : '.45';
            el.style.pointerEvents = enabled ? '' : 'none';
        });
    }

    window.noteToggleReminderInputs = function (checkbox) {
        _setReminderInputsEnabled(checkbox.checked);
        if (checkbox.checked) {
            // Auto-fill today's date if empty
            const dateEl = document.getElementById('noteModalReminder');
            if (dateEl && !dateEl.value) {
                const today = new Date();
                dateEl.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                dateEl.focus();
            }
        } else {
            // Clear values when unchecked
            const dateEl = document.getElementById('noteModalReminder');
            const timeEl = document.getElementById('noteModalReminderTime');
            if (dateEl) dateEl.value = '';
            if (timeEl) timeEl.value = '08:00';
        }
    };

    window.noteRemoveTag = function (idx) {
        _currentTags.splice(idx, 1);
        _renderTagChips();
    };

    window.noteExecCmd = function (cmd) {
        document.getElementById('noteEditorArea').focus();
        document.execCommand(cmd, false, null);
    };

    window.noteTestNotification = async function () {
        const btn = document.getElementById('btnTestNotif');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...'; }
        try {
            const res = await window.api.testReminderNotification();
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Thành công!', text: 'Notification hiện trên góc màn hình. Nếu không thấy, kiểm tra cài đặt thông báo Windows.', timer: 3000, showConfirmButton: false });
            } else {
                Swal.fire({ icon: 'error', title: 'Lỗi', text: res.error || 'Không thể gửi notification.' });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: e.message });
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bell"></i> Test thông báo'; }
        }
    };

    window.noteCheckRemindersNow = async function () {
        const btn = document.getElementById('btnCheckReminders');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
        try {
            const res = await window.api.checkRemindersNow();
            if (res.success) {
                const { nowDate, nowTime, pending, fired } = res.debug;
                if (fired.length > 0) {
                    Swal.fire({ icon: 'success', title: `Đã gửi ${fired.length} thông báo!`, text: fired.map(f => f.title).join(', '), timer: 3000, showConfirmButton: false });
                    await _loadNotes();
                } else if (pending.length === 0) {
                    Swal.fire({ icon: 'info', title: 'Không có nhắc nhở', text: `Thời gian hiện tại: ${nowDate} ${nowTime}\nKhông có ghi chú nào có nhắc nhở pending.`, timer: 3000, showConfirmButton: false });
                } else {
                    const pendingInfo = pending.map(p => `"${p.title}": ${p.reminder_date} ${p.reminder_time || '08:00'}`).join('\n');
                    Swal.fire({ icon: 'info', title: `Chưa đến giờ (${pending.length} nhắc nhở)`, html: `<div style="text-align:left;font-size:13px;"><b>Giờ hiện tại:</b> ${nowDate} ${nowTime}<br><br><b>Nhắc nhở đang chờ:</b><br><pre style="margin:4px 0;font-size:12px;">${pendingInfo}</pre></div>` });
                }
            } else {
                Swal.fire({ icon: 'error', title: 'Lỗi debug', text: res.error });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: e.message });
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Kiểm tra ngay'; }
        }
    };

    window.noteToggleTemplates = function (e) {
        e.stopPropagation();
        document.getElementById('noteTemplateDropdown').classList.toggle('open');
    };

    window.noteApplyTemplate = function (type) {
        const editor = document.getElementById('noteEditorArea');
        if (!editor) return;
        if (editor.innerHTML && editor.innerHTML !== '<br>') {
            if (!confirm('Thay thế nội dung hiện tại bằng mẫu này?')) return;
        }
        editor.innerHTML = TEMPLATES[type] || '';
        document.getElementById('noteTemplateDropdown').classList.remove('open');
        editor.focus();
    };

    // Close template dropdown when clicking outside
    document.addEventListener('click', () => {
        const dd = document.getElementById('noteTemplateDropdown');
        if (dd) dd.classList.remove('open');
    });

    // ── Helpers ─────────────────────────────────────────────────────────────
    function _stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    function _escHtml(str) {
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(str || ''));
        return d.innerHTML;
    }

    function _setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function _reminderBadge(dateStr, timeStr) {
        if (!dateStr) return '';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const rem = new Date(dateStr); rem.setHours(0, 0, 0, 0);
        const diff = rem - today;
        const timeDisplay = timeStr || '08:00';
        let cls = 'note-reminder-badge';
        let label;
        if (diff < 0) {
            cls += ' overdue';
            label = `Quá hạn ${dateStr} ${timeDisplay}`;
        } else if (diff === 0) {
            cls += ' today';
            label = `Hôm nay ${timeDisplay}`;
        } else {
            label = `${dateStr} ${timeDisplay}`;
        }
        return `<span class="${cls}"><i class="fas fa-bell"></i> ${label}</span>`;
    }

    function _relativeTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        const diffH = Math.floor(diffMins / 60);
        if (diffH < 24) return `${diffH} giờ trước`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD} ngày trước`;
        return d.toLocaleDateString('vi-VN');
    }

    // ── Expose init ─────────────────────────────────────────────────────────
    window.initNotesModule = initNotesModule;

})();
