(function () {
    'use strict';

    var DB_NAME = 'lingji_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'images';
    var KEY_BG = '_chat_profile_bg';
    var KEY_AVATAR = '_chat_profile_avatar';
    var KEY_CHAR_AVATAR_PREFIX = '_chat_char_avatar_';
    var KEY_POLAROID_PREFIX = '_chat_polaroid_';
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
            var req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = function () { cb(null, req.result || null); };
        });
    }

    /* ====== 本地存储辅助 ====== */
    function loadData() {
        try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
    }
    function saveData(d) {
        localStorage.setItem(LS_KEY, JSON.stringify(d));
    }
    function escHtml(s) {
        var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
    }

    /* ====== 菜单板块配置 ====== */
    var MENU_ITEMS = [
        { id: 'wallet', icon: '<path d="M21 4H3a1 1 0 00-1 1v14a1 1 0 001 1h18a1 1 0 001-1V5a1 1 0 00-1-1z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 14a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M2 9h20" stroke="currentColor" stroke-width="1.5"/>', name: '钱包', desc: '账户余额与交易记录' },
        { id: 'fav', icon: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>', name: '收藏', desc: '收藏的内容与话题' },
        { id: 'beautify', icon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', name: '聊天美化', desc: '气泡样式与主题' },
        { id: 'sticker', icon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 12s1 3 4 3 4-3 4-3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/>', name: '表情包', desc: '表情管理与导入' },
        { id: 'shop', icon: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.5"/><path d="M16 10a4 4 0 01-8 0" stroke="currentColor" stroke-width="1.5" fill="none"/>', name: '购物商城', desc: '虚拟商品与礼物' }
    ];

    /* ====== ChatApp 主模块 ====== */
    var ChatApp = {
        el: null,
        _blobUrls: {},
        _currentTab: 'me',

        open: function () {
            if (!this.el) this.build();
            this.el.classList.add('open');
            this.switchTab('me');
        },

        close: function () {
            if (this.el) this.el.classList.remove('open');
        },

        build: function () {
            var container = document.getElementById('phone-container');
            if (!container) return;

            var page = document.createElement('div');
            page.id = 'chat-page';
            page.className = 'chat-page';

            page.innerHTML =
                '<div class="chat-header">' +
                '<button class="chat-back" id="chat-close">' +
                '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<span class="chat-title">Chat</span>' +
                '</div>' +
                '<div class="chat-body" id="chat-body"></div>' +
                '<div class="chat-tabbar" id="chat-tabbar">' +
                '<div class="chat-tab active" data-tab="msg">' +
                '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>' +
                '<span>消息</span>' +
                '</div>' +
                '<div class="chat-tab" data-tab="contacts">' +
                '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>' +
                '<span>联系人</span>' +
                '</div>' +
                '<div class="chat-tab" data-tab="feed">' +
                '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="21" x2="9" y2="9" stroke="currentColor" stroke-width="1.5"/></svg>' +
                '<span>动态</span>' +
                '</div>' +
                '<div class="chat-tab" data-tab="me">' +
                '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>' +
                '<span>我</span>' +
                '</div>' +
                '</div>' +
                '<div class="chat-toast" id="chat-toast"></div>';

            container.appendChild(page);
            this.el = page;
            this.bindEvents();
        },

        bindEvents: function () {
            var self = this;

            /* 关闭 */
            this.el.querySelector('#chat-close').addEventListener('click', function () {
                /* 如果有子页面打开就关闭子页面 */
                var sub = self.el.querySelector('.chat-sub-page.open');
                if (sub) { sub.classList.remove('open'); setTimeout(function () { sub.remove(); }, 350); return; }
                self.close();
            });

            /* Tab 切换 */
            var tabs = this.el.querySelectorAll('.chat-tab');
            for (var i = 0; i < tabs.length; i++) {
                (function (tab) {
                    tab.addEventListener('click', function () {
                        var id = tab.getAttribute('data-tab');
                        self.switchTab(id);
                        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
                        tab.classList.add('active');
                    });
                })(tabs[i]);
            }
        },

        switchTab: function (id) {
            this._currentTab = id;
            var body = this.el.querySelector('#chat-body');
            switch (id) {
                case 'msg': body.innerHTML = this.buildMsgTab(); this.initMsgTab(); break;
                case 'contacts': body.innerHTML = this.buildContactsTab(); this.initContactsTab(); break;
                case 'feed': body.innerHTML = this.buildFeedTab(); break;
                case 'me': body.innerHTML = this.buildMeTab(); this.initMeTab(); break;
            }
        },

        buildMsgTab: function () {
            var data = loadData();
            var allChars = data.characters || [];
            /* 只显示 char 类型（消息页创建/导入的角色） */
            var chars = [];
            for (var ci = 0; ci < allChars.length; ci++) {
                if (allChars[ci].type === 'char') chars.push(allChars[ci]);
            }
            var html = '<div class="chat-msg-header">' +
                '<span class="chat-msg-header-title">消息</span>' +
                '<button class="chat-msg-add-btn" id="chat-msg-add">' +
                '<svg viewBox="0 0 24 24" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
                '</button>' +
                '</div>';

            if (chars.length === 0) {
                html += '<div class="chat-empty-state">' +
                    '<svg viewBox="0 0 24 24" width="40" height="40" stroke="#ccc" stroke-width="1" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
                    '<p>暂无消息</p></div>';
            } else {
                html += '<div class="chat-msg-list" id="chat-msg-list">';
                for (var i = 0; i < chars.length; i++) {
                    var c = chars[i];
                    var displayName = c.name + (c.nickname ? ' (' + c.nickname + ')' : '');
                    var timeStr = '';
                    if (c.createdAt) {
                        var d = new Date(c.createdAt);
                        var now = new Date();
                        if (d.toDateString() === now.toDateString()) {
                            timeStr = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
                        } else {
                            timeStr = (d.getMonth() + 1) + '/' + d.getDate();
                        }
                    }
                    html += '<div class="chat-msg-item" data-char-id="' + c.id + '">' +
                        '<div class="chat-msg-item-avatar" id="msg-av-' + c.id + '">' +
                        '<svg viewBox="0 0 24 24" width="24" height="24" stroke="#bbb" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                        '</div>' +
                        '<div class="chat-msg-item-body">' +
                        '<div class="chat-msg-item-top">' +
                        '<span class="chat-msg-item-name">' + escHtml(displayName) + '</span>' +
                        '<span class="chat-msg-item-time">' + timeStr + '</span>' +
                        '</div>' +
                        '<div class="chat-msg-item-preview">' + escHtml(this.getLastMessage(c.id) || (c.gender || '') + (c.group ? ' · ' + c.group : '')) + '</div>' +
                        '</div>' +
                        '</div>';
                }
                html += '</div>';
            }
            return html;
        },




        initMsgTab: function () {
            var self = this;
            var body = this.el.querySelector('#chat-body');
            var addBtn = body.querySelector('#chat-msg-add');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    self.openCreateMenu();
                });
            }

            /* 点击对话条进入对话页面 */
            var msgList = body.querySelector('#chat-msg-list');
            if (msgList) {
                msgList.addEventListener('click', function (e) {
                    var item = e.target.closest('.chat-msg-item');
                    if (!item) return;
                    var charId = item.getAttribute('data-char-id');
                    if (charId) self.openChatRoom(charId);
                });
            }

            /* 加载消息列表角色头像（只加载 char 类型） */
            var data = loadData();
            var allChars = data.characters || [];
            for (var i = 0; i < allChars.length; i++) {
                if (allChars[i].type !== 'char') continue;
                (function (cid) {
                    loadBlob(KEY_CHAR_AVATAR_PREFIX + cid, function (err, blob) {
                        if (!blob) return;
                        var url = URL.createObjectURL(blob);
                        var el = body.querySelector('#msg-av-' + cid);
                        if (el) el.innerHTML = '<img src="' + url + '" alt="">';
                    });
                })(allChars[i].id);
            }
        },

        /* ====== 新建菜单浮层 ====== */
        openCreateMenu: function () {
            var self = this;
            var overlay = document.createElement('div');
            overlay.className = 'chat-create-overlay';

            overlay.innerHTML =
                '<div class="chat-create-panel">' +
                '<div class="chat-create-panel-title">新建</div>' +

                '<div class="chat-create-item" data-action="create-char">' +
                '<div class="chat-create-item-icon ci-char">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/></svg>' +
                '</div>' +
                '<div class="chat-create-item-text">' +
                '<div class="chat-create-item-name">创建角色</div>' +
                '<div class="chat-create-item-desc">自定义角色人设与设定</div>' +
                '</div>' +
                '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</div>' +

                '<div class="chat-create-item" data-action="create-group">' +
                '<div class="chat-create-item-icon ci-group">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>' +
                '</div>' +
                '<div class="chat-create-item-text">' +
                '<div class="chat-create-item-name">创建群聊</div>' +
                '<div class="chat-create-item-desc">多角色互动对话</div>' +
                '</div>' +
                '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</div>' +

                '<div class="chat-create-item" data-action="import-char">' +
                '<div class="chat-create-item-icon ci-import">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
                '</div>' +
                '<div class="chat-create-item-text">' +
                '<div class="chat-create-item-name">导入角色卡</div>' +
                '<div class="chat-create-item-desc">支持 JSON / PNG 角色卡文件</div>' +
                '</div>' +
                '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</div>' +

                '</div>';

            self.el.appendChild(overlay);
            requestAnimationFrame(function () { overlay.classList.add('open'); });

            /* 点背景关闭 */
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    overlay.classList.remove('open');
                    setTimeout(function () { overlay.remove(); }, 250);
                }
            });

            /* 按钮事件 */
            overlay.addEventListener('click', function (e) {
                var item = e.target.closest('.chat-create-item');
                if (!item) return;
                var action = item.getAttribute('data-action');
                overlay.classList.remove('open');
                setTimeout(function () { overlay.remove(); }, 250);

                switch (action) {
                    case 'create-char':
                        self.openMsgCreateCharPage();
                        break;
                    case 'create-group':
                        self.toast('群聊功能开发中');
                        break;
                    case 'import-char':
                        self.openImportCharPage();
                        break;
                }
            });
        },

        /* ====== 从消息页创建角色（INS风） ====== */
        openMsgCreateCharPage: function (prefill) {
            var self = this;
            var sub = document.createElement('div');
            sub.className = 'chat-sub-page';
            var _charAvatarFile = null;

            var data = loadData();
            var groups = data.charGroups || ['默认'];

            var pf = prefill || {};

            var html = '<div class="chat-sub-header">' +
                '<button class="chat-back chat-sub-back">' +
                '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<span class="chat-title">创建角色</span>' +
                '</div>' +
                '<div class="chat-sub-body">' +

                /* 头像 */
                '<div class="chat-cform-avatar-section">' +
                '<div class="chat-cform-avatar" id="mc-avatar-preview">' +
                (pf.avatarUrl
                    ? '<img src="' + pf.avatarUrl + '" alt="">'
                    : '<svg viewBox="0 0 24 24" width="36" height="36" stroke="#ccc" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>') +
                '<input type="file" accept="image/*" class="chat-file-input" id="mc-avatar-input" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:3;">' +
                '</div>' +
                '<div class="chat-cform-avatar-hint">点击更换头像</div>' +
                '</div>' +

                /* 基本信息 */
                '<div class="chat-cform-section">' +
                '<div class="chat-cform-section-title">基本信息</div>' +
                '<div class="chat-cform-card">' +
                '<div class="chat-cform-row">' +
                '<span class="chat-cform-row-label">姓名</span>' +
                '<input class="chat-cform-row-input" id="mc-name" placeholder="角色名称" maxlength="20" value="' + escHtml(pf.name || '') + '">' +
                '</div>' +
                '<div class="chat-cform-row">' +
                '<span class="chat-cform-row-label">昵称</span>' +
                '<input class="chat-cform-row-input" id="mc-nickname" placeholder="选填" maxlength="20" value="' + escHtml(pf.nickname || '') + '">' +
                '</div>' +
                '</div>' +
                '</div>' +

                /* 性别 */
                '<div class="chat-cform-section">' +
                '<div class="chat-cform-section-title">性别</div>' +
                '<div class="chat-cform-gender-wrap" id="mc-gender-group">' +
                '<div class="chat-cform-gender-opt' + ((pf.gender || '男') === '男' ? ' active' : '') + '" data-gender="男">男</div>' +
                '<div class="chat-cform-gender-opt' + (pf.gender === '女' ? ' active' : '') + '" data-gender="女">女</div>' +
                '<div class="chat-cform-gender-opt' + (pf.gender === '其他' ? ' active' : '') + '" data-gender="其他">其他</div>' +
                '</div>' +
                '</div>' +

                /* 详细信息 */
                '<div class="chat-cform-section">' +
                '<div class="chat-cform-section-title">详细人设</div>' +
                '<textarea class="chat-cform-textarea" id="mc-detail" placeholder="描述角色的性格、背景故事、说话方式、喜好..." rows="5">' + escHtml(pf.detail || '') + '</textarea>' +
                '</div>' +

                /* 分组 */
                '<div class="chat-cform-section">' +
                '<div class="chat-cform-section-title">分组</div>' +
                '<div class="chat-cform-group-wrap" id="mc-group-wrap">';

            for (var gi = 0; gi < groups.length; gi++) {
                html += '<div class="chat-cform-group-tag' + (pf.group === groups[gi] ? ' active' : '') + '" data-group="' + escHtml(groups[gi]) + '">' + escHtml(groups[gi]) + '</div>';
            }
            html += '<div class="chat-cform-group-add" id="mc-group-add">+ 自定义</div>';

            html += '</div>' +
                '</div>' +

                /* 保存 */
                '<button class="chat-cform-save" id="mc-save-btn">保存角色</button>' +

                '</div>';

            sub.innerHTML = html;
            self.el.appendChild(sub);
            requestAnimationFrame(function () { sub.classList.add('open'); });

            /* 如果有预填头像 blob */
            if (pf.avatarBlob) {
                _charAvatarFile = pf.avatarBlob;
            }

            /* 头像选择 */
            var avInput = sub.querySelector('#mc-avatar-input');
            var avPreview = sub.querySelector('#mc-avatar-preview');
            if (avInput) {
                avInput.addEventListener('change', function () {
                    var file = avInput.files[0];
                    if (!file || file.type.indexOf('image/') !== 0) return;
                    _charAvatarFile = file;
                    var url = URL.createObjectURL(file);
                    avPreview.innerHTML = '<img src="' + url + '" alt="">';
                    avInput.value = '';
                });
            }

            /* 性别选择 */
            var genderOpts = sub.querySelectorAll('[data-gender]');
            for (var i = 0; i < genderOpts.length; i++) {
                (function (opt) {
                    opt.addEventListener('click', function () {
                        for (var j = 0; j < genderOpts.length; j++) genderOpts[j].classList.remove('active');
                        opt.classList.add('active');
                    });
                })(genderOpts[i]);
            }

            /* 分组选择 */
            var groupWrap = sub.querySelector('#mc-group-wrap');
            groupWrap.addEventListener('click', function (e) {
                var tag = e.target.closest('.chat-cform-group-tag');
                if (tag) {
                    var tags = groupWrap.querySelectorAll('.chat-cform-group-tag');
                    for (var t = 0; t < tags.length; t++) tags[t].classList.remove('active');
                    tag.classList.add('active');
                    return;
                }
                if (e.target.closest('#mc-group-add')) {
                    var val = prompt('输入分组名称');
                    if (val && val.trim()) {
                        val = val.trim();
                        var d = loadData();
                        if (!d.charGroups) d.charGroups = ['默认'];
                        if (d.charGroups.indexOf(val) === -1) {
                            d.charGroups.push(val);
                            saveData(d);
                        }
                        var newTag = document.createElement('div');
                        newTag.className = 'chat-cform-group-tag active';
                        newTag.setAttribute('data-group', val);
                        newTag.textContent = val;
                        var addEl = groupWrap.querySelector('#mc-group-add');
                        groupWrap.insertBefore(newTag, addEl);
                        var existingTags = groupWrap.querySelectorAll('.chat-cform-group-tag');
                        for (var et = 0; et < existingTags.length; et++) {
                            if (existingTags[et] !== newTag) existingTags[et].classList.remove('active');
                        }
                    }
                }
            });

            /* 返回 */
            sub.querySelector('.chat-sub-back').addEventListener('click', function () {
                sub.classList.remove('open');
                setTimeout(function () { sub.remove(); }, 350);
            });

            /* 保存 */
            sub.querySelector('#mc-save-btn').addEventListener('click', function () {
                var name = sub.querySelector('#mc-name').value.trim();
                if (!name) { self.toast('请输入角色名称'); return; }

                var nickname = sub.querySelector('#mc-nickname').value.trim();
                var genderEl = sub.querySelector('[data-gender].active');
                var gender = genderEl ? genderEl.getAttribute('data-gender') : '其他';
                var detail = sub.querySelector('#mc-detail').value.trim();
                var groupEl = sub.querySelector('.chat-cform-group-tag.active');
                var group = groupEl ? groupEl.getAttribute('data-group') : '';

                /* 如果没选分组，自动归入默认 */
                var d = loadData();
                if (!d.charGroups) d.charGroups = ['默认'];
                if (!group) group = d.charGroups[0] || '默认';

                var character = {
                    id: 'char_' + Date.now(),
                    type: 'char',
                    name: name,
                    nickname: nickname,
                    gender: gender,
                    detail: detail,
                    group: group,
                    createdAt: new Date().toISOString()
                };

                if (!d.characters) d.characters = [];
                d.characters.push(character);
                var isFirst = !d.activeCharId;
                if (isFirst) d.activeCharId = character.id;
                saveData(d);

                /* 保存角色头像 */
                if (_charAvatarFile) {
                    var blob;
                    if (_charAvatarFile instanceof Blob) {
                        blob = _charAvatarFile;
                    } else {
                        blob = _charAvatarFile.slice(0, _charAvatarFile.size, _charAvatarFile.type);
                    }
                    saveBlob(KEY_CHAR_AVATAR_PREFIX + character.id, blob, function () {
                        if (isFirst) self.syncCharAvatarToProfile(character.id);
                    });
                }

                self.toast('角色已创建');
                sub.classList.remove('open');
                setTimeout(function () {
                    sub.remove();
                    /* 刷新消息页和联系人页 */
                    if (self._currentTab === 'msg') self.switchTab('msg');
                }, 350);
            });
        },

        /* ====== 导入角色卡 ====== */
        openImportCharPage: function () {
            var self = this;
            var sub = document.createElement('div');
            sub.className = 'chat-sub-page';

            var html = '<div class="chat-sub-header">' +
                '<button class="chat-back chat-sub-back">' +
                '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<span class="chat-title">导入角色卡</span>' +
                '</div>' +
                '<div class="chat-sub-body">' +

                '<div class="chat-import-zone" id="import-zone">' +
                '<div class="chat-import-zone-icon">' +
                '<svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
                '</div>' +
                '<div class="chat-import-zone-text">点击选择文件</div>' +
                '<div class="chat-import-zone-hint">支持 .json 或 .png 角色卡文件</div>' +
                '<input type="file" accept=".json,.png,application/json,image/png" class="chat-file-input" id="import-file-input">' +
                '</div>' +

                '<div class="chat-import-preview" id="import-preview">' +
                '<div class="chat-import-preview-title">解析结果</div>' +
                '<div id="import-preview-content"></div>' +
                '</div>' +

                '<button class="chat-cform-save" id="import-confirm-btn" style="display:none;">编辑并保存角色</button>' +

                '</div>';

            sub.innerHTML = html;
            self.el.appendChild(sub);
            requestAnimationFrame(function () { sub.classList.add('open'); });

            var _parsedData = null;
            var _parsedAvatarBlob = null;

            /* 返回 */
            sub.querySelector('.chat-sub-back').addEventListener('click', function () {
                sub.classList.remove('open');
                setTimeout(function () { sub.remove(); }, 350);
            });

            /* 文件选择 */
            var fileInput = sub.querySelector('#import-file-input');
            fileInput.addEventListener('change', function () {
                var file = fileInput.files[0];
                if (!file) return;

                var ext = file.name.toLowerCase().split('.').pop();
                if (ext === 'json') {
                    self.parseJsonCharCard(file, function (result) {
                        if (!result) { self.toast('无法解析此JSON文件'); return; }
                        _parsedData = result;
                        _parsedAvatarBlob = result.avatarBlob || null;
                        showPreview(result);
                    });
                } else if (ext === 'png') {
                    self.parsePngCharCard(file, function (result) {
                        if (!result) { self.toast('无法解析此PNG角色卡'); return; }
                        _parsedData = result;
                        _parsedAvatarBlob = file;
                        showPreview(result);
                    });
                } else {
                    self.toast('不支持的文件格式');
                }
                fileInput.value = '';
            });

            function showPreview(result) {
                var previewEl = sub.querySelector('#import-preview');
                var contentEl = sub.querySelector('#import-preview-content');
                var confirmBtn = sub.querySelector('#import-confirm-btn');

                var rows = '';
                if (result.name) rows += '<div class="chat-import-preview-row"><span class="chat-import-preview-label">名称</span><span class="chat-import-preview-val">' + escHtml(result.name) + '</span></div>';
                if (result.nickname) rows += '<div class="chat-import-preview-row"><span class="chat-import-preview-label">昵称</span><span class="chat-import-preview-val">' + escHtml(result.nickname) + '</span></div>';
                if (result.gender) rows += '<div class="chat-import-preview-row"><span class="chat-import-preview-label">性别</span><span class="chat-import-preview-val">' + escHtml(result.gender) + '</span></div>';
                if (result.detail) rows += '<div class="chat-import-preview-row"><span class="chat-import-preview-label">人设</span><span class="chat-import-preview-val">' + escHtml(result.detail.substring(0, 200)) + (result.detail.length > 200 ? '...' : '') + '</span></div>';

                contentEl.innerHTML = rows || '<p style="color:#ccc;font-size:13px;">未能提取到有效信息</p>';
                previewEl.classList.add('show');
                confirmBtn.style.display = 'block';
            }

            /* 确认按钮 → 跳到编辑页 */
            sub.querySelector('#import-confirm-btn').addEventListener('click', function () {
                if (!_parsedData) return;
                sub.classList.remove('open');
                setTimeout(function () {
                    sub.remove();
                    var pf = {
                        name: _parsedData.name || '',
                        nickname: _parsedData.nickname || '',
                        gender: _parsedData.gender || '其他',
                        detail: _parsedData.detail || ''
                    };
                    if (_parsedAvatarBlob) {
                        pf.avatarBlob = _parsedAvatarBlob;
                        pf.avatarUrl = URL.createObjectURL(_parsedAvatarBlob);
                    }
                    self.openMsgCreateCharPage(pf);
                }, 350);
            });
        },

        /* ====== JSON 角色卡解析 ====== */
        parseJsonCharCard: function (file, cb) {
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var json = JSON.parse(reader.result);
                    /* 支持多种常见角色卡格式 */
                    var result = {};

                    /* TavernAI / SillyTavern 格式 */
                    var d = json.data || json;
                    result.name = d.name || d.char_name || json.name || '';
                    result.nickname = d.nickname || d.alternate_greetings ? '' : '';
                    result.detail = d.description || d.personality || d.char_persona || '';
                    if (d.scenario) result.detail += '\n\n' + d.scenario;
                    if (d.mes_example) result.detail += '\n\n对话示例:\n' + d.mes_example;

                    /* 猜性别 */
                    var detailLower = (result.detail || '').toLowerCase();
                    if (detailLower.indexOf('female') !== -1 || detailLower.indexOf('女') !== -1 || detailLower.indexOf('she/her') !== -1) {
                        result.gender = '女';
                    } else if (detailLower.indexOf('male') !== -1 || detailLower.indexOf('男') !== -1 || detailLower.indexOf('he/him') !== -1) {
                        result.gender = '男';
                    } else {
                        result.gender = '其他';
                    }

                    /* 头像（base64） */
                    var avatarB64 = d.avatar || json.avatar || '';
                    if (avatarB64 && avatarB64.indexOf('data:') === 0) {
                        var parts = avatarB64.split(',');
                        var mime = parts[0].match(/:(.*?);/);
                        var bstr = atob(parts[1]);
                        var n = bstr.length;
                        var u8arr = new Uint8Array(n);
                        for (var i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
                        result.avatarBlob = new Blob([u8arr], { type: mime ? mime[1] : 'image/png' });
                    }

                    cb(result.name ? result : null);
                } catch (e) {
                    cb(null);
                }
            };
            reader.onerror = function () { cb(null); };
            reader.readAsText(file);
        },

        /* ====== PNG 角色卡解析（读取 tEXt chunk） ====== */
        parsePngCharCard: function (file, cb) {
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var buf = new Uint8Array(reader.result);
                    /* PNG签名检查 */
                    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) {
                        cb(null); return;
                    }

                    var offset = 8;
                    var charData = null;

                    while (offset < buf.length) {
                        var len = (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
                        var type = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);

                        if (type === 'tEXt' || type === 'iTXt') {
                            var dataStart = offset + 8;
                            var dataEnd = dataStart + len;
                            var chunkBytes = buf.slice(dataStart, dataEnd);
                            var chunkStr = '';
                            for (var ci = 0; ci < chunkBytes.length; ci++) chunkStr += String.fromCharCode(chunkBytes[ci]);

                            var nullIdx = chunkStr.indexOf('\0');
                            var keyword = nullIdx !== -1 ? chunkStr.substring(0, nullIdx) : '';
                            var value = nullIdx !== -1 ? chunkStr.substring(nullIdx + 1) : chunkStr;

                            /* iTXt has extra bytes after null */
                            if (type === 'iTXt' && nullIdx !== -1) {
                                var afterNull = chunkStr.substring(nullIdx + 1);
                                /* skip compression flag, compression method, language, translated keyword */
                                var nnIdx = 0;
                                var nullCount = 0;
                                for (var ni = 0; ni < afterNull.length && nullCount < 3; ni++) {
                                    if (afterNull[ni] === '\0') nullCount++;
                                    nnIdx = ni + 1;
                                }
                                value = afterNull.substring(nnIdx);
                            }

                            if (keyword === 'chara' || keyword === 'ccv3') {
                                try {
                                    var decoded = atob(value);
                                    charData = JSON.parse(decoded);
                                } catch (e2) {
                                    try { charData = JSON.parse(value); } catch (e3) { }
                                }
                            }
                        }

                        if (type === 'IEND') break;
                        offset += 12 + len;
                    }

                    if (!charData) { cb(null); return; }

                    var d = charData.data || charData;
                    var result = {};
                    result.name = d.name || d.char_name || '';
                    result.detail = d.description || d.personality || d.char_persona || '';
                    if (d.scenario) result.detail += '\n\n' + d.scenario;
                    if (d.mes_example) result.detail += '\n\n对话示例:\n' + d.mes_example;
                    result.nickname = '';

                    var dLower = (result.detail || '').toLowerCase();
                    if (dLower.indexOf('female') !== -1 || dLower.indexOf('女') !== -1) {
                        result.gender = '女';
                    } else if (dLower.indexOf('male') !== -1 || dLower.indexOf('男') !== -1) {
                        result.gender = '男';
                    } else {
                        result.gender = '其他';
                    }

                    cb(result.name ? result : null);
                } catch (e) {
                    cb(null);
                }
            };
            reader.onerror = function () { cb(null); };
            reader.readAsArrayBuffer(file);
        },

        buildContactsTab: function () {
            var data = loadData();
            var groups = data.charGroups || ['默认'];
            var allChars = data.characters || [];
            /* 联系人只显示 char 类型 */
            var chars = [];
            for (var fi = 0; fi < allChars.length; fi++) {
                if (allChars[fi].type === 'char') chars.push(allChars[fi]);
            }
            var activeGroup = this._contactsActiveGroup || groups[0] || '默认';

            var html = '<div class="chat-contacts-header">' +
                '<span class="chat-contacts-header-title">联系人</span>' +
                '<div class="chat-contacts-actions">' +
                '<button class="chat-contacts-action-btn" id="contacts-manage-groups" title="管理分组">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.8" fill="none"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>' +
                '</button>' +
                '</div>' +
                '</div>';

            /* 分组标签栏 */
            html += '<div class="chat-contacts-tabs" id="contacts-tabs">';
            html += '<div class="chat-contacts-tab' + (activeGroup === '__all__' ? ' active' : '') + '" data-group="__all__">全部</div>';
            for (var g = 0; g < groups.length; g++) {
                html += '<div class="chat-contacts-tab' + (activeGroup === groups[g] ? ' active' : '') + '" data-group="' + escHtml(groups[g]) + '">' + escHtml(groups[g]) + '</div>';
            }
            html += '</div>';

            /* 筛选角色 */
            var filtered = [];
            for (var i = 0; i < chars.length; i++) {
                if (activeGroup === '__all__' || (chars[i].group || '默认') === activeGroup) {
                    filtered.push(chars[i]);
                }
            }

            if (filtered.length === 0) {
                html += '<div class="chat-contacts-empty">该分组暂无角色</div>';
            } else {
                html += '<div class="chat-contacts-list" id="contacts-list">';
                for (var j = 0; j < filtered.length; j++) {
                    var c = filtered[j];
                    html += '<div class="chat-contacts-item" data-char-id="' + c.id + '">' +
                        '<div class="chat-contacts-item-avatar" id="contact-av-' + c.id + '">' +
                        '<svg viewBox="0 0 24 24" width="22" height="22" stroke="#bbb" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                        '</div>' +
                        '<div class="chat-contacts-item-info">' +
                        '<div class="chat-contacts-item-name">' + escHtml(c.name) +
                        (c.nickname ? '<span class="chat-contacts-item-nick">' + escHtml(c.nickname) + '</span>' : '') +
                        '</div>' +
                        '<div class="chat-contacts-item-sub">' + escHtml(c.gender || '') + ' · ' + escHtml(c.group || '默认') + '</div>' +
                        '</div>' +
                        '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '</div>';
                }
                html += '</div>';
            }
            return html;
        },

        _contactsActiveGroup: null,

        initContactsTab: function () {
            var self = this;
            var body = this.el.querySelector('#chat-body');

            /* 加载联系人头像（只加载 char 类型） */
            var data = loadData();
            var allChars = data.characters || [];
            for (var i = 0; i < allChars.length; i++) {
                if (allChars[i].type !== 'char') continue;
                (function (cid) {
                    loadBlob(KEY_CHAR_AVATAR_PREFIX + cid, function (err, blob) {
                        if (!blob) return;
                        var url = URL.createObjectURL(blob);
                        var el = body.querySelector('#contact-av-' + cid);
                        if (el) el.innerHTML = '<img src="' + url + '" alt="">';
                    });
                })(allChars[i].id);
            }

            /* 分组标签切换 */
            var tabsWrap = body.querySelector('#contacts-tabs');
            if (tabsWrap) {
                tabsWrap.addEventListener('click', function (e) {
                    var tab = e.target.closest('.chat-contacts-tab');
                    if (!tab) return;
                    self._contactsActiveGroup = tab.getAttribute('data-group');
                    body.innerHTML = self.buildContactsTab();
                    self.initContactsTab();
                });
            }

            /* 管理分组按钮 */
            var manageBtn = body.querySelector('#contacts-manage-groups');
            if (manageBtn) {
                manageBtn.addEventListener('click', function () {
                    self.openGroupManage();
                });
            }
        },

        openGroupManage: function () {
            var self = this;
            var data = loadData();
            var groups = data.charGroups || ['默认'];
            var chars = data.characters || [];

            var overlay = document.createElement('div');
            overlay.className = 'chat-group-manage-overlay';

            function countGroup(g) {
                var n = 0;
                for (var i = 0; i < chars.length; i++) {
                    if ((chars[i].group || '默认') === g) n++;
                }
                return n;
            }

            function renderList() {
                var d = loadData();
                var gs = d.charGroups || ['默认'];
                var cs = d.characters || [];
                var listHtml = '';
                for (var i = 0; i < gs.length; i++) {
                    var cnt = 0;
                    for (var j = 0; j < cs.length; j++) {
                        if (cs[j].type === 'char' && (cs[j].group || '默认') === gs[i]) cnt++;
                    }
                    listHtml += '<div class="chat-group-manage-item">' +
                        '<div>' +
                        '<span class="chat-group-manage-item-name">' + escHtml(gs[i]) + '</span>' +
                        '<span class="chat-group-manage-item-tag"> · ' + cnt + ' 人</span>' +
                        '</div>' +
                        '<div class="chat-group-manage-item-actions">' +
                        (i === 0 ? '' : '<button class="chat-group-manage-del" data-del-group="' + escHtml(gs[i]) + '">×</button>') +
                        '</div>' +
                        '</div>';
                }
                return listHtml;
            }

            overlay.innerHTML =
                '<div class="chat-group-manage-panel">' +
                '<div class="chat-group-manage-title">管理分组</div>' +
                '<div class="chat-group-manage-list" id="gm-list">' + renderList() + '</div>' +
                '<button class="chat-group-manage-add" id="gm-add-btn">+ 添加分组</button>' +
                '<button class="chat-group-manage-close" id="gm-close-btn">完成</button>' +
                '</div>';

            self.el.appendChild(overlay);
            requestAnimationFrame(function () { overlay.classList.add('open'); });

            /* 点背景关闭 */
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    closeOverlay();
                }
            });

            function closeOverlay() {
                overlay.classList.remove('open');
                setTimeout(function () {
                    overlay.remove();
                    /* 刷新联系人页 */
                    if (self._currentTab === 'contacts') {
                        var body = self.el.querySelector('#chat-body');
                        body.innerHTML = self.buildContactsTab();
                        self.initContactsTab();
                    }
                }, 250);
            }

            /* 添加分组 */
            overlay.querySelector('#gm-add-btn').addEventListener('click', function () {
                var val = prompt('输入新分组名称');
                if (val && val.trim()) {
                    val = val.trim();
                    var d = loadData();
                    if (!d.charGroups) d.charGroups = ['默认'];
                    if (d.charGroups.indexOf(val) === -1) {
                        d.charGroups.push(val);
                        saveData(d);
                        overlay.querySelector('#gm-list').innerHTML = renderList();
                    } else {
                        self.toast('分组已存在');
                    }
                }
            });

            /* 删除分组（事件委托） */
            overlay.querySelector('#gm-list').addEventListener('click', function (e) {
                var delBtn = e.target.closest('[data-del-group]');
                if (!delBtn) return;
                var gName = delBtn.getAttribute('data-del-group');
                if (!confirm('删除分组「' + gName + '」？\n该分组下的角色将移至「默认」')) return;

                var d = loadData();
                d.charGroups = (d.charGroups || ['默认']).filter(function (g) { return g !== gName; });
                /* 将该分组角色移到默认 */
                var cs = d.characters || [];
                for (var i = 0; i < cs.length; i++) {
                    if (cs[i].group === gName) cs[i].group = d.charGroups[0] || '默认';
                }
                saveData(d);
                overlay.querySelector('#gm-list').innerHTML = renderList();
                self.toast('分组已删除');
            });

            /* 完成 */
            overlay.querySelector('#gm-close-btn').addEventListener('click', function () {
                closeOverlay();
            });
        },

        buildFeedTab: function () {
            return '<div class="chat-empty-state">' +
                '<svg viewBox="0 0 24 24" width="40" height="40" stroke="#ccc" stroke-width="1" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>' +
                '<p>暂无动态</p></div>';
        },

        /* ====== 「我」页面 ====== */
        buildMeTab: function () {
            var data = loadData();
            var profile = data.profile || {};
            var activeChar = this.getActiveCharacter();
            var displayName = activeChar ? activeChar.name : (profile.name || '未设置');

            var html = '';

            /* 个人主页卡片 */
            html += '<div class="chat-me-profile" id="chat-me-profile">' +
                '<div class="chat-me-bg" id="chat-me-bg">' +
                '<div class="chat-me-bg-empty" id="chat-me-bg-empty">点击更换背景</div>' +
                '<input type="file" accept="image/*" class="chat-file-input" id="chat-bg-input">' +
                '</div>' +
                '<div class="chat-me-avatar-wrap">' +
                '<div class="chat-me-avatar" id="chat-me-avatar">' +
                '<svg viewBox="0 0 24 24" width="32" height="32" stroke="#ccc" stroke-width="1.2" fill="none">' +
                '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                '</div>' +
                '<input type="file" accept="image/*" class="chat-file-input" id="chat-avatar-input">' +
                '<div class="chat-me-heart"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(180,120,120,0.6)" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg></div>' +
                '</div>' +
                '<div class="chat-me-info">' +
                '<div class="chat-me-name" id="chat-me-name">' + escHtml(displayName) + '</div>' +
                '<div class="chat-me-handle" id="chat-me-handle">@' + escHtml(profile.handle || displayName) + '</div>' +
                '<div class="chat-me-bio-wrap">' +
                '<span class="chat-me-bio-q">"</span>' +
                '<span class="chat-me-bio" id="chat-me-bio">' + escHtml(profile.bio || '点击编辑签名...') + '</span>' +
                '<span class="chat-me-bio-q">"</span>' +
                '</div>' +
                '<div class="chat-me-location">' +
                '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>' +
                '<span id="chat-me-loc">' + escHtml(profile.location || '未设置') + '</span>' +
                '</div>' +
                '</div>' +
                '</div>';

            /* 角色管理入口 */
            html += '<div class="chat-me-char-entry" id="chat-me-char-entry">' +
                '<div class="chat-me-char-icon">' +
                '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/><line x1="20" y1="8" x2="20" y2="14" stroke-linecap="round"/><line x1="17" y1="11" x2="23" y2="11" stroke-linecap="round"/></svg>' +
                '</div>' +
                '<div class="chat-me-char-text">' +
                '<div class="chat-me-char-title">角色管理</div>' +
                '<div class="chat-me-char-desc">当前：' + escHtml(activeChar ? activeChar.name : '无') + '</div>' +
                '</div>' +
                '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</div>';

            /* 功能板块 - 拍立得折叠风格（可编辑图片） */
            html += '<div class="chat-me-polaroid-grid">';
            for (var i = 0; i < MENU_ITEMS.length; i++) {
                var m = MENU_ITEMS[i];
                var rot = (i % 2 === 0 ? -2 : 2) + (Math.random() * 2 - 1);
                html += '<div class="chat-me-polaroid" style="--rot:' + rot.toFixed(1) + 'deg" data-menu="' + m.id + '">' +
                    '<div class="chat-me-polaroid-inner">' +
                    '<div class="chat-me-polaroid-photo" id="polaroid-photo-' + m.id + '">' +
                    '<div class="chat-me-polaroid-placeholder">' +
                    '<svg viewBox="0 0 24 24" width="28" height="28">' + m.icon + '</svg>' +
                    '</div>' +
                    '<input type="file" accept="image/*" class="chat-file-input polaroid-img-input" data-polaroid="' + m.id + '">' +
                    '</div>' +
                    '<div class="chat-me-polaroid-label">' + m.name + '</div>' +
                    '<div class="chat-me-polaroid-desc">' + m.desc + '</div>' +
                    '</div>' +
                    '</div>';
            }
            html += '</div>';

            return html;
        },

        initMeTab: function () {
            var self = this;
            var body = this.el.querySelector('#chat-body');

            /* 加载背景和头像 */
            this.loadProfileImages();

            /* 背景更换 */
            var bgInput = body.querySelector('#chat-bg-input');
            if (bgInput) {
                bgInput.addEventListener('change', function () {
                    var file = bgInput.files[0];
                    if (file) self.changeProfileImage('bg', file);
                    bgInput.value = '';
                });
            }

            /* 头像更换 */
            var avatarInput = body.querySelector('#chat-avatar-input');
            if (avatarInput) {
                avatarInput.addEventListener('change', function () {
                    var file = avatarInput.files[0];
                    if (file) self.changeProfileImage('avatar', file);
                    avatarInput.value = '';
                });
            }

            /* 点击编辑签名 */
            var bioEl = body.querySelector('#chat-me-bio');
            if (bioEl) {
                bioEl.addEventListener('click', function () {
                    var data = loadData();
                    var profile = data.profile || {};
                    var current = profile.bio || '';
                    var val = prompt('编辑签名', current);
                    if (val !== null) {
                        profile.bio = val;
                        data.profile = profile;
                        saveData(data);
                        bioEl.textContent = val || '点击编辑签名...';
                    }
                });
            }

            /* 点击编辑 handle */
            var handleEl = body.querySelector('#chat-me-handle');
            if (handleEl) {
                handleEl.addEventListener('click', function () {
                    var data = loadData();
                    var profile = data.profile || {};
                    var current = profile.handle || '';
                    var val = prompt('编辑用户名', current);
                    if (val !== null) {
                        profile.handle = val;
                        data.profile = profile;
                        saveData(data);
                        handleEl.textContent = '@' + (val || '用户名');
                    }
                });
            }

            /* 点击编辑地点 */
            var locEl = body.querySelector('#chat-me-loc');
            if (locEl) {
                locEl.addEventListener('click', function () {
                    var data = loadData();
                    var profile = data.profile || {};
                    var current = profile.location || '';
                    var val = prompt('编辑位置', current);
                    if (val !== null) {
                        profile.location = val;
                        data.profile = profile;
                        saveData(data);
                        locEl.textContent = val || '未设置';
                    }
                });
            }

            /* 角色管理入口 */
            var charEntry = body.querySelector('#chat-me-char-entry');
            if (charEntry) {
                charEntry.addEventListener('click', function () {
                    self.openCharacterPage();
                });
            }

            /* 拍立得板块 - 图片更换（使用事件委托避免重绑定） */
            body.addEventListener('change', function (e) {
                var input = e.target.closest('.polaroid-img-input');
                if (!input) return;
                var file = input.files[0];
                if (!file || file.type.indexOf('image/') !== 0) return;
                var pid = input.getAttribute('data-polaroid');
                var blob = file.slice(0, file.size, file.type);
                var photoEl = body.querySelector('#polaroid-photo-' + pid);
                if (photoEl) {
                    var url = URL.createObjectURL(blob);
                    photoEl.innerHTML = '<img src="' + url + '" class="polaroid-img" alt="">' +
                        '<input type="file" accept="image/*" class="chat-file-input polaroid-img-input" data-polaroid="' + pid + '">';
                }
                saveBlob(KEY_POLAROID_PREFIX + pid, blob, function (err) {
                    if (!err) self.toast('图片已更换');
                });
                input.value = '';
            });
            body.addEventListener('click', function (e) {
                if (e.target.closest('.polaroid-img-input')) e.stopPropagation();
            });

            /* 加载已保存的拍立得图片 */
            for (var pi = 0; pi < MENU_ITEMS.length; pi++) {
                (function (mid) {
                    loadBlob(KEY_POLAROID_PREFIX + mid, function (err, blob) {
                        if (!blob) return;
                        var url = URL.createObjectURL(blob);
                        var photoEl = body.querySelector('#polaroid-photo-' + mid);
                        if (photoEl) {
                            photoEl.innerHTML = '<img src="' + url + '" class="polaroid-img" alt="">' +
                                '<input type="file" accept="image/*" class="chat-file-input polaroid-img-input" data-polaroid="' + mid + '">';
                        }
                    });
                })(MENU_ITEMS[pi].id);
            }
        },

        /* ====== 个人主页图片 ====== */
        loadProfileImages: function () {
            var self = this;

            loadBlob(KEY_BG, function (err, blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                self._blobUrls.bg = url;
                var bgEl = self.el.querySelector('#chat-me-bg');
                if (bgEl) {
                    bgEl.style.backgroundImage = 'url(' + url + ')';
                    bgEl.style.backgroundSize = 'cover';
                    bgEl.style.backgroundPosition = 'center';
                    var empty = bgEl.querySelector('.chat-me-bg-empty');
                    if (empty) empty.style.display = 'none';
                }
            });

            loadBlob(KEY_AVATAR, function (err, blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                self._blobUrls.avatar = url;
                var avatarEl = self.el.querySelector('#chat-me-avatar');
                if (avatarEl) {
                    avatarEl.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
                }
            });
        },

        changeProfileImage: function (type, file) {
            var self = this;
            if (file.type.indexOf('image/') !== 0) { self.toast('请选择图片文件'); return; }
            if (file.size > 10 * 1024 * 1024) { self.toast('图片过大'); return; }

            var blob = file.slice(0, file.size, file.type);
            var key = type === 'bg' ? KEY_BG : KEY_AVATAR;

            if (self._blobUrls[type]) URL.revokeObjectURL(self._blobUrls[type]);
            var url = URL.createObjectURL(blob);
            self._blobUrls[type] = url;

            if (type === 'bg') {
                var bgEl = self.el.querySelector('#chat-me-bg');
                if (bgEl) {
                    bgEl.style.backgroundImage = 'url(' + url + ')';
                    bgEl.style.backgroundSize = 'cover';
                    bgEl.style.backgroundPosition = 'center';
                    var empty = bgEl.querySelector('.chat-me-bg-empty');
                    if (empty) empty.style.display = 'none';
                }
            } else {
                var avatarEl = self.el.querySelector('#chat-me-avatar');
                if (avatarEl) {
                    avatarEl.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
                }
            }

            saveBlob(key, blob, function (err) {
                if (err) { self.toast('保存失败'); return; }
                self.toast(type === 'bg' ? '背景已更换' : '头像已更换');
            });
        },

        /* ====== 角色管理 ====== */
        getActiveCharacter: function () {
            var data = loadData();
            var chars = data.characters || [];
            var activeId = data.activeCharId;
            if (!activeId || chars.length === 0) return null;
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].id === activeId) return chars[i];
            }
            return null;
        },

        openCharacterPage: function () {
            var self = this;
            var sub = document.createElement('div');
            sub.className = 'chat-sub-page';

            var data = loadData();
            var allChars = data.characters || [];
            /* 角色管理页只显示 user 类型（用户人设） */
            var chars = [];
            for (var ui = 0; ui < allChars.length; ui++) {
                if (!allChars[ui].type || allChars[ui].type === 'user') chars.push(allChars[ui]);
            }
            var activeId = data.activeCharId || '';

            var html = '<div class="chat-sub-header">' +
                '<button class="chat-back chat-sub-back">' +
                '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<span class="chat-title">角色管理</span>' +
                '</div>' +
                '<div class="chat-sub-body">';

            /* 创建按钮 */
            html += '<div class="chat-char-create" id="chat-char-create">' +
                '<svg viewBox="0 0 24 24" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
                '<span>创建新角色</span>' +
                '</div>';

            /* 角色列表 */
            if (chars.length > 0) {
                html += '<div class="chat-char-list">';
                for (var i = 0; i < chars.length; i++) {
                    var c = chars[i];
                    var isActive = c.id === activeId;
                    html += '<div class="chat-char-card' + (isActive ? ' active' : '') + '" data-char-id="' + c.id + '">' +
                        '<div class="chat-char-card-main">' +
                        '<div class="chat-char-avatar-sm" id="char-list-av-' + c.id + '">' +
                        '<svg viewBox="0 0 24 24" width="20" height="20" stroke="#bbb" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                        '</div>' +
                        '<div class="chat-char-info">' +
                        '<div class="chat-char-name">' + escHtml(c.name) + (c.nickname ? ' <span class="chat-char-nick">(' + escHtml(c.nickname) + ')</span>' : '') + '</div>' +
                        '<div class="chat-char-gender">' + escHtml(c.gender || '未设置') + '</div>' +
                        '</div>' +
                        '<div class="chat-char-actions">' +
                        (isActive ? '<span class="chat-char-active-badge">使用中</span>' : '<button class="chat-char-use-btn" data-use="' + c.id + '">切换</button>') +
                        '<button class="chat-char-del-btn" data-del="' + c.id + '">×</button>' +
                        '</div>' +
                        '</div>' +
                        (c.detail ? '<div class="chat-char-detail">' + escHtml(c.detail).substring(0, 60) + (c.detail.length > 60 ? '...' : '') + '</div>' : '') +
                        '</div>';
                }
                html += '</div>';
            } else {
                html += '<div class="chat-empty-state"><p>还没有角色，点击上方创建</p></div>';
            }

            html += '</div>';
            sub.innerHTML = html;
            self.el.appendChild(sub);
            requestAnimationFrame(function () { sub.classList.add('open'); });

            /* 加载所有角色列表头像 */
            for (var k = 0; k < chars.length; k++) {
                (function (cid) {
                    loadBlob(KEY_CHAR_AVATAR_PREFIX + cid, function (err, blob) {
                        if (!blob) return;
                        var url = URL.createObjectURL(blob);
                        var el = sub.querySelector('#char-list-av-' + cid);
                        if (el) el.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
                    });
                })(chars[k].id);
            }

            /* 返回 */
            sub.querySelector('.chat-sub-back').addEventListener('click', function () {
                sub.classList.remove('open');
                setTimeout(function () { sub.remove(); self.switchTab('me'); }, 350);
            });

            /* 创建角色 */
            sub.querySelector('#chat-char-create').addEventListener('click', function () {
                self.openCreateCharPage(sub);
            });

            /* 切换/删除 */
            sub.addEventListener('click', function (e) {
                var useBtn = e.target.closest('[data-use]');
                if (useBtn) {
                    var id = useBtn.getAttribute('data-use');
                    var d = loadData();
                    d.activeCharId = id;
                    saveData(d);
                    /* 同步角色头像到个人主页头像 */
                    self.syncCharAvatarToProfile(id);
                    sub.classList.remove('open');
                    setTimeout(function () { sub.remove(); self.switchTab('me'); }, 350);
                    self.toast('角色已切换');
                    return;
                }

                var delBtn = e.target.closest('[data-del]');
                if (delBtn) {
                    if (!confirm('确定删除此角色？')) return;
                    var delId = delBtn.getAttribute('data-del');
                    var d2 = loadData();
                    d2.characters = (d2.characters || []).filter(function (c) { return c.id !== delId; });
                    if (d2.activeCharId === delId) d2.activeCharId = '';
                    saveData(d2);
                    /* 删除角色头像 */
                    openDB(function (err, db) {
                        if (err) return;
                        var tx = db.transaction(STORE_NAME, 'readwrite');
                        tx.objectStore(STORE_NAME).delete(KEY_CHAR_AVATAR_PREFIX + delId);
                    });
                    sub.classList.remove('open');
                    setTimeout(function () { sub.remove(); self.openCharacterPage(); }, 350);
                    self.toast('角色已删除');
                }
            });
        },

        openCreateCharPage: function (parentSub) {
            var self = this;
            var sub = document.createElement('div');
            sub.className = 'chat-sub-page';
            var _charAvatarFile = null;

            var html = '<div class="chat-sub-header">' +
                '<button class="chat-back chat-sub-back">' +
                '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<span class="chat-title">创建角色</span>' +
                '</div>' +
                '<div class="chat-sub-body">' +
                '<div class="chat-form">' +

                /* 头像 */
                '<div class="chat-form-avatar-wrap">' +
                '<div class="chat-form-avatar" id="char-avatar-preview">' +
                '<svg viewBox="0 0 24 24" width="36" height="36" stroke="#ccc" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                '</div>' +
                '<div class="chat-form-avatar-hint">点击设置头像</div>' +
                '<input type="file" accept="image/*" class="chat-file-input" id="char-avatar-input">' +
                '</div>' +

                '<div class="chat-form-label">名字 <span class="chat-form-required">*</span></div>' +
                '<input class="chat-form-input" id="char-name" placeholder="角色名字" maxlength="20">' +

                '<div class="chat-form-label">昵称（小名/外号）</div>' +
                '<input class="chat-form-input" id="char-nickname" placeholder="可选" maxlength="20">' +

                '<div class="chat-form-label">性别</div>' +
                '<div class="chat-form-gender" id="char-gender-group">' +
                '<div class="chat-form-gender-item active" data-gender="男">男</div>' +
                '<div class="chat-form-gender-item" data-gender="女">女</div>' +
                '<div class="chat-form-gender-item" data-gender="其他">其他</div>' +
                '</div>' +

                '<div class="chat-form-label">详细内容（人设信息）</div>' +
                '<textarea class="chat-form-textarea" id="char-detail" placeholder="详细描述角色的性格、背景、说话风格等..." rows="6"></textarea>' +

                '<button class="chat-form-save" id="char-save-btn">保存角色</button>' +
                '</div>' +
                '</div>';

            sub.innerHTML = html;
            self.el.appendChild(sub);
            requestAnimationFrame(function () { sub.classList.add('open'); });

            /* 头像选择 */
            var avatarInput = sub.querySelector('#char-avatar-input');
            var avatarPreview = sub.querySelector('#char-avatar-preview');
            if (avatarInput) {
                avatarInput.addEventListener('change', function () {
                    var file = avatarInput.files[0];
                    if (!file || file.type.indexOf('image/') !== 0) return;
                    _charAvatarFile = file;
                    var url = URL.createObjectURL(file);
                    avatarPreview.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
                    avatarInput.value = '';
                });
            }

            /* 性别选择 */
            var genderItems = sub.querySelectorAll('[data-gender]');
            for (var i = 0; i < genderItems.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        for (var j = 0; j < genderItems.length; j++) genderItems[j].classList.remove('active');
                        item.classList.add('active');
                    });
                })(genderItems[i]);
            }

            /* 返回 */
            sub.querySelector('.chat-sub-back').addEventListener('click', function () {
                sub.classList.remove('open');
                setTimeout(function () { sub.remove(); }, 350);
            });

            /* 保存 */
            sub.querySelector('#char-save-btn').addEventListener('click', function () {
                var name = sub.querySelector('#char-name').value.trim();
                if (!name) { self.toast('请输入名字'); return; }

                var nickname = sub.querySelector('#char-nickname').value.trim();
                var genderEl = sub.querySelector('[data-gender].active');
                var gender = genderEl ? genderEl.getAttribute('data-gender') : '其他';
                var detail = sub.querySelector('#char-detail').value.trim();

                var character = {
                    id: 'char_' + Date.now(),
                    type: 'user',
                    name: name,
                    nickname: nickname,
                    gender: gender,
                    detail: detail,
                    group: '',
                    createdAt: new Date().toISOString()
                };

                var data = loadData();
                if (!data.characters) data.characters = [];
                data.characters.push(character);
                var isFirst = !data.activeCharId;
                if (isFirst) data.activeCharId = character.id;
                saveData(data);

                /* 保存角色头像到 IndexedDB */
                if (_charAvatarFile) {
                    var blob = _charAvatarFile.slice(0, _charAvatarFile.size, _charAvatarFile.type);
                    saveBlob(KEY_CHAR_AVATAR_PREFIX + character.id, blob, function () {
                        /* 如果是首个角色或自动激活，同步到主页头像 */
                        if (isFirst) {
                            self.syncCharAvatarToProfile(character.id);
                        }
                    });
                }

                self.toast('角色已创建');
                sub.classList.remove('open');
                setTimeout(function () {
                    sub.remove();
                    /* 刷新角色管理页 */
                    if (parentSub) {
                        parentSub.classList.remove('open');
                        setTimeout(function () { parentSub.remove(); self.openCharacterPage(); }, 100);
                    }
                }, 350);
            });
        },

        /* 将角色头像同步到个人主页头像 */
        syncCharAvatarToProfile: function (charId) {
            var self = this;
            loadBlob(KEY_CHAR_AVATAR_PREFIX + charId, function (err, blob) {
                if (!blob) return;
                /* 保存到主页头像 key */
                saveBlob(KEY_AVATAR, blob, function () {
                    /* 如果当前「我」页面正在显示，立即更新 UI */
                    if (self._blobUrls.avatar) URL.revokeObjectURL(self._blobUrls.avatar);
                    var url = URL.createObjectURL(blob);
                    self._blobUrls.avatar = url;
                    var avatarEl = self.el ? self.el.querySelector('#chat-me-avatar') : null;
                    if (avatarEl) {
                        avatarEl.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
                    }
                });
            });
        },


        /* ====== 对话页面 ====== */
        openChatRoom: function (charId) {
            var self = this;
            var data = loadData();
            var chars = data.characters || [];
            var char = null;
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].id === charId) { char = chars[i]; break; }
            }
            if (!char) { self.toast('角色不存在'); return; }

            var sub = document.createElement('div');
            sub.className = 'chat-sub-page';

            /* 工具栏配置 */
            var tools = [
                { en: 'Voice', cn: '语音', icon: '<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' },
                { en: 'Camera', cn: '相机', icon: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>' },
                { en: 'Album', cn: '相册', icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
                { en: 'Transfer', cn: '转账', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>' },
                { en: 'Audio Call', cn: '语音电话', icon: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>' },
                { en: 'Video Call', cn: '视频通话', icon: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>' },
                { en: 'Location', cn: '定位', icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>' },
                { en: 'Family Card', cn: '亲属卡', icon: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/>' }
            ];

            var toolsHtml = '';
            for (var t = 0; t < tools.length; t++) {
                toolsHtml += '<div class="cr-tool-item">' +
                    '<div class="cr-tool-icon">' +
                    '<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">' + tools[t].icon + '</svg>' +
                    '</div>' +
                    '<span class="cr-tool-label"><em>' + tools[t].en + '</em> ' + tools[t].cn + '</span>' +
                    '</div>';
            }

            var moodText = char.mood || 'Happy';

            var html = '' +
                /* 聊天消息区 */
                '<div class="cr-messages" id="cr-messages"></div>' +

                /* 悬浮顶栏 */
                '<div class="cr-topbar" id="cr-topbar">' +
                '<div class="cr-topbar-left">' +
                '<button class="cr-back" id="cr-back">' +
                '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<div class="cr-topbar-avatar" id="cr-topbar-avatar">' +
                '<svg viewBox="0 0 24 24" width="22" height="22" stroke="#bbb" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                '</div>' +
                '</div>' +
                '<div class="cr-topbar-info">' +
                '<div class="cr-topbar-name">' + escHtml(char.name) + '</div>' +
                '<div class="cr-topbar-ip" id="cr-topbar-ip" title="点击编辑IP">' + escHtml(char.ip || 'Original Character') + '</div>' +
                '<div class="cr-topbar-mood">' + escHtml(moodText) + '</div>' +
                '</div>' +
                '<button class="cr-settings-btn" id="cr-settings-btn" title="聊天设置">' +
                '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>' +
                '</button>' +
                '</div>' +

                /* 底部区域 */
                '<div class="cr-bottom">' +
                /* 工具栏 */
                '<div class="cr-toolbar" id="cr-toolbar">' + toolsHtml + '</div>' +
                /* 输入栏 */
                '<div class="cr-inputbar">' +
                '<button class="cr-emoji-btn" id="cr-emoji-btn" title="表情包">' +
                '<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' +
                '</button>' +
                '<textarea class="cr-input" id="cr-input" placeholder="输入消息..." rows="1"></textarea>' +
                '<button class="cr-continue-btn" id="cr-continue-btn" title="续写">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>' +
                '</button>' +
                '<button class="cr-send-btn" id="cr-send-btn" title="发送">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
                '</button>' +
                '</div>' +
                '</div>';

            sub.innerHTML = html;
            self.el.appendChild(sub);
            requestAnimationFrame(function () { sub.classList.add('open'); });

            /* 加载角色头像 */
            loadBlob(KEY_CHAR_AVATAR_PREFIX + charId, function (err, blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                var avEl = sub.querySelector('#cr-topbar-avatar');
                if (avEl) avEl.innerHTML = '<img src="' + url + '" alt="">';
            });

            /* 返回 */
            sub.querySelector('#cr-back').addEventListener('click', function () {
                sub.classList.remove('open');
                setTimeout(function () { sub.remove(); }, 350);
            });

            /* 编辑 IP */
            sub.querySelector('#cr-topbar-ip').addEventListener('click', function () {
                var d = loadData();
                var cs = d.characters || [];
                var current = '';
                for (var i = 0; i < cs.length; i++) {
                    if (cs[i].id === charId) { current = cs[i].ip || ''; break; }
                }
                var val = prompt('编辑角色IP', current);
                if (val !== null) {
                    for (var j = 0; j < cs.length; j++) {
                        if (cs[j].id === charId) { cs[j].ip = val.trim(); break; }
                    }
                    d.characters = cs;
                    saveData(d);
                    sub.querySelector('#cr-topbar-ip').textContent = val.trim() || 'Original Character';
                }
            });

            /* 聊天设置按钮 */
            sub.querySelector('#cr-settings-btn').addEventListener('click', function () {
                self.toast('聊天设置开发中');
            });

            /* 表情包按钮 */
            sub.querySelector('#cr-emoji-btn').addEventListener('click', function () {
                self.toast('表情包开发中');
            });

            /* 续写按钮 */
            sub.querySelector('#cr-continue-btn').addEventListener('click', function () {
                self.toast('续写功能开发中');
            });

            /* 发送按钮 */
            sub.querySelector('#cr-send-btn').addEventListener('click', function () {
                var input = sub.querySelector('#cr-input');
                var text = input.value.trim();
                if (!text) return;
                self.addChatMessage(sub, charId, 'user', text);
                input.value = '';
                input.style.height = 'auto';
            });

            /* 输入框自适应高度 + 回车发送 */
            var inputEl = sub.querySelector('#cr-input');
            inputEl.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 100) + 'px';
            });
            inputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sub.querySelector('#cr-send-btn').click();
                }
            });

            /* 加载历史消息 */
            this.loadChatHistory(sub, charId);
        },

        addChatMessage: function (sub, charId, role, text) {
            var msgArea = sub.querySelector('#cr-messages');
            if (!msgArea) return;

            var bubble = document.createElement('div');
            bubble.className = 'cr-msg cr-msg-' + role;
            bubble.innerHTML = '<div class="cr-msg-bubble">' + escHtml(text) + '</div>';
            msgArea.appendChild(bubble);
            msgArea.scrollTop = msgArea.scrollHeight;

            /* 存储消息 */
            var d = loadData();
            if (!d.chatHistory) d.chatHistory = {};
            if (!d.chatHistory[charId]) d.chatHistory[charId] = [];
            d.chatHistory[charId].push({
                role: role,
                text: text,
                time: new Date().toISOString()
            });
            saveData(d);
        },

        loadChatHistory: function (sub, charId) {
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            var msgArea = sub.querySelector('#cr-messages');
            if (!msgArea || msgs.length === 0) return;

            for (var i = 0; i < msgs.length; i++) {
                var bubble = document.createElement('div');
                bubble.className = 'cr-msg cr-msg-' + msgs[i].role;
                bubble.innerHTML = '<div class="cr-msg-bubble">' + escHtml(msgs[i].text) + '</div>';
                msgArea.appendChild(bubble);
            }
            msgArea.scrollTop = msgArea.scrollHeight;
        },


        getLastMessage: function (charId) {
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            if (msgs.length === 0) return '';
            return msgs[msgs.length - 1].text;
        },

        toast: function (msg) {
            var t = this.el.querySelector('#chat-toast');
            if (!t) return;
            t.textContent = msg;
            t.classList.add('show');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2000);
        }
    };

    window.ChatApp = ChatApp;
})();
