/* ============================================
   chat-settings.js — 聊天室设置面板
   独立模块，挂载到 window.ChatRoomSettings
   ============================================ */
(function () {
    'use strict';

    var DB_NAME = 'lingji_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'images';
    var KEY_CHAR_AVATAR_PREFIX = '_chat_char_avatar_';
    var KEY_ROOM_WALLPAPER_PREFIX = '_chat_room_wallpaper_';
    var LS_KEY = 'lingji_chat';

    /* ====== IndexedDB 辅助 ====== */
    function openDB(cb) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        req.onsuccess = function (e) { cb(null, e.target.result); };
        req.onerror = function () { cb(new Error('DB error')); };
    }
    function saveBlob(key, blob, cb) {
        openDB(function (err, db) {
            if (err) { if (cb) cb(err); return; }
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(blob, key);
            tx.oncomplete = function () { if (cb) cb(null); };
        });
    }
    function loadBlob(key, cb) {
        openDB(function (err, db) {
            if (err) { cb(err); return; }
            var tx = db.transaction(STORE_NAME, 'readonly');
            var req2 = tx.objectStore(STORE_NAME).get(key);
            req2.onsuccess = function () { cb(null, req2.result || null); };
        });
    }
    function deleteBlob(key, cb) {
        openDB(function (err, db) {
            if (err) { if (cb) cb(err); return; }
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = function () { if (cb) cb(null); };
        });
    }

    /* ====== 本地存储 ====== */
    function loadData() {
        try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
    }
    function saveData(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
    function escHtml(s) {
        var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
    }

    /* 获取某角色的聊天室配置 */
    function getRoomConfig(charId) {
        var d = loadData();
        return (d.roomConfig && d.roomConfig[charId]) || {};
    }
    function saveRoomConfig(charId, cfg) {
        var d = loadData();
        if (!d.roomConfig) d.roomConfig = {};
        d.roomConfig[charId] = cfg;
        saveData(d);
    }

    /* 获取角色数据 */
    function getChar(charId) {
        var d = loadData();
        var chars = d.characters || [];
        for (var i = 0; i < chars.length; i++) {
            if (chars[i].id === charId) return chars[i];
        }
        return null;
    }

    /* toast（复用 ChatApp 的） */
    function toast(msg) {
        if (window.ChatApp && window.ChatApp.toast) {
            window.ChatApp.toast(msg);
        }
    }

    /* 时区列表 */
    var TIMEZONE_LIST = [
        { id: 'Asia/Tokyo', name: '日本时间 (JST UTC+9)', offset: 9 },
        { id: 'Asia/Seoul', name: '韩国时间 (KST UTC+9)', offset: 9 },
        { id: 'Asia/Shanghai', name: '中国时间 (CST UTC+8)', offset: 8 },
        { id: 'Asia/Taipei', name: '台湾时间 (CST UTC+8)', offset: 8 },
        { id: 'Asia/Hong_Kong', name: '香港时间 (HKT UTC+8)', offset: 8 },
        { id: 'America/New_York', name: '美国东部 (EST UTC-5)', offset: -5 },
        { id: 'America/Los_Angeles', name: '美国西部 (PST UTC-8)', offset: -8 },
        { id: 'Europe/London', name: '英国时间 (GMT UTC+0)', offset: 0 },
        { id: 'Europe/Paris', name: '法国时间 (CET UTC+1)', offset: 1 },
        { id: 'Australia/Sydney', name: '澳洲东部 (AEST UTC+10)', offset: 10 }
    ];

    /* ====== 主模块 ====== */
    var ChatRoomSettings = {

        _avatarFile: null,
        _wallpaperFile: null,

        open: function (chatSub, charId) {
            var self = this;
            self._avatarFile = null;
            self._wallpaperFile = null;

            var char = getChar(charId);
            if (!char) { toast('角色不存在'); return; }

            var rc = getRoomConfig(charId);
            var d = loadData();
            var chars = d.characters || [];

            /* 收集 user 人设列表
     与 openCharacterPage 保持一致：
     type === 'user' 或 type 为空/undefined 都算 user 人设
     只排除明确标注为 type === 'char' 的 NPC 角色           */
            var userChars = [];
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].type !== 'char') userChars.push(chars[i]);
            }

            /* 收集表情包列表 */
            var stickerPacks = d.stickerPacks || [];

            /* 收集世界书列表 */
            var worldBooks = d.worldBooks || [];

            /* 构建页面 */
            var panel = document.createElement('div');
            panel.className = 'chat-sub-page crs-panel';
            panel.id = 'crs-panel';

            var html = '';

            /* 顶栏 */
            html += '<div class="crs-header">' +
                '<button class="crs-back" id="crs-back">' +
                '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<span class="crs-header-title">聊天设置</span>' +
                '</div>';

            html += '<div class="crs-body">';

            /* ===== 1. 角色头像 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">角色头像</div>' +
                '<div class="crs-avatar-wrap">' +
                '<div class="crs-avatar" id="crs-avatar">' +
                '<svg viewBox="0 0 24 24" width="32" height="32" stroke="#ccc" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                '</div>' +
                '<label class="crs-avatar-change" for="crs-avatar-input">更换头像</label>' +
                '<input type="file" accept="image/*" id="crs-avatar-input" style="display:none">' +
                '</div>' +
                '</div>';

            /* ===== 2. 角色备注 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">角色备注 <span class="crs-hint">（仅当前窗口显示）</span></div>' +
                '<input class="crs-input" id="crs-remark" placeholder="给角色起个备注名..." value="' + escHtml(rc.remark || '') + '">' +
                '</div>';

            /* ===== 3. 角色修改 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">角色资料</div>' +
                '<div class="crs-field-group">' +
                '<label class="crs-field-label">名称</label>' +
                '<input class="crs-input" id="crs-char-name" value="' + escHtml(char.name || '') + '">' +
                '</div>' +
                '<div class="crs-field-group">' +
                '<label class="crs-field-label">昵称</label>' +
                '<input class="crs-input" id="crs-char-nickname" value="' + escHtml(char.nickname || '') + '">' +
                '</div>' +
                '<div class="crs-field-group">' +
                '<label class="crs-field-label">性别</label>' +
                '<div class="crs-gender-group" id="crs-gender-group">' +
                '<span class="crs-gender-opt' + (char.gender === 'male' ? ' active' : '') + '" data-g="male">♂ 男</span>' +
                '<span class="crs-gender-opt' + (char.gender === 'female' ? ' active' : '') + '" data-g="female">♀ 女</span>' +
                '<span class="crs-gender-opt' + (char.gender === '其他' || (!char.gender) ? ' active' : '') + '" data-g="其他">⚪ 其他</span>' +
                '</div>' +
                '</div>' +
                '<div class="crs-field-group">' +
                '<label class="crs-field-label">详细人设</label>' +
                '<textarea class="crs-textarea" id="crs-char-detail" rows="6" placeholder="性格、背景、说话方式、口癖...">' + escHtml(char.detail || '') + '</textarea>' +
                '</div>' +
                '<button class="crs-save-char-btn" id="crs-save-char">保存角色修改</button>' +
                '</div>';

            /* ===== 4. 挂载 user 人设 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">挂载 User 人设</div>';
            if (userChars.length === 0) {
                html += '<div class="crs-empty-hint">暂无可用的 User 人设，请先创建</div>';
            } else {
                html += '<div class="crs-select-list" id="crs-user-list">';
                var mountedUser = rc.mountedUserCharId || d.activeCharId || '';
                for (var u = 0; u < userChars.length; u++) {
                    var isActive = (userChars[u].id === mountedUser) ? ' active' : '';
                    html += '<div class="crs-select-item' + isActive + '" data-user-id="' + userChars[u].id + '">' +
                        '<span>' + escHtml(userChars[u].name) + '</span>' +
                        '<svg class="crs-check" viewBox="0 0 24 24" width="16" height="16"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '</div>';
                }
                html += '</div>';
            }
            html += '</div>';

            /* ===== 5. 挂载表情包分组 ===== */
            var stickerGroups = d.stickerGroups || [];
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">挂载表情包分组 <span class="crs-hint">（可多选）</span></div>';
            if (stickerGroups.length === 0) {
                html += '<div class="crs-empty-hint">暂无表情包分组，请先在「我」→「表情包」中创建</div>';
            } else {
                html += '<div class="crs-select-list" id="crs-sticker-list">';
                var mountedStickers = rc.mountedStickers || [];
                for (var s = 0; s < stickerGroups.length; s++) {
                    var sg = stickerGroups[s];
                    var sAct = (mountedStickers.indexOf(sg.id) !== -1) ? ' active' : '';
                    var sCount = (sg.stickers || []).length;
                    html += '<div class="crs-select-item crs-multi' + sAct + '" data-sticker-id="' + sg.id + '">' +
                        '<div style="flex:1">' +
                        '<span>' + escHtml(sg.name || '未命名') + '</span>' +
                        '<span class="crs-hint" style="margin-left:6px">' + sCount + '张</span>' +
                        '</div>' +
                        '<svg class="crs-check" viewBox="0 0 24 24" width="16" height="16"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '</div>';
                }
                html += '</div>';
            }
            html += '</div>';

            /* ===== 6. 挂载世界书 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">挂载世界书</div>';
            if (worldBooks.length === 0) {
                html += '<div class="crs-empty-hint">暂无世界书</div>';
            } else {
                html += '<div class="crs-select-list" id="crs-wb-list">';
                var mountedWB = rc.mountedWorldBooks || [];
                for (var w = 0; w < worldBooks.length; w++) {
                    var wAct = (mountedWB.indexOf(worldBooks[w].id) !== -1) ? ' active' : '';
                    html += '<div class="crs-select-item crs-multi' + wAct + '" data-wb-id="' + worldBooks[w].id + '">' +
                        '<span>' + escHtml(worldBooks[w].name || ('世界书 ' + (w + 1))) + '</span>' +
                        '<svg class="crs-check" viewBox="0 0 24 24" width="16" height="16"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '</div>';
                }
                html += '</div>';
            }
            html += '</div>';

            /* ===== 7. MiniMax 语音连接 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">MiniMax 语音连接</div>' +
                '<div class="crs-field-group">' +
                '<label class="crs-field-label">Group ID</label>' +
                '<input class="crs-input" id="crs-mm-group" placeholder="MiniMax Group ID" value="' + escHtml(rc.minimaxGroupId || '') + '">' +
                '</div>' +
                '<div class="crs-field-group">' +
                '<label class="crs-field-label">API Key</label>' +
                '<input class="crs-input" id="crs-mm-key" type="password" placeholder="MiniMax API Key" value="' + escHtml(rc.minimaxApiKey || '') + '">' +
                '</div>' +
                '<div class="crs-field-group">' +
                '<label class="crs-field-label">Voice ID</label>' +
                '<input class="crs-input" id="crs-mm-voice" placeholder="语音角色ID（可选）" value="' + escHtml(rc.minimaxVoiceId || '') + '">' +
                '</div>' +
                '<button class="crs-small-btn" id="crs-mm-save">保存语音配置</button>' +
                '</div>';

            /* ===== 8. 时间感知 ===== */
            var timeEnabled = rc.timeAware || false;
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">时间感知</div>' +
                '<div class="crs-toggle-row">' +
                '<span>启用时间感知</span>' +
                '<label class="crs-toggle">' +
                '<input type="checkbox" id="crs-time-toggle"' + (timeEnabled ? ' checked' : '') + '>' +
                '<span class="crs-toggle-slider"></span>' +
                '</label>' +
                '</div>' +
                '<div class="crs-hint-text">开启后，角色会感知当前时间并据此调整回复</div>' +
                '<div class="crs-time-zone-wrap" id="crs-time-zone-wrap" style="' + (timeEnabled ? '' : 'display:none') + '">' +
                '<label class="crs-field-label">角色遵守的时区</label>' +
                '<select class="crs-select" id="crs-timezone">';
            var selectedTZ = rc.timezone || 'Asia/Tokyo';
            for (var tz = 0; tz < TIMEZONE_LIST.length; tz++) {
                html += '<option value="' + TIMEZONE_LIST[tz].id + '"' + (selectedTZ === TIMEZONE_LIST[tz].id ? ' selected' : '') + '>' + TIMEZONE_LIST[tz].name + '</option>';
            }
            html += '</select></div></div>';

            /* ===== 9. 当前窗口壁纸 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">当前窗口壁纸</div>' +
                '<div class="crs-wallpaper-wrap">' +
                '<div class="crs-wallpaper-preview" id="crs-wallpaper-preview">' +
                (rc.hasWallpaper ? '<span class="crs-wp-set">已设置</span>' : '<span class="crs-wp-empty">未设置</span>') +
                '</div>' +
                '<div class="crs-wallpaper-btns">' +
                '<label class="crs-small-btn" for="crs-wallpaper-input">选择图片</label>' +
                '<input type="file" accept="image/*" id="crs-wallpaper-input" style="display:none">' +
                '<button class="crs-small-btn crs-danger-small" id="crs-wallpaper-clear">清除壁纸</button>' +
                '</div>' +
                '</div>' +
                '</div>';

            /* ===== 10. 是否启用翻译 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">翻译设置</div>' +
                '<div class="crs-toggle-row">' +
                '<span>启用自动翻译</span>' +
                '<label class="crs-toggle">' +
                '<input type="checkbox" id="crs-translate-toggle"' + (rc.translateEnabled ? ' checked' : '') + '>' +
                '<span class="crs-toggle-slider"></span>' +
                '</label>' +
                '</div>' +
                '<div class="crs-hint-text">开启后，角色的回复会附带翻译</div>' +
                '</div>';

            /* ===== 11. 后台模式 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-toggle-row">' +
                '<div>' +
                '<span>后台模式</span>' +
                '<div class="crs-hint-text" style="margin-top:2px">离开聊天窗口后角色仍可处理消息</div>' +
                '</div>' +
                '<label class="crs-toggle">' +
                '<input type="checkbox" id="crs-bg-toggle"' + (rc.backgroundMode ? ' checked' : '') + '>' +
                '<span class="crs-toggle-slider"></span>' +
                '</label>' +
                '</div>' +
                '</div>';

            /* ===== 12. 主动发动态 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-toggle-row">' +
                '<div>' +
                '<span>主动发动态</span>' +
                '<div class="crs-hint-text" style="margin-top:2px">角色会自主发布朋友圈/动态</div>' +
                '</div>' +
                '<label class="crs-toggle">' +
                '<input type="checkbox" id="crs-moment-toggle"' + (rc.autoMoment ? ' checked' : '') + '>' +
                '<span class="crs-toggle-slider"></span>' +
                '</label>' +
                '</div>' +
                '</div>';

            /* ===== 13. 允许角色主动发消息 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-toggle-row">' +
                '<div>' +
                '<span>允许角色主动发消息</span>' +
                '<div class="crs-hint-text" style="margin-top:2px">角色可在你未发送消息时主动联系你</div>' +
                '</div>' +
                '<label class="crs-toggle">' +
                '<input type="checkbox" id="crs-proactive-toggle"' + (rc.proactiveMsg ? ' checked' : '') + '>' +
                '<span class="crs-toggle-slider"></span>' +
                '</label>' +
                '</div>' +
                '</div>';

            /* ===== 14. 记忆总结 ===== */
            html += '<div class="crs-section">' +
                '<div class="crs-section-title">记忆总结</div>' +
                '<textarea class="crs-textarea" id="crs-memory" rows="10" style="min-height:160px;max-height:400px;resize:vertical;overflow-y:auto;" placeholder="角色对聊天的长期记忆摘要（手动编辑或自动生成）">' + escHtml(rc.memorySummary || '') + '</textarea>' +
                '<div class="crs-row-btns">' +
                '<button class="crs-small-btn" id="crs-memory-save">保存记忆</button>' +
                '<button class="crs-small-btn" id="crs-memory-auto">自动总结</button>' +
                '</div>' +
                '</div>';

            /* ===== 15. 危险操作 ===== */
            html += '<div class="crs-section crs-danger-section">' +
                '<div class="crs-section-title" style="color:#e53935">危险操作</div>' +
                '<button class="crs-danger-btn" id="crs-clear-history">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
                '<span>清理聊天记录</span>' +
                '</button>' +
                '<button class="crs-danger-btn" id="crs-delete-friend">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="11" x2="23" y2="11"/></svg>' +
                '<span>删除好友</span>' +
                '</button>' +
                '</div>';

            html += '</div>'; /* end crs-body */

            panel.innerHTML = html;
            chatSub.appendChild(panel);
            requestAnimationFrame(function () { panel.classList.add('open'); });

            /* ====== 加载头像预览 ====== */
            loadBlob(KEY_CHAR_AVATAR_PREFIX + charId, function (err, blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                var avEl = panel.querySelector('#crs-avatar');
                if (avEl) avEl.innerHTML = '<img src="' + url + '" alt="">';
            });

            /* 加载壁纸预览 */
            loadBlob(KEY_ROOM_WALLPAPER_PREFIX + charId, function (err, blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                var wpEl = panel.querySelector('#crs-wallpaper-preview');
                if (wpEl) wpEl.innerHTML = '<img src="' + url + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">';
            });

            /* ====== 事件绑定 ====== */

            /* 返回 */
            panel.querySelector('#crs-back').addEventListener('click', function () {
                self.close(panel);
            });

            /* 头像更换 */
            panel.querySelector('#crs-avatar-input').addEventListener('change', function () {
                var file = this.files[0];
                if (!file || file.type.indexOf('image/') !== 0) return;
                self._avatarFile = file;
                var url = URL.createObjectURL(file);
                panel.querySelector('#crs-avatar').innerHTML = '<img src="' + url + '" alt="">';

                /* 立即保存到 IndexedDB */
                var blob = file.slice(0, file.size, file.type);
                saveBlob(KEY_CHAR_AVATAR_PREFIX + charId, blob, function () {
                    toast('头像已更新');
                    /* 同步到顶栏 */
                    var topAvatar = chatSub.querySelector('#cr-topbar-avatar');
                    if (topAvatar) topAvatar.innerHTML = '<img src="' + url + '" alt="">';
                });
                this.value = '';
            });

            /* 角色备注 — 实时保存 */
            panel.querySelector('#crs-remark').addEventListener('change', function () {
                var cfg = getRoomConfig(charId);
                cfg.remark = this.value.trim();
                saveRoomConfig(charId, cfg);
                toast('备注已保存');

                /* 同步到顶栏 */
                var topName = chatSub.querySelector('.cr-topbar-name');
                if (topName && cfg.remark) {
                    topName.textContent = cfg.remark;
                }
            });

            /* 性别选择 */
            var genderGroup = panel.querySelector('#crs-gender-group');
            genderGroup.addEventListener('click', function (e) {
                var opt = e.target.closest('.crs-gender-opt');
                if (!opt) return;
                var opts = genderGroup.querySelectorAll('.crs-gender-opt');
                for (var j = 0; j < opts.length; j++) opts[j].classList.remove('active');
                opt.classList.add('active');
            });

            /* 保存角色修改 */
            panel.querySelector('#crs-save-char').addEventListener('click', function () {
                var dd = loadData();
                var cs = dd.characters || [];
                for (var i = 0; i < cs.length; i++) {
                    if (cs[i].id === charId) {
                        cs[i].name = panel.querySelector('#crs-char-name').value.trim() || cs[i].name;
                        cs[i].nickname = panel.querySelector('#crs-char-nickname').value.trim();
                        var gEl = panel.querySelector('.crs-gender-opt.active');
                        if (gEl) cs[i].gender = gEl.getAttribute('data-g');
                        cs[i].detail = panel.querySelector('#crs-char-detail').value.trim();
                        break;
                    }
                }
                dd.characters = cs;
                saveData(dd);
                toast('角色信息已保存');

                /* 同步到顶栏 */
                var updatedChar = getChar(charId);
                if (updatedChar) {
                    var topName = chatSub.querySelector('.cr-topbar-name');
                    if (topName) topName.textContent = updatedChar.name;
                }
            });

            /* 挂载 user 人设 */
            var userList = panel.querySelector('#crs-user-list');
            if (userList) {
                userList.addEventListener('click', function (e) {
                    var item = e.target.closest('.crs-select-item');
                    if (!item) return;
                    var uid = item.getAttribute('data-user-id');
                    /* 单选 */
                    var items = userList.querySelectorAll('.crs-select-item');
                    for (var k = 0; k < items.length; k++) items[k].classList.remove('active');
                    item.classList.add('active');

                    var cfg = getRoomConfig(charId);
                    cfg.mountedUserCharId = uid;
                    saveRoomConfig(charId, cfg);
                    toast('已挂载 User 人设');
                });
            }

            /* 挂载表情包 — 多选 */
            var stickerList = panel.querySelector('#crs-sticker-list');
            if (stickerList) {
                stickerList.addEventListener('click', function (e) {
                    var item = e.target.closest('.crs-select-item');
                    if (!item) return;
                    item.classList.toggle('active');

                    /* 收集所有已选 */
                    var selected = [];
                    var all = stickerList.querySelectorAll('.crs-select-item.active');
                    for (var k = 0; k < all.length; k++) {
                        selected.push(all[k].getAttribute('data-sticker-id'));
                    }
                    var cfg = getRoomConfig(charId);
                    cfg.mountedStickers = selected;
                    saveRoomConfig(charId, cfg);
                    toast('表情包已更新');
                });
            }

            /* 挂载世界书 — 多选 */
            var wbList = panel.querySelector('#crs-wb-list');
            if (wbList) {
                wbList.addEventListener('click', function (e) {
                    var item = e.target.closest('.crs-select-item');
                    if (!item) return;
                    item.classList.toggle('active');

                    var selected = [];
                    var all = wbList.querySelectorAll('.crs-select-item.active');
                    for (var k = 0; k < all.length; k++) {
                        selected.push(all[k].getAttribute('data-wb-id'));
                    }
                    var cfg = getRoomConfig(charId);
                    cfg.mountedWorldBooks = selected;
                    saveRoomConfig(charId, cfg);
                    toast('世界书已更新');
                });
            }

            /* MiniMax 语音保存 */
            panel.querySelector('#crs-mm-save').addEventListener('click', function () {
                var cfg = getRoomConfig(charId);
                cfg.minimaxGroupId = panel.querySelector('#crs-mm-group').value.trim();
                cfg.minimaxApiKey = panel.querySelector('#crs-mm-key').value.trim();
                cfg.minimaxVoiceId = panel.querySelector('#crs-mm-voice').value.trim();
                saveRoomConfig(charId, cfg);
                toast('语音配置已保存');
            });

            /* 时间感知开关 */
            panel.querySelector('#crs-time-toggle').addEventListener('change', function () {
                var enabled = this.checked;
                var tzWrap = panel.querySelector('#crs-time-zone-wrap');
                if (enabled) {
                    tzWrap.style.display = '';
                } else {
                    tzWrap.style.display = 'none';
                }
                var cfg = getRoomConfig(charId);
                cfg.timeAware = enabled;
                if (enabled) {
                    cfg.timezone = panel.querySelector('#crs-timezone').value;
                }
                saveRoomConfig(charId, cfg);
            });

            /* 时区选择 */
            panel.querySelector('#crs-timezone').addEventListener('change', function () {
                var cfg = getRoomConfig(charId);
                cfg.timezone = this.value;
                saveRoomConfig(charId, cfg);
                toast('时区已更新');
            });

            /* 壁纸选择 */
            panel.querySelector('#crs-wallpaper-input').addEventListener('change', function () {
                var file = this.files[0];
                if (!file || file.type.indexOf('image/') !== 0) return;
                var blob = file.slice(0, file.size, file.type);
                var url = URL.createObjectURL(file);

                saveBlob(KEY_ROOM_WALLPAPER_PREFIX + charId, blob, function () {
                    var cfg = getRoomConfig(charId);
                    cfg.hasWallpaper = true;
                    saveRoomConfig(charId, cfg);

                    /* 预览 */
                    var wpEl = panel.querySelector('#crs-wallpaper-preview');
                    if (wpEl) wpEl.innerHTML = '<img src="' + url + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">';

                    /* 应用到聊天窗口 */
                    var msgArea = chatSub.querySelector('#cr-messages');
                    if (msgArea) {
                        msgArea.style.backgroundImage = 'url(' + url + ')';
                        msgArea.style.backgroundSize = 'cover';
                        msgArea.style.backgroundPosition = 'center';
                    }
                    toast('壁纸已设置');
                });
                this.value = '';
            });

            /* 清除壁纸 */
            panel.querySelector('#crs-wallpaper-clear').addEventListener('click', function () {
                deleteBlob(KEY_ROOM_WALLPAPER_PREFIX + charId, function () {
                    var cfg = getRoomConfig(charId);
                    cfg.hasWallpaper = false;
                    saveRoomConfig(charId, cfg);

                    var wpEl = panel.querySelector('#crs-wallpaper-preview');
                    if (wpEl) wpEl.innerHTML = '<span class="crs-wp-empty">未设置</span>';

                    var msgArea = chatSub.querySelector('#cr-messages');
                    if (msgArea) {
                        msgArea.style.backgroundImage = '';
                    }
                    toast('壁纸已清除');
                });
            });

            /* 翻译开关 */
            panel.querySelector('#crs-translate-toggle').addEventListener('change', function () {
                var cfg = getRoomConfig(charId);
                cfg.translateEnabled = this.checked;
                saveRoomConfig(charId, cfg);
            });

            /* 后台模式 */
            panel.querySelector('#crs-bg-toggle').addEventListener('change', function () {
                var cfg = getRoomConfig(charId);
                cfg.backgroundMode = this.checked;
                saveRoomConfig(charId, cfg);
            });

            /* 主动发动态 */
            panel.querySelector('#crs-moment-toggle').addEventListener('change', function () {
                var cfg = getRoomConfig(charId);
                cfg.autoMoment = this.checked;
                saveRoomConfig(charId, cfg);
            });

            /* 允许主动发消息 */
            panel.querySelector('#crs-proactive-toggle').addEventListener('change', function () {
                var cfg = getRoomConfig(charId);
                cfg.proactiveMsg = this.checked;
                saveRoomConfig(charId, cfg);
                if (this.checked) {
                    toast('已开启主动发消息，超过1小时未回复后角色将主动联系你');
                    /* 确保引擎在运行 */
                    if (window.ChatApp && window.ChatApp.startProactiveEngine) {
                        window.ChatApp.startProactiveEngine();
                    }
                } else {
                    toast('已关闭主动发消息');
                }
            });

            /* 记忆总结 — 保存 */
            panel.querySelector('#crs-memory-save').addEventListener('click', function () {
                var cfg = getRoomConfig(charId);
                cfg.memorySummary = panel.querySelector('#crs-memory').value.trim();
                saveRoomConfig(charId, cfg);
                toast('记忆已保存');
            });

            /* 记忆总结 — 自动总结 */
            panel.querySelector('#crs-memory-auto').addEventListener('click', function () {
                var dd2 = loadData();
                var history = (dd2.chatHistory && dd2.chatHistory[charId]) || [];
                if (history.length < 5) {
                    toast('聊天记录太少，无法总结');
                    return;
                }

                /* 调用 LLM 进行总结 */
                if (!window.ChatApp || !window.ChatApp.callLLM) {
                    toast('LLM 未配置');
                    return;
                }

                var summaryMsgs = [
                    {
                        role: 'system',
                        content: '你是一个记忆总结助手。请将以下聊天记录总结为简洁的记忆摘要，包括：关键事件、关系变化、重要信息、情感状态等。用中文回复，格式为简洁的要点列表。不要超过300字。'
                    },
                    {
                        role: 'user',
                        content: '以下是聊天记录，请总结：\n\n' + history.slice(-60).map(function (m) {
                            return (m.role === 'user' ? '用户' : '角色') + '：' + m.text;
                        }).join('\n')
                    }
                ];

                toast('正在自动总结...');
                window.ChatApp.callLLM(summaryMsgs, function (err, reply) {
                    if (err) {
                        toast('总结失败: ' + err.message);
                        return;
                    }
                    var memoryEl = panel.querySelector('#crs-memory');
                    if (memoryEl) {
                        memoryEl.value = reply.trim();
                        /* 自动撑高：根据内容行数动态调整 */
                        memoryEl.style.height = 'auto';
                        memoryEl.style.height = Math.min(memoryEl.scrollHeight, 400) + 'px';
                    }

                    var cfg = getRoomConfig(charId);
                    cfg.memorySummary = reply.trim();
                    saveRoomConfig(charId, cfg);
                    toast('自动总结完成');
                });
            });

            /* 清理聊天记录 */
            panel.querySelector('#crs-clear-history').addEventListener('click', function () {
                if (!confirm('确认清理与该角色的所有聊天记录？此操作不可恢复。')) return;
                var dd3 = loadData();
                /* 清除聊天历史 */
                if (dd3.chatHistory && dd3.chatHistory[charId]) {
                    dd3.chatHistory[charId] = [];
                }
                /* 清除对应记忆总结 */
                if (dd3.roomConfig && dd3.roomConfig[charId]) {
                    dd3.roomConfig[charId].memorySummary = '';
                }
                saveData(dd3);
                /* 重置内存中的自动总结防重标记 */
                if (window.ChatApp && window.ChatApp._autoSummaryPending) {
                    window.ChatApp._autoSummaryPending[charId] = false;
                }
                /* 刷新聊天窗口 */
                var msgArea = chatSub.querySelector('#cr-messages');
                if (msgArea) msgArea.innerHTML = '';
                /* 如果设置面板中有记忆文本框，同步清空 */
                var memEl = document.querySelector('#crs-memory');
                if (memEl) {
                    memEl.value = '';
                    memEl.style.height = 'auto';
                }
                toast('聊天记录及记忆已清理');
            });

            /* 删除好友 */
            panel.querySelector('#crs-delete-friend').addEventListener('click', function () {
                if (!confirm('确认删除该好友？角色数据和聊天记录都将被清除，此操作不可恢复！')) return;
                if (!confirm('再次确认：真的要删除吗？')) return;

                var dd4 = loadData();

                /* 删除角色 */
                var newChars = [];
                for (var i = 0; i < (dd4.characters || []).length; i++) {
                    if (dd4.characters[i].id !== charId) newChars.push(dd4.characters[i]);
                }
                dd4.characters = newChars;

                /* 清除聊天记录 */
                if (dd4.chatHistory) delete dd4.chatHistory[charId];

                /* 清除房间配置 */
                if (dd4.roomConfig) delete dd4.roomConfig[charId];

                /* 清除 activeCharId（如果是该角色） */
                if (dd4.activeCharId === charId) dd4.activeCharId = '';

                saveData(dd4);

                /* 删除头像 blob */
                deleteBlob(KEY_CHAR_AVATAR_PREFIX + charId, function () { });
                deleteBlob(KEY_ROOM_WALLPAPER_PREFIX + charId, function () { });

                toast('好友已删除');

                /* 关闭设置面板 + 聊天窗口 */
                self.close(panel);
                setTimeout(function () {
                    /* 关闭聊天子页面 */
                    chatSub.classList.remove('open');
                    setTimeout(function () {
                        chatSub.remove();
                        /* 刷新消息页 */
                        if (window.ChatApp) window.ChatApp.switchTab('msg');
                    }, 350);
                }, 200);
            });
        },

        close: function (panel) {
            if (!panel) return;
            panel.classList.remove('open');
            setTimeout(function () { panel.remove(); }, 350);
        }
    };

    window.ChatRoomSettings = ChatRoomSettings;
})();
