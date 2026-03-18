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
            this.switchTab('msg');
            /* 启动主动发消息引擎（页面加载后就开始轮询） */
            this.startProactiveEngine();
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

            /* 拦截表情包板块点击 → 打开表情包管理页 */
            body.addEventListener('click', function (e) {
                var polaroid = e.target.closest('.chat-me-polaroid[data-menu="sticker"]');
                if (!polaroid) return;
                /* 阻止触发图片文件选择 */
                if (e.target.closest('.polaroid-img-input')) return;
                e.stopPropagation();
                self.openStickerManagerPage();
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

        /* ================================================
   表情包管理系统
   数据结构（存 localStorage）：
   data.stickerGroups = [
     { id: 'sg_xxx', name: '开心', stickers: [
       { id: 'st_xxx', url: 'https://...', name: '开心1' }
     ]}
   ]
   ================================================ */

        /* —— 工具方法 —— */
        _getStickerGroups: function () {
            return loadData().stickerGroups || [];
        },

        _saveStickerGroups: function (groups) {
            var d = loadData();
            d.stickerGroups = groups;
            /* 同步更新旧的 stickerPacks 字段（供 chat-settings 兼容） */
            d.stickerPacks = groups.map(function (g) { return { id: g.id, name: g.name }; });
            saveData(d);
        },

        /* —— 表情包管理主页 —— */
        openStickerManagerPage: function () {
            var self = this;
            var sub = document.createElement('div');
            sub.className = 'chat-sub-page';

            var groups = self._getStickerGroups();

            var html = '<div class="chat-sub-header">' +
                '<button class="chat-back chat-sub-back">' +
                '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '</button>' +
                '<span class="chat-title">表情包</span>' +
                '</div>' +
                '<div class="chat-sub-body stk-manager-body">';

            /* 操作区 */
            html += '<div class="stk-action-bar">' +
                '<button class="stk-action-btn" id="stk-import-url">URL导入</button>' +
                '<button class="stk-action-btn" id="stk-import-json">JSON导入</button>' +
                '<button class="stk-action-btn stk-action-primary" id="stk-new-group">+ 新建分组</button>' +
                '</div>';

            /* 导出按钮 */
            html += '<div class="stk-export-bar">' +
                '<button class="stk-action-btn" id="stk-export-json">导出全部表情包</button>' +
                '</div>';

            /* 分组列表 */
            if (groups.length === 0) {
                html += '<div class="stk-empty">暂无表情包分组，点击「+ 新建分组」创建</div>';
            } else {
                html += '<div class="stk-group-list" id="stk-group-list">';
                for (var gi = 0; gi < groups.length; gi++) {
                    var g = groups[gi];
                    html += '<div class="stk-group-card" data-gid="' + g.id + '">' +
                        '<div class="stk-group-header stk-group-collapse-trigger" data-grid="stk-grid-' + g.id + '">' +
                        '<span class="stk-group-name">' + escHtml(g.name) + '</span>' +
                        '<div style="display:flex;align-items:center;gap:6px">' +
                        '<span class="stk-group-count">' + (g.stickers ? g.stickers.length : 0) + ' 张</span>' +
                        '<span class="stk-collapse-arrow">▾</span>' +
                        '<div class="stk-group-actions">' +
                        '<button class="stk-group-btn stk-add-to-group" data-gid="' + g.id + '" title="添加表情">+</button>' +
                        '<button class="stk-group-btn stk-del-group" data-gid="' + g.id + '" title="删除分组">×</button>' +
                        '</div>' +
                        '</div>' +
                        '</div>' +
                        '<div class="stk-grid" id="stk-grid-' + g.id + '">';
                    var stickers = g.stickers || [];
                    for (var si = 0; si < stickers.length; si++) {
                        var s = stickers[si];
                        html += '<div class="stk-item" data-gid="' + g.id + '" data-sid="' + s.id + '">' +
                            '<img src="' + escHtml(s.url) + '" alt="' + escHtml(s.name || '') + '" loading="lazy">' +
                            '<button class="stk-del-item" data-gid="' + g.id + '" data-sid="' + s.id + '">×</button>' +
                            '</div>';
                    }
                    html += '</div></div>';
                }
                html += '</div>';
            }

            html += '</div>';
            sub.innerHTML = html;
            self.el.appendChild(sub);
            requestAnimationFrame(function () { sub.classList.add('open'); });

            /* 返回 */
            sub.querySelector('.chat-sub-back').addEventListener('click', function () {
                sub.classList.remove('open');
                setTimeout(function () { sub.remove(); }, 350);
            });

            /* 新建分组 */
            sub.querySelector('#stk-new-group').addEventListener('click', function () {
                var name = prompt('输入分组名称（例如：开心、撒娇、生气）');
                if (!name || !name.trim()) return;
                var groups2 = self._getStickerGroups();
                var newGroup = { id: 'sg_' + Date.now(), name: name.trim(), stickers: [] };
                groups2.push(newGroup);
                self._saveStickerGroups(groups2);
                self.toast('分组已创建');
                sub.classList.remove('open');
                setTimeout(function () { sub.remove(); self.openStickerManagerPage(); }, 350);
            });

            /* URL导入 */
            sub.querySelector('#stk-import-url').addEventListener('click', function () {
                self._openStickerUrlImport(sub);
            });

            /* JSON导入 */
            sub.querySelector('#stk-import-json').addEventListener('click', function () {
                self._openStickerJsonImport(sub);
            });

            /* 导出JSON */
            sub.querySelector('#stk-export-json').addEventListener('click', function () {
                var groups3 = self._getStickerGroups();
                var json = JSON.stringify({ stickerGroups: groups3 }, null, 2);
                var blob = new Blob([json], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'stickers_export_' + Date.now() + '.json';
                a.click();
                URL.revokeObjectURL(url);
                self.toast('已导出');
            });

            /* 分组内操作（事件委托） */
            sub.addEventListener('click', function (e) {
                /* 折叠/展开分组 */
                var collapseHdr = e.target.closest('.stk-group-collapse-trigger');
                if (collapseHdr && !e.target.closest('.stk-group-actions')) {
                    var gridId = collapseHdr.getAttribute('data-grid');
                    var gridEl = sub.querySelector('#' + gridId);
                    var arrow = collapseHdr.querySelector('.stk-collapse-arrow');
                    if (gridEl) {
                        var isCollapsed = gridEl.style.display === 'none';
                        gridEl.style.display = isCollapsed ? '' : 'none';
                        if (arrow) arrow.textContent = isCollapsed ? '▾' : '▸';
                    }
                    return;
                }

                /* 添加表情到分组 */
                var addBtn = e.target.closest('.stk-add-to-group');
                if (addBtn) {
                    var gid = addBtn.getAttribute('data-gid');
                    self._openStickerUrlImport(sub, gid);
                    return;
                }

                /* 删除分组 */
                var delGrp = e.target.closest('.stk-del-group');
                if (delGrp) {
                    if (!confirm('确定删除此分组及其所有表情包？')) return;
                    var gid2 = delGrp.getAttribute('data-gid');
                    var gs = self._getStickerGroups().filter(function (g) { return g.id !== gid2; });
                    self._saveStickerGroups(gs);
                    sub.classList.remove('open');
                    setTimeout(function () { sub.remove(); self.openStickerManagerPage(); }, 350);
                    return;
                }

                /* 删除单张表情 */
                var delItem = e.target.closest('.stk-del-item');
                if (delItem) {
                    var gid3 = delItem.getAttribute('data-gid');
                    var sid = delItem.getAttribute('data-sid');
                    var gs2 = self._getStickerGroups();
                    for (var gi2 = 0; gi2 < gs2.length; gi2++) {
                        if (gs2[gi2].id === gid3) {
                            gs2[gi2].stickers = (gs2[gi2].stickers || []).filter(function (s) { return s.id !== sid; });
                            break;
                        }
                    }
                    self._saveStickerGroups(gs2);
                    /* 直接移除DOM节点 */
                    var itemEl = sub.querySelector('[data-sid="' + sid + '"].stk-item');
                    if (itemEl) itemEl.remove();
                    self.toast('已删除');
                    return;
                }
            });
        },

        /* —— URL导入弹窗 —— */
        _openStickerUrlImport: function (parentSub, defaultGid) {
            var self = this;
            var groups = self._getStickerGroups();

            if (groups.length === 0) {
                self.toast('请先创建至少一个分组');
                return;
            }

            /* 构建分组选择选项 */
            var groupOpts = groups.map(function (g) {
                var sel = (g.id === defaultGid) ? ' selected' : '';
                return '<option value="' + g.id + '"' + sel + '>' + escHtml(g.name) + '</option>';
            }).join('');

            var overlay = document.createElement('div');
            overlay.className = 'stk-overlay';
            overlay.innerHTML =
                '<div class="stk-dialog">' +
                '<div class="stk-dialog-title">URL导入表情包</div>' +
                '<div class="stk-dialog-body">' +
                '<label class="stk-label">目标分组</label>' +
                '<select class="stk-select" id="stk-url-group">' + groupOpts + '</select>' +
                '<label class="stk-label" style="margin-top:12px">表情URL（每行一个）</label>' +
                '<div class="stk-hint">支持 .jpg .jpeg .png .gif .webp 结尾的链接<br>格式：直接粘贴URL，名称可选（URL 空格 名称）</div>' +
                '<textarea class="stk-textarea" id="stk-url-input" placeholder="https://example.com/happy.gif\nhttps://example.com/sad.jpg 难过\nhttps://example.com/cry.gif"></textarea>' +
                '</div>' +
                '<div class="stk-dialog-footer">' +
                '<button class="stk-dialog-btn stk-dialog-cancel" id="stk-url-cancel">取消</button>' +
                '<button class="stk-dialog-btn stk-dialog-ok" id="stk-url-ok">导入</button>' +
                '</div>' +
                '</div>';

            parentSub.appendChild(overlay);
            requestAnimationFrame(function () { overlay.classList.add('open'); });

            function closeOverlay() {
                overlay.classList.remove('open');
                setTimeout(function () { overlay.remove(); }, 250);
            }

            overlay.querySelector('#stk-url-cancel').addEventListener('click', closeOverlay);
            overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });

            overlay.querySelector('#stk-url-ok').addEventListener('click', function () {
                var gid = overlay.querySelector('#stk-url-group').value;
                var raw = overlay.querySelector('#stk-url-input').value.trim();
                if (!raw) { self.toast('请输入URL'); return; }

                var lines = raw.split('\n');
                var added = 0;
                var groups2 = self._getStickerGroups();
                var validExts = /\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?.*)?$/i;

                for (var li = 0; li < lines.length; li++) {
                    var line = lines[li].trim();
                    if (!line) continue;
                    var parts = line.split(/\s+/);
                    var url = parts[0];
                    var name = parts.slice(1).join(' ') || '';

                    /* 宽松校验：有http且图片格式 */
                    if (!url.match(/^https?:\/\//i)) continue;
                    if (!validExts.test(url)) {
                        /* 尝试接受任何http链接（某些CDN无扩展名） */
                        /* 仍然添加，只是不校验扩展名 */
                    }

                    for (var gi = 0; gi < groups2.length; gi++) {
                        if (groups2[gi].id === gid) {
                            if (!groups2[gi].stickers) groups2[gi].stickers = [];
                            groups2[gi].stickers.push({
                                id: 'st_' + Date.now() + '_' + added,
                                url: url,
                                name: name
                            });
                            added++;
                            break;
                        }
                    }
                }

                self._saveStickerGroups(groups2);
                closeOverlay();
                self.toast('已导入 ' + added + ' 张表情包');
                /* 刷新页面 */
                parentSub.classList.remove('open');
                setTimeout(function () {
                    parentSub.remove();
                    self.openStickerManagerPage();
                }, 350);
            });
        },

        /* —— JSON批量导入弹窗 —— */
        _openStickerJsonImport: function (parentSub) {
            var self = this;

            var overlay = document.createElement('div');
            overlay.className = 'stk-overlay';
            overlay.innerHTML =
                '<div class="stk-dialog">' +
                '<div class="stk-dialog-title">JSON批量导入</div>' +
                '<div class="stk-dialog-body">' +
                '<div class=\"stk-hint\">支持格式：<br>' +
                '1. 本工具导出的 JSON 文件<br>' +
                '2. 自定义格式：<code>{\"stickerGroups\":[{\"name\":\"分组名\",\"stickers\":[{\"url\":\"...\",\"name\":\"...\"}]}]}</code><br>' +
                '3. 第三方 emoji 库格式：<code>{\"version\":\"1.0\",\"library\":{\"name\":\"...\"},\"emojis\":[...]}</code>' +
                '</div>' +
                '<div class="stk-import-zone" id="stk-json-zone">' +
                '<svg viewBox="0 0 24 24" width="32" height="32" stroke="#ccc" stroke-width="1.2" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
                '<div>点击选择 JSON 文件</div>' +
                '<input type="file" accept=".json,application/json" style="position:absolute;inset:0;opacity:0;cursor:pointer" id="stk-json-file">' +
                '</div>' +
                '<div id="stk-json-preview" style="display:none" class="stk-json-preview"></div>' +
                '<div class="stk-toggle-row" id="stk-merge-row" style="display:none">' +
                '<span id="stk-merge-label">作为新分组导入</span>' +
                '<label class="stk-toggle-label"><input type="checkbox" id="stk-json-new-group" checked><span class="stk-toggle-slider"></span></label>' +
                '</div>' +
                '</div>' +
                '<div class="stk-dialog-footer">' +
                '<button class="stk-dialog-btn stk-dialog-cancel" id="stk-json-cancel">取消</button>' +
                '<button class="stk-dialog-btn stk-dialog-ok" id="stk-json-ok" disabled>导入</button>' +
                '</div>' +
                '</div>';

            parentSub.appendChild(overlay);
            requestAnimationFrame(function () { overlay.classList.add('open'); });

            var _parsedGroups = null;

            function closeOverlay() {
                overlay.classList.remove('open');
                setTimeout(function () { overlay.remove(); }, 250);
            }

            overlay.querySelector('#stk-json-cancel').addEventListener('click', closeOverlay);
            overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });

            overlay.querySelector('#stk-json-file').addEventListener('change', function () {
                var file = this.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (ev) {
                    try {
                        var json = JSON.parse(ev.target.result);
                        /* 支持三种格式 */
                        var imported = [];

                        if (json.stickerGroups && Array.isArray(json.stickerGroups)) {
                            /* 格式1：本工具导出格式 { stickerGroups: [...] } */
                            imported = json.stickerGroups;

                        } else if (Array.isArray(json)) {
                            /* 格式2：裸数组 [...] */
                            imported = json;

                        } else if (json.emojis && Array.isArray(json.emojis)) {
                            /* 格式3：第三方 emoji 库格式 { version, library, emojis:[...] }
                               每条 emoji: { name, description, imageData/originalUrl, ... }
                               → 整个 library 作为一个分组导入 */
                            var libName = (json.library && json.library.name) ? json.library.name : '导入的表情包';
                            var stickers = [];
                            for (var ei = 0; ei < json.emojis.length; ei++) {
                                var em = json.emojis[ei];
                                /* 优先用 originalUrl，其次 imageData（可能是 base64 或 URL） */
                                var url = em.originalUrl || em.imageData || '';
                                if (!url) continue;
                                /* 名称优先用 description，其次 name */
                                var emName = (em.description && em.description.trim()) ? em.description.trim() : (em.name || '');
                                stickers.push({
                                    id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                                    url: url,
                                    name: emName
                                });
                            }
                            imported = [{
                                id: 'sg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                                name: libName,
                                stickers: stickers
                            }];

                        } else {
                            self.toast('JSON格式不正确，请检查文件结构');
                            return;
                        }

                        _parsedGroups = imported;

                        /* 用文件名（去掉扩展名）作为默认分组名 */
                        var defaultGroupName = file.name.replace(/\.[^.]+$/, '') || '导入的表情包';
                        /* 如果解析出的分组已有名称（来自 library.name 等），优先用那个；
                           否则用文件名 */
                        _parsedGroups.forEach(function (g) {
                            if (!g._originalName) g._originalName = g.name || defaultGroupName;
                        });

                        var totalCount = 0;
                        imported.forEach(function (g) { totalCount += (g.stickers || []).length; });
                        var previewEl = overlay.querySelector('#stk-json-preview');
                        /* 展示分组名称预览 */
                        var groupNames = imported.map(function (g) { return '「' + (g._originalName || g.name || defaultGroupName) + '」'; }).join(' ');
                        previewEl.textContent = '解析成功：' + imported.length + ' 个分组，共 ' + totalCount + ' 张表情 → ' + groupNames;
                        previewEl.style.display = 'block';

                        /* 动态更新 toggle 说明：显示将要创建的分组名 */
                        var mergeLabel = overlay.querySelector('#stk-merge-label');
                        if (mergeLabel) {
                            mergeLabel.textContent = '作为新分组导入（' + groupNames + '）';
                        }

                        overlay.querySelector('#stk-merge-row').style.display = 'flex';
                        overlay.querySelector('#stk-json-ok').disabled = false;
                    } catch (e2) {
                        self.toast('解析失败：' + e2.message);
                    }
                };
                reader.readAsText(file);
                this.value = '';
            });

            overlay.querySelector('#stk-json-ok').addEventListener('click', function () {
                if (!_parsedGroups) return;

                /* 
                 * asNewGroup = true  → 作为新分组插入（保留所有已有分组，直接 push 新的进去）
                 * asNewGroup = false → 追加进同名已有分组（找得到就追加，找不到也新建）
                 */
                var asNewGroup = overlay.querySelector('#stk-json-new-group').checked;
                var existing = self._getStickerGroups();

                if (asNewGroup) {
                    /* ---- 新建分组模式：直接追加，不管同名 ---- */
                    for (var pi = 0; pi < _parsedGroups.length; pi++) {
                        var pg = _parsedGroups[pi];
                        var pgName = pg._originalName || pg.name || '导入的表情包';
                        /* 若已有完全同名分组，后缀数字避免混淆 */
                        var finalName = pgName;
                        var nameCount = 0;
                        for (var ei = 0; ei < existing.length; ei++) {
                            if (existing[ei].name === finalName) {
                                nameCount++;
                                finalName = pgName + ' (' + nameCount + ')';
                                ei = -1; /* 重新检查 */
                            }
                        }
                        existing.push({
                            id: 'sg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                            name: finalName,
                            stickers: (pg.stickers || []).map(function (s) {
                                return { id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2), url: s.url, name: s.name || '' };
                            })
                        });
                    }
                    self._saveStickerGroups(existing);

                } else {
                    /* ---- 追加模式：同名分组追加表情，无同名则新建 ---- */
                    var nameMap = {};
                    for (var ei2 = 0; ei2 < existing.length; ei2++) {
                        nameMap[existing[ei2].name] = ei2;
                    }
                    for (var pi2 = 0; pi2 < _parsedGroups.length; pi2++) {
                        var pg2 = _parsedGroups[pi2];
                        var pgName2 = pg2._originalName || pg2.name || '导入的表情包';
                        if (nameMap[pgName2] !== undefined) {
                            /* 追加到已有同名分组 */
                            var tgt = existing[nameMap[pgName2]];
                            if (!tgt.stickers) tgt.stickers = [];
                            (pg2.stickers || []).forEach(function (s) {
                                tgt.stickers.push({ id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2), url: s.url, name: s.name || '' });
                            });
                        } else {
                            /* 无同名，新建 */
                            existing.push({
                                id: 'sg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                                name: pgName2,
                                stickers: (pg2.stickers || []).map(function (s) {
                                    return { id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2), url: s.url, name: s.name || '' };
                                })
                            });
                            nameMap[pgName2] = existing.length - 1;
                        }
                    }
                    self._saveStickerGroups(existing);
                }

                closeOverlay();
                self.toast('导入完成');
                parentSub.classList.remove('open');
                setTimeout(function () { parentSub.remove(); self.openStickerManagerPage(); }, 350);
            });
        },

        /* ================================================
           表情包栏 — 在聊天室输入框左侧展开
           ================================================ */
        _stickerBarOpen: false,

        openStickerBar: function (sub, charId) {
            var self = this;
            /* 如果已经打开，关闭 */
            var existingBar = sub.querySelector('#cr-sticker-bar');
            if (existingBar) {
                existingBar.classList.remove('open');
                setTimeout(function () { existingBar.remove(); }, 250);
                self._stickerBarOpen = false;
                return;
            }
            self._stickerBarOpen = true;

            /* 获取该聊天室挂载的分组 */
            var data = loadData();
            var rc = (data.roomConfig && data.roomConfig[charId]) || {};
            var mountedIds = rc.mountedStickers || [];
            var allGroups = data.stickerGroups || [];

            /* 过滤出挂载的分组 */
            var mountedGroups = [];
            for (var mi = 0; mi < mountedIds.length; mi++) {
                for (var gi = 0; gi < allGroups.length; gi++) {
                    if (allGroups[gi].id === mountedIds[mi]) {
                        mountedGroups.push(allGroups[gi]);
                        break;
                    }
                }
            }

            var bar = document.createElement('div');
            bar.id = 'cr-sticker-bar';
            bar.className = 'cr-sticker-bar';

            if (mountedGroups.length === 0) {
                bar.innerHTML = '<div class="cr-sticker-empty">未挂载表情包分组<br><small>请在聊天设置中挂载分组</small></div>';
            } else {
                /* ---- 分组 Tab 切换结构 ---- */
                /* Tab 标签栏 */
                var tabHtml = '<div class="cr-sticker-tabs">';
                for (var gIdx = 0; gIdx < mountedGroups.length; gIdx++) {
                    var g = mountedGroups[gIdx];
                    if ((g.stickers || []).length === 0) continue;
                    tabHtml += '<div class="cr-sticker-tab' + (gIdx === 0 ? ' active' : '') + '" data-gidx="' + gIdx + '">' +
                        escHtml(g.name) + '</div>';
                }
                tabHtml += '</div>';

                /* 各分组内容面板，默认只渲染第0组 */
                var panelHtml = '<div class="cr-sticker-panels">';
                for (var gIdx2 = 0; gIdx2 < mountedGroups.length; gIdx2++) {
                    var g2 = mountedGroups[gIdx2];
                    var stickers2 = g2.stickers || [];
                    if (stickers2.length === 0) continue;
                    panelHtml += '<div class="cr-sticker-panel' + (gIdx2 === 0 ? ' active' : '') + '" data-gidx="' + gIdx2 + '">';
                    for (var si = 0; si < stickers2.length; si++) {
                        var s = stickers2[si];
                        panelHtml += '<div class="cr-sticker-item" data-url="' + escHtml(s.url) + '" data-name="' + escHtml(s.name || '') + '" title="' + escHtml(s.name || '') + '">' +
                            '<img src="' + escHtml(s.url) + '" alt="' + escHtml(s.name || '') + '" loading="lazy">' +
                            '</div>';
                    }
                    panelHtml += '</div>';
                }
                panelHtml += '</div>';

                bar.innerHTML = tabHtml + panelHtml;

                /* Tab 点击切换 */
                bar.querySelector('.cr-sticker-tabs').addEventListener('click', function (e) {
                    var tab = e.target.closest('.cr-sticker-tab');
                    if (!tab) return;
                    var idx = tab.getAttribute('data-gidx');
                    /* 切换 tab 激活态 */
                    var allTabs = bar.querySelectorAll('.cr-sticker-tab');
                    for (var t = 0; t < allTabs.length; t++) allTabs[t].classList.remove('active');
                    tab.classList.add('active');
                    /* 切换 panel 显示 */
                    var allPanels = bar.querySelectorAll('.cr-sticker-panel');
                    for (var pp = 0; pp < allPanels.length; pp++) allPanels[pp].classList.remove('active');
                    var target = bar.querySelector('.cr-sticker-panel[data-gidx="' + idx + '"]');
                    if (target) target.classList.add('active');
                });
            }

            /* 插入到 cr-bottom 最上方 */
            var crBottom = sub.querySelector('.cr-bottom');
            crBottom.insertBefore(bar, crBottom.firstChild);
            requestAnimationFrame(function () { bar.classList.add('open'); });

            /* 点击表情发送 */
            bar.addEventListener('click', function (e) {
                var item = e.target.closest('.cr-sticker-item');
                if (!item) return;
                var url = item.getAttribute('data-url');
                if (!url) return;

                /* 发送表情（作为图片消息） */
                var stickerText = '[表情包:' + url + ']';
                self.addChatMessage(sub, charId, 'user', stickerText);

                /* 关闭栏 */
                bar.classList.remove('open');
                setTimeout(function () { bar.remove(); }, 250);
                self._stickerBarOpen = false;
            });
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

                /* 引用条 */
                '<div class="cr-quote-bar" id="cr-quote-bar" style="display:none">' +
                '<div class="cr-quote-bar-text" id="cr-quote-bar-text"></div>' +
                '<button class="cr-quote-bar-close" id="cr-quote-bar-close">&times;</button>' +
                '</div>' +

                /* 多选操作栏 */
                '<div class="cr-multi-bar" id="cr-multi-bar" style="display:none">' +
                '<span class="cr-multi-info" id="cr-multi-info">已选 0 条</span>' +
                '<button class="cr-multi-del-btn" id="cr-multi-del-btn">删除选中</button>' +
                '<button class="cr-multi-exit-btn" id="cr-multi-exit-btn">取消</button>' +
                '</div>' +

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
                if (window.ChatRoomSettings) {
                    window.ChatRoomSettings.open(sub, charId);
                } else {
                    self.toast('聊天设置模块未加载');
                }
            });

            /* 表情包按钮 */
            sub.querySelector('#cr-emoji-btn').addEventListener('click', function () {
                self.openStickerBar(sub, charId);
            });

            /* 续写按钮 —— 触发 char 回复 */
            sub.querySelector('#cr-continue-btn').addEventListener('click', function () {
                self.triggerCharReply(sub, charId);
            });

            /* 关闭引用 */
            sub.querySelector('#cr-quote-bar-close').addEventListener('click', function () {
                self._quoteData = null;
                sub.querySelector('#cr-quote-bar').style.display = 'none';
            });

            /* 多选：删除选中 */
            sub.querySelector('#cr-multi-del-btn').addEventListener('click', function () {
                self.multiDeleteMsgs(sub, charId);
            });

            /* 多选：取消 */
            sub.querySelector('#cr-multi-exit-btn').addEventListener('click', function () {
                self.exitMultiSelect(sub);
            });

            /* 点击消息区空白关闭气泡菜单 */
            sub.querySelector('#cr-messages').addEventListener('click', function (e) {
                if (!e.target.closest('.cr-msg-bubble') && !e.target.closest('.cr-bubble-menu')) {
                    self.removeBubbleMenu(sub);
                }
            });

            /* 发送按钮 */
            sub.querySelector('#cr-send-btn').addEventListener('click', function () {
                var input = sub.querySelector('#cr-input');
                var text = input.value.trim();
                if (!text) return;

                /* 如果有引用，拼接引用前缀 */
                var sendText = text;
                if (self._quoteData) {
                    sendText = '【引用：' + self._quoteData.name + '「' + self._quoteData.text.substring(0, 50) + '」】\n' + text;
                    self._quoteData = null;
                    sub.querySelector('#cr-quote-bar').style.display = 'none';
                }

                self.addChatMessage(sub, charId, 'user', sendText);
                input.value = '';
                input.style.height = 'auto';

                /* 后台模式：发送后自动触发回复 */
                var _d = loadData();
                var _rc = (_d.roomConfig && _d.roomConfig[charId]) || {};
                if (_rc.backgroundMode) {
                    setTimeout(function () {
                        self.triggerBgReply(charId, sub);
                    }, 300);
                }
                /* 非后台模式：不自动续写，等用户点续写按钮 */
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

            /* 进入聊天室 → 清除消息列表未读红点 */
            var _dot = document.querySelector('[data-char-id="' + charId + '"] .bg-unread-dot');
            if (_dot) _dot.remove();

            /* 加载历史消息 */
            this.loadChatHistory(sub, charId);

            /* 加载聊天室壁纸 */
            loadBlob('_chat_room_wallpaper_' + charId, function (err, blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                var msgArea = sub.querySelector('#cr-messages');
                if (msgArea) {
                    msgArea.style.backgroundImage = 'url(' + url + ')';
                    msgArea.style.backgroundSize = 'cover';
                    msgArea.style.backgroundPosition = 'center';
                }
            });

            /* 如果有备注名，替换顶栏 */
            var roomCfg = (data.roomConfig && data.roomConfig[charId]) || {};
            if (roomCfg.remark) {
                var topName = sub.querySelector('.cr-topbar-name');
                if (topName) topName.textContent = roomCfg.remark;
            }
        },

        /* 内部状态 */
        _quoteData: null,
        _multiSelectMode: false,
        _multiSelected: [],
        _regenStyle: '',
        _bgTimers: {},      /* 后台模式定时器 charId→timer */
        _bgPending: {},          /* 后台回复防重 charId→bool */
        _proactiveTimer: null,   /* 主动发消息全局轮询计时器 */
        _autoSummaryPending: {}, /* 记忆自动总结防重 charId→bool */

        /* 将 LLM 回复中混合文字和表情包的段落拆成独立条目 */
        _splitStickerParagraphs: function (paragraphs) {
            var result = [];
            for (var i = 0; i < paragraphs.length; i++) {
                var t = paragraphs[i];
                /* 把 [表情包:URL] 从文本中拆分出来 */
                var parts = t.split(/(\[表情包:\s*https?:\/\/[^\]]+\])/);
                for (var j = 0; j < parts.length; j++) {
                    var part = parts[j].trim();
                    if (part) result.push(part);
                }
            }
            return result;
        },

        addChatMessage: function (sub, charId, role, text) {
            var self = this;
            var msgArea = sub.querySelector('#cr-messages');
            if (!msgArea) return;

            /* 存储消息 */
            var d = loadData();
            if (!d.chatHistory) d.chatHistory = {};
            if (!d.chatHistory[charId]) d.chatHistory[charId] = [];
            var idx = d.chatHistory[charId].length;
            d.chatHistory[charId].push({
                role: role,
                text: text,
                time: new Date().toISOString()
            });
            saveData(d);

            /* 渲染气泡 */
            var bubble = document.createElement('div');
            bubble.className = 'cr-msg cr-msg-' + role;
            bubble.setAttribute('data-msg-idx', idx);

            /* 检查是否撤回消息 */
            var msgObj = d.chatHistory[charId][idx];
            if (msgObj.recalled) {
                var who = role === 'user' ? '你' : '对方';
                bubble.className = 'cr-msg-recalled';
                bubble.textContent = who + ' 撤回了一条消息';
            } else {
                /* 检测表情包消息：兼容冒号后有空格、URL前后有多余文字的情况 */
                var stickerMatch = text.match(/^\s*\[表情包:\s*(https?:\/\/[^\]]+)\]\s*$/);
                if (stickerMatch) {
                    var stickerUrl = stickerMatch[1].trim();
                    var stickerBubble = document.createElement('div');
                    stickerBubble.className = 'cr-msg-bubble';
                    stickerBubble.style.cssText = 'background:transparent!important;padding:2px!important;box-shadow:none!important;border:none!important;';
                    var sImg = document.createElement('img');
                    sImg.src = stickerUrl;
                    sImg.className = 'cr-sticker-msg-img';
                    sImg.alt = '表情包';
                    stickerBubble.appendChild(sImg);
                    bubble.appendChild(stickerBubble);
                } else {
                    bubble.innerHTML = '<div class="cr-msg-bubble">' + escHtml(text) + '</div>';
                }
                bubble.addEventListener('click', function (e) {
                    if (self._multiSelectMode) {
                        self.toggleMultiSelect(sub, charId, idx);
                        return;
                    }
                    e.stopPropagation();
                    self.showBubbleMenu(sub, charId, idx, e);
                });
            }
            msgArea.appendChild(bubble);
            msgArea.scrollTop = msgArea.scrollHeight;

            /* ====== 自动翻译（跳过表情包消息） ====== */
            if (role === 'char' && !msgObj.recalled && !/^\[表情包:/.test(text)) {
                self.tryAutoTranslate(sub, charId, bubble, text);
            }

            /* ====== 每10条自动记忆总结 ====== */
            /* 延迟执行避免阻塞渲染 */
            setTimeout(function () {
                self._checkAutoMemorySummary(charId);
            }, 2000);
        },

        /* 添加多条气泡（char 回复拆分段落用） */
        addChatBubbles: function (sub, charId, role, paragraphs) {
            for (var i = 0; i < paragraphs.length; i++) {
                var text = paragraphs[i].trim();
                if (!text) continue;
                this.addChatMessage(sub, charId, role, text);
            }
        },

        /* ====== 后台模式回复（无需 DOM，仅存储+通知） ====== */
        triggerBgReply: function (charId, sub) {
            var self = this;

            /* 防止同一 char 重复调用 */
            if (self._bgPending[charId]) return;
            self._bgPending[charId] = true;

            /* 读取角色和历史 */
            var data = loadData();
            var chars = data.characters || [];
            var char = null;
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].id === charId) { char = chars[i]; break; }
            }
            if (!char) { self._bgPending[charId] = false; return; }

            var history = (data.chatHistory && data.chatHistory[charId]) || [];
            if (history.length === 0) { self._bgPending[charId] = false; return; }

            var roomCfg = (data.roomConfig && data.roomConfig[charId]) || {};

            /* 构建 system prompt（复用 triggerCharReply 的 prompt 逻辑） */
            var userPersona = '';
            var activeUserCharId = roomCfg.mountedUserCharId || data.activeCharId || '';
            var userName = '用户';
            var userNickname = '';
            if (activeUserCharId) {
                for (var u = 0; u < chars.length; u++) {
                    if (chars[u].id === activeUserCharId) {
                        userName = chars[u].name || '用户';
                        userNickname = chars[u].nickname || '';
                        userPersona = chars[u].detail || '';
                        break;
                    }
                }
            }

            var charName = char.name || '未知';

            /* ── 完整 system prompt，与 triggerCharReply 保持一致 ── */
            var sysPrompt = '';

            sysPrompt += '# 核心指令\n';
            sysPrompt += '你是「' + charName + '」，正在通过手机App与「' + userName + '」进行线上文字聊天。\n';
            sysPrompt += '【场景定性——极其重要】你们两人此刻不在同一物理空间，这是一次纯粹的线上聊天，就像现实中两个人用微信/短信互发消息一样。\n';
            sysPrompt += '你只能"发消息"——发文字、发表情。你没有身体在对方面前，你无法做出任何线下物理动作。\n';
            sysPrompt += '你必须始终以「' + charName + '」的身份说话。你不是AI，你不是语言模型，你就是这个角色本人。\n';
            sysPrompt += '绝对禁止跳出角色、绝对禁止以第三人称谈论自己、绝对禁止承认自己是AI。\n\n';

            sysPrompt += '# 角色完整档案\n';
            sysPrompt += '## 基本信息\n';
            sysPrompt += '- 角色全名：' + charName + '\n';
            if (char.nickname && char.nickname !== char.name) {
                sysPrompt += '- 小名/外号：' + char.nickname + '（这只是' + userName + '给你起的小名或外号，你的真实全名仍然是「' + charName + '」）\n';
            }

            if (char.gender === 'male') {
                sysPrompt += '- 性别：男性 ♂\n';
                sysPrompt += '- 性别认知强制要求：你是一名男性。你的自我认知、行为举止、语气措辞、自称代词必须完全符合男性角色。绝对禁止出现任何女性化的语气词、撒娇方式或自称。\n';
            } else if (char.gender === 'female') {
                sysPrompt += '- 性别：女性 ♀\n';
                sysPrompt += '- 性别认知强制要求：你是一名女性。你的自我认知、行为举止、语气措辞、自称代词必须完全符合女性角色。你的说话方式应自然体现女性特质。\n';
            } else {
                sysPrompt += '- 性别：' + (char.gender || '未指定') + '（请根据详细人设中的描述来判断）\n';
            }

            if (char.mood) sysPrompt += '- 当前心情：' + char.mood + '\n';

            if (char.detail) {
                sysPrompt += '\n## 详细人设（最重要，必须严格遵守）\n';
                sysPrompt += '以下是你的完整角色设定，包含你的性格、背景、喜好、说话方式、口癖、习惯等。你在对话中的每一句话、每一个反应都必须与以下设定完全一致：\n\n';
                sysPrompt += char.detail + '\n\n';
                sysPrompt += '【重要提醒】以上人设信息是你扮演这个角色的根本依据。你必须：\n';
                sysPrompt += '- 完全内化这些特征，而不只是表面模仿\n';
                sysPrompt += '- 如果设定中提到了特定的说话方式、口癖、语气词，你必须在回复中自然地使用它们\n';
                sysPrompt += '- 如果设定中提到了性格特征，你的回复情绪、态度必须与之一致\n';
                sysPrompt += '- 如果设定中提到了对' + userName + '的关系或态度，你必须在对话中体现出来\n';
                sysPrompt += '- 如果设定中有任何禁忌、不喜欢的事物，你遇到相关话题时必须表现出真实反应\n';
            } else {
                sysPrompt += '\n## 详细人设\n（该角色暂未设定详细信息，请根据角色名字和性别自由发挥一个合理的人格）\n';
            }

            sysPrompt += '\n# 你的对话对象\n';
            sysPrompt += '你正在和以下这个人聊天，请根据对方的信息来调整你的称呼和互动方式：\n\n';
            if (userPersona) {
                sysPrompt += '- 名字：' + userName + '\n';
                if (userNickname) sysPrompt += '- 昵称/别名：' + userNickname + '\n';
                sysPrompt += '- 对方的详细信息：\n' + userPersona + '\n';
            } else {
                sysPrompt += '- 名字：' + userName + '（对方未设置详细信息，请以自然友好的方式互动）\n';
            }

            sysPrompt += '\n# 回复格式要求\n';
            sysPrompt += '1. 始终保持角色扮演，不要跳出角色，不要用第三人称描述自己。\n';
            sysPrompt += '2. 根据你的性格和说话方式来回复，如果有口癖一定要体现。\n';
            sysPrompt += '3. 回复自然流畅，像真人在手机上聊天一样，避免过于书面化。\n';
            sysPrompt += '4. 如果想表达多个意思，可以用两个换行分成多段（每段会显示为独立的消息气泡）。\n';
            sysPrompt += '5. 不要加任何角色名前缀如「' + charName + '：」，直接说内容。\n';
            sysPrompt += '6. 绝对不要使用markdown格式（不要用**加粗**、不要用标题符号#、不要用列表符号-）。\n';
            sysPrompt += '7. 绝对不要输出任何元分析、角色分析、思考过程等元内容。你只输出角色说的话。\n';
            sysPrompt += '8. 称呼对方时请使用「' + (userNickname || userName) + '」或你们关系中合适的称呼，不要叫"用户"。\n';
            sysPrompt += '9. 注意聊天语境的连贯性，记住之前对话的内容，不要重复提问或遗忘已知信息。\n';
            sysPrompt += '10. 严格禁止使用括号描写动作或心理活动，例如禁止（微笑）、（歪头）等。\n';
            sysPrompt += '11. 回复长度应根据话题自然调节：闲聊可以简短（1-3句），深入话题可以稍长，但避免过长独白。\n';
            sysPrompt += '12. 要有真实的情感波动，不要每句话都很积极或中性，应根据话题内容表现出相应的情绪。\n';

            /* 注入表情包能力说明 */
            var _stickerGroups = (data.stickerGroups || []);
            var _roomMounted = (roomCfg.mountedStickers || []);
            var _availableStickers = [];
            for (var _sgi = 0; _sgi < _stickerGroups.length; _sgi++) {
                if (_roomMounted.indexOf(_stickerGroups[_sgi].id) !== -1) {
                    _availableStickers.push(_stickerGroups[_sgi]);
                }
            }
            if (_availableStickers.length > 0) {
                sysPrompt += '\n# 表情包发送能力\n';
                sysPrompt += '你可以在聊天中主动发送表情包图片。以下是当前可用的表情包分组和图片列表：\n';
                for (var _agi = 0; _agi < _availableStickers.length; _agi++) {
                    var _ag = _availableStickers[_agi];
                    sysPrompt += '\n【' + _ag.name + '】分组：\n';
                    var _stickers = _ag.stickers || [];
                    for (var _sti = 0; _sti < _stickers.length; _sti++) {
                        var _st = _stickers[_sti];
                        sysPrompt += '- ' + (_st.name || ('表情' + (_sti + 1))) + '：[表情包:' + _st.url + ']\n';
                    }
                }
                sysPrompt += '\n发送规则：\n';
                sysPrompt += '- 当你想发送表情包时，在回复中直接输出对应的 [表情包:URL] 格式标记，该标记会自动渲染为图片。\n';
                sysPrompt += '- [表情包:URL] 标记必须单独占一段（前后用空行隔开），不能混在文字句子里。\n';
                sysPrompt += '- 你可以先发文字再发表情包，也可以只发表情包，模拟真实聊天发图的感觉。\n';
                sysPrompt += '- 不要每条回复都发表情包，要在情绪到位时自然地使用，频率控制在合适范围。\n';
                sysPrompt += '- 绝对不要编造不在列表中的表情包URL，只能使用上方列表中提供的URL。\n';
            }

            /* 时间感知注入 */
            if (roomCfg.timeAware && roomCfg.timezone) {
                var now = new Date();
                var tzName = roomCfg.timezone;
                var timeStr = '';
                try {
                    timeStr = now.toLocaleString('zh-CN', { timeZone: tzName, hour12: false });
                } catch (e) {
                    timeStr = now.toISOString();
                }
                sysPrompt += '\n# 时间感知（角色必须遵守）\n';
                sysPrompt += '当前时间（' + tzName + '）：' + timeStr + '\n';
                sysPrompt += '你必须根据这个时间来调整回复内容。例如：深夜应该表现出困意、早上应该打招呼等。\n';
            }

            /* 记忆总结注入 */
            if (roomCfg.memorySummary) {
                sysPrompt += '\n# 长期记忆摘要\n';
                sysPrompt += '以下是你和对方过去聊天的记忆总结，请在对话中自然地运用这些信息：\n';
                sysPrompt += roomCfg.memorySummary + '\n';
            }

            var messages = [{ role: 'system', content: sysPrompt }];
            var recentHistory = history.slice(-40);
            for (var h = 0; h < recentHistory.length; h++) {
                messages.push({
                    role: recentHistory[h].role === 'user' ? 'user' : 'assistant',
                    content: recentHistory[h].text
                });
            }

            /* 判断聊天窗口是否正在展示 */
            var isInRoom = sub && sub.classList.contains('open');

            /* 后台调用 LLM */
            self.callLLM(messages, function (err, reply) {
                self._bgPending[charId] = false;

                if (err || !reply || !reply.trim()) return;

                /* 拆分段落 */
                var paragraphs = reply.split(/\n{2,}/);
                var filtered = [];
                for (var p = 0; p < paragraphs.length; p++) {
                    var t = paragraphs[p].trim();
                    if (t) filtered.push(t);
                }
                if (filtered.length === 0) filtered = [reply.trim()];
                /* 二次拆分：把混在段落里的 [表情包:URL] 分离成独立条目 */
                filtered = self._splitStickerParagraphs(filtered);

                var lastText = filtered[filtered.length - 1];

                if (isInRoom) {
                    /* ── 用户正在聊天室内：直接渲染气泡，不弹通知 ── */
                    for (var ri = 0; ri < filtered.length; ri++) {
                        self.addChatMessage(sub, charId, 'char', filtered[ri]);
                    }
                } else {
                    /* ── 用户不在聊天室：存入历史 + 弹出通知横幅 ── */
                    var d2 = loadData();
                    if (!d2.chatHistory) d2.chatHistory = {};
                    if (!d2.chatHistory[charId]) d2.chatHistory[charId] = [];

                    for (var fi = 0; fi < filtered.length; fi++) {
                        d2.chatHistory[charId].push({
                            role: 'char',
                            text: filtered[fi],
                            time: new Date().toISOString()
                        });
                    }
                    saveData(d2);

                    /* 更新消息列表未读数/预览（刷新消息页） */
                    self._refreshMsgList(charId);

                    /* 弹出通知横幅 */
                    self.showBgNotification(charId, char, lastText);
                }
            });
        },

        /* ====== 刷新消息列表预览 ====== */
        _refreshMsgList: function (charId) {
            /* 如果当前在消息列表页，刷新预览 */
            var msgList = document.querySelector('#chat-msg-list');
            if (!msgList) return;
            var item = msgList.querySelector('[data-char-id="' + charId + '"]');
            if (!item) return;
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            var last = msgs.length > 0 ? msgs[msgs.length - 1].text : '';
            var previewEl = item.querySelector('.chat-msg-item-preview');
            if (previewEl) previewEl.textContent = last;

            /* 更新时间 */
            var timeEl = item.querySelector('.chat-msg-item-time');
            if (timeEl) {
                var now = new Date();
                timeEl.textContent = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
            }

            /* 添加未读红点 */
            var avatarEl = item.querySelector('.chat-msg-item-avatar');
            if (avatarEl && !avatarEl.querySelector('.bg-unread-dot')) {
                var dot = document.createElement('span');
                dot.className = 'bg-unread-dot';
                avatarEl.appendChild(dot);
            }
        },

        /* ====== 后台通知横幅 ====== */
        showBgNotification: function (charId, char, text) {
            var self = this;

            /* 找到挂载容器 —— phone-container */
            var container = document.getElementById('phone-container');
            if (!container) return;

            /* 移除已有通知 */
            var existing = container.querySelector('.bg-notify');
            if (existing) existing.remove();

            /* 读取头像 */
            var avatarHtml = '<div class="bg-notify-avatar-placeholder"><svg viewBox="0 0 24 24" width="20" height="20" stroke="#bbb" stroke-width="1.2" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';

            var notify = document.createElement('div');
            notify.className = 'bg-notify';
            notify.innerHTML =
                '<div class="bg-notify-inner">' +
                '<div class="bg-notify-left">' +
                '<div class="bg-notify-avatar" id="bg-nav-av-' + charId + '">' + avatarHtml + '</div>' +
                '<div class="bg-notify-content">' +
                '<div class="bg-notify-name">' + escHtml(char.name) + '</div>' +
                '<div class="bg-notify-text">' + escHtml(text.length > 40 ? text.substring(0, 40) + '…' : text) + '</div>' +
                '</div>' +
                '</div>' +
                '<div class="bg-notify-right">' +
                '<button class="bg-notify-reply-btn" id="bg-notify-reply">回复</button>' +
                '</div>' +
                '</div>';

            container.appendChild(notify);

            /* 加载头像 */
            loadBlob(KEY_CHAR_AVATAR_PREFIX + charId, function (err, blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                var avEl = notify.querySelector('#bg-nav-av-' + charId);
                if (avEl) avEl.innerHTML = '<img src="' + url + '" alt="">';
            });

            /* 动画入场 */
            requestAnimationFrame(function () {
                notify.classList.add('bg-notify-show');
            });

            /* 点击通知 → 打开聊天室 */
            notify.addEventListener('click', function (e) {
                if (e.target.closest('#bg-notify-reply')) return; /* 让回复按钮单独处理 */
                self._dismissNotify(notify);
                /* 确保 ChatApp 已打开 */
                if (!self.el || !self.el.classList.contains('open')) {
                    self.open();
                }
                setTimeout(function () {
                    self.openChatRoom(charId);
                }, self.el && self.el.classList.contains('open') ? 0 : 350);
            });

            /* 回复按钮 → 打开聊天室并聚焦输入框 */
            notify.querySelector('#bg-notify-reply').addEventListener('click', function () {
                self._dismissNotify(notify);
                if (!self.el || !self.el.classList.contains('open')) {
                    self.open();
                }
                setTimeout(function () {
                    self.openChatRoom(charId);
                    /* 再延迟一点聚焦输入框 */
                    setTimeout(function () {
                        var inputEl = document.querySelector('#cr-input');
                        if (inputEl) inputEl.focus();
                    }, 400);
                }, self.el && self.el.classList.contains('open') ? 0 : 350);
            });

            /* 4秒后自动消失 */
            var autoTimer = setTimeout(function () {
                self._dismissNotify(notify);
            }, 4000);

            /* 向上滑动手动关闭 */
            var startY = 0;
            notify.addEventListener('touchstart', function (e) {
                startY = e.touches[0].clientY;
            }, { passive: true });
            notify.addEventListener('touchend', function (e) {
                var dy = e.changedTouches[0].clientY - startY;
                if (dy < -30) {
                    clearTimeout(autoTimer);
                    self._dismissNotify(notify);
                }
            }, { passive: true });
        },

        _dismissNotify: function (notify) {
            if (!notify || !notify.parentNode) return;
            notify.classList.remove('bg-notify-show');
            notify.classList.add('bg-notify-hide');
            setTimeout(function () {
                if (notify.parentNode) notify.remove();
            }, 350);
        },

        /* ================================================
   角色主动发消息引擎
   每60秒轮询一次所有开启 proactiveMsg 的角色：
   - 距最后一条消息 >= 1小时 → 主动发一条
   - 发完后重置时间戳，下次再等1小时
   ================================================ */
        startProactiveEngine: function () {
            var self = this;
            if (self._proactiveTimer) return; /* 防重启 */

            function tick() {
                var data = loadData();
                var chars = data.characters || [];
                var roomConfigs = data.roomConfig || {};
                var now = Date.now();
                var ONE_HOUR = 60 * 60 * 1000;

                for (var i = 0; i < chars.length; i++) {
                    var char = chars[i];
                    if (char.type === 'user') continue; /* 跳过用户人设 */

                    var charId = char.id;
                    var rc = roomConfigs[charId] || {};
                    if (!rc.proactiveMsg) continue; /* 未开启则跳过 */

                    /* 检查距最后消息的时间 */
                    var history = (data.chatHistory && data.chatHistory[charId]) || [];
                    if (history.length === 0) continue; /* 没有任何聊天记录则跳过 */

                    /* 找到最后一条消息的时间 */
                    var lastMsg = history[history.length - 1];
                    var lastTime = lastMsg.time ? new Date(lastMsg.time).getTime() : 0;
                    if (!lastTime) continue;

                    var elapsed = now - lastTime;
                    if (elapsed < ONE_HOUR) continue; /* 不足1小时，跳过 */

                    /* 防重：该角色正在生成中则跳过 */
                    if (self._bgPending[charId]) continue;

                    /* 触发主动发消息 */
                    self._sendProactiveMessage(char, charId, rc, history, data);
                }
            }

            /* 立即执行一次，然后每60秒执行一次 */
            tick();
            self._proactiveTimer = setInterval(tick, 60 * 1000);
        },

        stopProactiveEngine: function () {
            if (this._proactiveTimer) {
                clearInterval(this._proactiveTimer);
                this._proactiveTimer = null;
            }
        },

        _sendProactiveMessage: function (char, charId, roomCfg, history, data) {
            var self = this;
            self._bgPending[charId] = true;

            var chars = data.characters || [];
            var charName = char.name || '未知';

            /* 获取 user 信息 */
            var userPersona = '';
            var userName = '用户';
            var userNickname = '';
            var activeUserCharId = roomCfg.mountedUserCharId || data.activeCharId || '';
            if (activeUserCharId) {
                for (var u = 0; u < chars.length; u++) {
                    if (chars[u].id === activeUserCharId) {
                        userName = chars[u].name || '用户';
                        userNickname = chars[u].nickname || '';
                        userPersona = chars[u].detail || '';
                        break;
                    }
                }
            }

            /* 计算已沉默多久 */
            var lastMsg = history[history.length - 1];
            var lastTime = lastMsg.time ? new Date(lastMsg.time).getTime() : 0;
            var silentMinutes = Math.floor((Date.now() - lastTime) / 60000);
            var silentDesc = silentMinutes >= 120
                ? Math.floor(silentMinutes / 60) + '小时'
                : silentMinutes + '分钟';

            /* 构建完整 system prompt（与 triggerCharReply 一致） */
            var sysPrompt = '';
            sysPrompt += '# 核心指令\n';
            sysPrompt += '你是「' + charName + '」，正在通过手机App与「' + userName + '」进行线上文字聊天。\n';
            sysPrompt += '【场景定性——极其重要】你们两人此刻不在同一物理空间，这是一次纯粹的线上聊天，就像现实中两个人用微信/短信互发消息一样。\n';
            sysPrompt += '你只能"发消息"——发文字、发表情。你没有身体在对方面前，你无法做出任何线下物理动作。\n';
            sysPrompt += '你必须始终以「' + charName + '」的身份说话。你不是AI，你不是语言模型，你就是这个角色本人。\n';
            sysPrompt += '绝对禁止跳出角色、绝对禁止以第三人称谈论自己、绝对禁止承认自己是AI。\n\n';

            sysPrompt += '# 角色完整档案\n';
            sysPrompt += '## 基本信息\n';
            sysPrompt += '- 角色全名：' + charName + '\n';
            if (char.nickname && char.nickname !== char.name) {
                sysPrompt += '- 小名/外号：' + char.nickname + '（这只是' + userName + '给你起的小名或外号，你的真实全名仍然是「' + charName + '」）\n';
            }
            if (char.gender === 'male') {
                sysPrompt += '- 性别：男性 ♂\n';
                sysPrompt += '- 性别认知强制要求：你是一名男性。你的自我认知、行为举止、语气措辞、自称代词必须完全符合男性角色。绝对禁止出现任何女性化的语气词、撒娇方式或自称。\n';
            } else if (char.gender === 'female') {
                sysPrompt += '- 性别：女性 ♀\n';
                sysPrompt += '- 性别认知强制要求：你是一名女性。你的自我认知、行为举止、语气措辞、自称代词必须完全符合女性角色。你的说话方式应自然体现女性特质。\n';
            } else {
                sysPrompt += '- 性别：' + (char.gender || '未指定') + '（请根据详细人设中的描述来判断）\n';
            }
            if (char.mood) sysPrompt += '- 当前心情：' + char.mood + '\n';

            if (char.detail) {
                sysPrompt += '\n## 详细人设（最重要，必须严格遵守）\n';
                sysPrompt += '以下是你的完整角色设定，包含你的性格、背景、喜好、说话方式、口癖、习惯等。你在对话中的每一句话、每一个反应都必须与以下设定完全一致：\n\n';
                sysPrompt += char.detail + '\n\n';
                sysPrompt += '【重要提醒】以上人设信息是你扮演这个角色的根本依据。你必须：\n';
                sysPrompt += '- 完全内化这些特征，而不只是表面模仿\n';
                sysPrompt += '- 如果设定中提到了特定的说话方式、口癖、语气词，你必须在回复中自然地使用它们\n';
                sysPrompt += '- 如果设定中提到了性格特征，你的回复情绪、态度必须与之一致\n';
                sysPrompt += '- 如果设定中提到了对' + userName + '的关系或态度，你必须在对话中体现出来\n';
                sysPrompt += '- 如果设定中有任何禁忌、不喜欢的事物，你遇到相关话题时必须表现出真实反应\n';
            } else {
                sysPrompt += '\n## 详细人设\n（该角色暂未设定详细信息，请根据角色名字和性别自由发挥一个合理的人格）\n';
            }

            sysPrompt += '\n# 你的对话对象\n';
            sysPrompt += '你正在和以下这个人聊天，请根据对方的信息来调整你的称呼和互动方式：\n\n';
            if (userPersona) {
                sysPrompt += '- 名字：' + userName + '\n';
                if (userNickname) sysPrompt += '- 昵称/别名：' + userNickname + '\n';
                sysPrompt += '- 对方的详细信息：\n' + userPersona + '\n';
            } else {
                sysPrompt += '- 名字：' + userName + '（对方未设置详细信息，请以自然友好的方式互动）\n';
            }

            sysPrompt += '\n# 回复格式要求\n';
            sysPrompt += '1. 始终保持角色扮演，不要跳出角色，不要用第三人称描述自己。\n';
            sysPrompt += '2. 根据你的性格和说话方式来回复，如果有口癖一定要体现。\n';
            sysPrompt += '3. 回复自然流畅，像真人在手机上聊天一样，避免过于书面化。\n';
            sysPrompt += '4. 如果想表达多个意思，可以用两个换行分成多段（每段会显示为独立的消息气泡）。\n';
            sysPrompt += '5. 不要加任何角色名前缀如「' + charName + '：」，直接说内容。\n';
            sysPrompt += '6. 绝对不要使用markdown格式（不要用**加粗**、不要用标题符号#、不要用列表符号-）。\n';
            sysPrompt += '7. 绝对不要输出任何元分析、角色分析、思考过程等元内容。你只输出角色说的话。\n';
            sysPrompt += '8. 称呼对方时请使用「' + (userNickname || userName) + '」或你们关系中合适的称呼，不要叫"用户"。\n';
            sysPrompt += '9. 注意聊天语境的连贯性，记住之前对话的内容，不要重复提问或遗忘已知信息。\n';
            sysPrompt += '10. 严格禁止使用括号描写动作或心理活动，例如禁止（微笑）、（歪头）等。\n';
            sysPrompt += '11. 回复长度应根据话题自然调节：闲聊可以简短（1-3句），深入话题可以稍长，但避免过长独白。\n';
            sysPrompt += '12. 要有真实的情感波动，不要每句话都很积极或中性，应根据话题内容表现出相应的情绪。\n';

            /* 主动发消息特殊指令 */
            sysPrompt += '\n# 主动发消息指令（本次特别要求）\n';
            sysPrompt += '你现在要【主动】给「' + (userNickname || userName) + '」发一条消息。\n';
            sysPrompt += '原因：距离你们上次聊天已经过了' + silentDesc + '，你想主动联系对方。\n';
            sysPrompt += '要求：\n';
            sysPrompt += '- 这条消息必须完全符合你的人设和性格，禁止OOC\n';
            sysPrompt += '- 内容要自然，像真实的人在主动发消息一样，不能像系统通知\n';
            sysPrompt += '- 可以是问候、分享心情、想到某件事、提到上次的话题等\n';
            sysPrompt += '- 参考最近的聊天记录来决定发什么内容，保持语境连贯\n';
            sysPrompt += '- 不要解释"我来主动找你"之类的，直接自然地说内容\n';
            sysPrompt += '- 绝对不要说"作为AI..."或任何出戏的内容\n';

            /* 时间感知 */
            if (roomCfg.timeAware && roomCfg.timezone) {
                try {
                    var timeStr = new Date().toLocaleString('zh-CN', { timeZone: roomCfg.timezone, hour12: false });
                    sysPrompt += '\n# 时间感知\n当前时间（' + roomCfg.timezone + '）：' + timeStr + '\n';
                    sysPrompt += '根据时间调整发消息的内容和语气（深夜/早晨/午后等）。\n';
                } catch (e) { }
            }

            /* 记忆总结 */
            if (roomCfg.memorySummary) {
                sysPrompt += '\n# 长期记忆摘要\n以下是你和对方过去聊天的记忆总结，请在发消息时自然运用：\n';
                sysPrompt += roomCfg.memorySummary + '\n';
            }

            /* 构建 messages：system + 最近40条历史（不加 user 占位，让 char 直接回） */
            var messages = [{ role: 'system', content: sysPrompt }];
            var recentHistory = history.slice(-40);
            for (var h = 0; h < recentHistory.length; h++) {
                messages.push({
                    role: recentHistory[h].role === 'user' ? 'user' : 'assistant',
                    content: recentHistory[h].text
                });
            }
            /* 加一条系统提示消息触发主动发言 */
            messages.push({
                role: 'user',
                content: '[系统：' + silentDesc + '未收到消息，请以角色身份主动发一条消息]'
            });

            self.callLLM(messages, function (err, reply) {
                self._bgPending[charId] = false;
                if (err || !reply || !reply.trim()) return;

                /* 过滤掉明显出戏的回复 */
                var cleaned = reply.trim();
                if (cleaned.indexOf('[系统') === 0 || cleaned.indexOf('作为AI') !== -1) return;

                /* 拆分段落 */
                var paragraphs = cleaned.split(/\n{2,}/);
                var filtered = [];
                for (var p = 0; p < paragraphs.length; p++) {
                    var t = paragraphs[p].trim();
                    if (t) filtered.push(t);
                }
                if (filtered.length === 0) filtered = [cleaned];
                /* 二次拆分：把混在段落里的 [表情包:URL] 分离成独立条目 */
                filtered = self._splitStickerParagraphs(filtered);

                /* 存入历史（不操作DOM） */
                var d2 = loadData();
                if (!d2.chatHistory) d2.chatHistory = {};
                if (!d2.chatHistory[charId]) d2.chatHistory[charId] = [];
                var lastText = filtered[filtered.length - 1];
                for (var fi = 0; fi < filtered.length; fi++) {
                    d2.chatHistory[charId].push({
                        role: 'char',
                        text: filtered[fi],
                        time: new Date().toISOString()
                    });
                }
                saveData(d2);

                /* 刷新消息列表 */
                self._refreshMsgList(charId);

                /* 弹出通知 */
                self.showBgNotification(charId, char, lastText);
            });
        },

        /* ================================================
           每10条消息自动触发记忆总结
           ================================================ */
        _checkAutoMemorySummary: function (charId) {
            var self = this;
            if (self._autoSummaryPending[charId]) return;

            var data = loadData();
            var history = (data.chatHistory && data.chatHistory[charId]) || [];
            var roomCfg = (data.roomConfig && data.roomConfig[charId]) || {};

            /* 每10条触发一次：检查总数是否是10的倍数 */
            if (history.length === 0 || history.length % 10 !== 0) return;

            self._autoSummaryPending[charId] = true;

            /* 取最近60条（最多）来总结 */
            var toSummarize = history.slice(-60);

            var chars = data.characters || [];
            var charName = '角色';
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].id === charId) { charName = chars[i].name || '角色'; break; }
            }

            /* 把已有的记忆总结也带进去，做增量更新 */
            var existingSummary = roomCfg.memorySummary || '';

            var historyText = toSummarize.map(function (m) {
                return (m.role === 'user' ? '用户' : charName) + '：' + m.text;
            }).join('\n');

            var summaryMsgs = [
                {
                    role: 'system',
                    content: '你是一个专业的记忆总结助手。你的任务是将聊天记录总结为结构化的记忆摘要，供角色在未来对话中参考。\n\n总结要求：\n1. 提取关键事件、情感变化、重要约定、对话中透露的信息\n2. 记录用户的喜好、习惯、特征\n3. 记录两人关系的发展状态\n4. 用简洁的要点格式，每点一行\n5. 不超过400字\n6. 用中文输出\n7. 如果有旧的记忆总结，请整合进去，去掉重复，保留重要信息'
                },
                {
                    role: 'user',
                    content: (existingSummary ? '【现有记忆总结】\n' + existingSummary + '\n\n【新的聊天记录（最近' + toSummarize.length + '条）】\n' : '【聊天记录】\n') + historyText + '\n\n请输出更新后的完整记忆总结：'
                }
            ];

            self.callLLM(summaryMsgs, function (err, reply) {
                self._autoSummaryPending[charId] = false;
                if (err || !reply || !reply.trim()) return;

                var newSummary = reply.trim();
                var d2 = loadData();
                if (!d2.roomConfig) d2.roomConfig = {};
                if (!d2.roomConfig[charId]) d2.roomConfig[charId] = {};
                d2.roomConfig[charId].memorySummary = newSummary;
                saveData(d2);

                /* 如果设置面板当前打开着，刷新面板中的记忆文本框 */
                var memEl = document.querySelector('#crs-memory');
                if (memEl) {
                    memEl.value = newSummary;
                    memEl.style.height = 'auto';
                    memEl.style.height = Math.min(memEl.scrollHeight, 400) + 'px';
                }
            });
        },

        loadChatHistory: function (sub, charId) {
            var self = this;
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            var msgArea = sub.querySelector('#cr-messages');
            if (!msgArea || msgs.length === 0) return;

            for (var i = 0; i < msgs.length; i++) {
                var bubble = document.createElement('div');
                bubble.setAttribute('data-msg-idx', i);

                if (msgs[i].recalled) {
                    var who = msgs[i].role === 'user' ? '你' : '对方';
                    bubble.className = 'cr-msg-recalled';
                    bubble.textContent = who + ' 撤回了一条消息';
                } else {
                    bubble.className = 'cr-msg cr-msg-' + msgs[i].role;
                    var _histStickerMatch = msgs[i].text.match(/^\[表情包:([\s\S]*?)\]$/);
                    if (_histStickerMatch) {
                        var _histBubble = document.createElement('div');
                        _histBubble.className = 'cr-msg-bubble';
                        _histBubble.style.cssText = 'background:transparent!important;padding:2px!important;box-shadow:none!important;border:none!important;';
                        var _histImg = document.createElement('img');
                        _histImg.src = _histStickerMatch[1];
                        _histImg.className = 'cr-sticker-msg-img';
                        _histImg.alt = '表情包';
                        _histBubble.appendChild(_histImg);
                        bubble.appendChild(_histBubble);
                    } else {
                        bubble.innerHTML = '<div class="cr-msg-bubble">' + escHtml(msgs[i].text) + '</div>';
                    }

                    /* 历史记录中已缓存的翻译，直接恢复显示 */
                    if (msgs[i].role === 'char' && msgs[i].translation) {
                        var transDiv = document.createElement('div');
                        transDiv.className = 'cr-translation cr-translation-done';
                        transDiv.innerHTML =
                            '<div class="cr-trans-text">' + escHtml(msgs[i].translation) + '</div>' +
                            '<div class="cr-trans-credit">' +
                            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
                            ' 由灵机提供翻译支持</div>';
                        bubble.appendChild(transDiv);
                    }

                    (function (idx) {
                        bubble.addEventListener('click', function (e) {
                            if (self._multiSelectMode) {
                                self.toggleMultiSelect(sub, charId, idx);
                                return;
                            }
                            e.stopPropagation();
                            self.showBubbleMenu(sub, charId, idx, e);
                        });
                    })(i);
                }
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


        /* ====== 气泡菜单 ====== */
        showBubbleMenu: function (sub, charId, idx, ev) {
            var self = this;
            this.removeBubbleMenu(sub);

            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            var m = msgs[idx];
            if (!m || m.recalled) return;

            var msgArea = sub.querySelector('#cr-messages');
            var rect = msgArea.getBoundingClientRect();
            var x = ev.clientX - rect.left;
            var y = ev.clientY - rect.top + msgArea.scrollTop;

            var panel = document.createElement('div');
            panel.className = 'cr-bubble-menu';
            panel.id = 'cr-bubble-menu';
            panel.style.position = 'absolute';
            panel.style.zIndex = '860';

            /* 菜单项 */
            var items = '';

            /* 重回 — 仅 char 消息 */
            if (m.role === 'char') {
                items += '<div class="cr-bubble-menu-item" data-action="regen">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
                    '<span>重回</span></div>';
            }

            /* 编辑 */
            items += '<div class="cr-bubble-menu-item" data-action="edit">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
                '<span>编辑</span></div>';

            /* 删除 */
            items += '<div class="cr-bubble-menu-item cr-menu-danger" data-action="delete">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
                '<span>删除</span></div>';

            /* 撤回 */
            items += '<div class="cr-bubble-menu-item" data-action="recall">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' +
                '<span>撤回</span></div>';

            /* 引用 */
            items += '<div class="cr-bubble-menu-item" data-action="quote">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
                '<span>引用</span></div>';

            /* 多选 */
            items += '<div class="cr-bubble-menu-item" data-action="multiselect">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="9 11 12 14 22 4"/></svg>' +
                '<span>多选</span></div>';

            panel.innerHTML = items;

            /* 定位 */
            msgArea.style.position = 'relative';
            var menuW = 140, menuH = (m.role === 'char' ? 6 : 5) * 40;
            if (x + menuW > msgArea.clientWidth) x = msgArea.clientWidth - menuW - 10;
            if (x < 10) x = 10;
            if (y + menuH > msgArea.scrollTop + msgArea.clientHeight) y = y - menuH;
            if (y < msgArea.scrollTop + 10) y = msgArea.scrollTop + 10;
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';

            msgArea.appendChild(panel);

            /* 事件委托 */
            panel.addEventListener('click', function (e) {
                var item = e.target.closest('.cr-bubble-menu-item');
                if (!item) return;
                var action = item.getAttribute('data-action');
                self.removeBubbleMenu(sub);

                switch (action) {
                    case 'regen': self.regenReply(sub, charId, idx); break;
                    case 'edit': self.editMsg(sub, charId, idx); break;
                    case 'delete': self.deleteMsg(sub, charId, idx); break;
                    case 'recall': self.recallMsg(sub, charId, idx); break;
                    case 'quote': self.quoteMsg(sub, charId, idx); break;
                    case 'multiselect': self.enterMultiSelect(sub, charId, idx); break;
                }
            });

            /* 延迟添加全局关闭 */
            setTimeout(function () {
                document.addEventListener('click', function handler() {
                    self.removeBubbleMenu(sub);
                    document.removeEventListener('click', handler);
                });
            }, 10);
        },

        removeBubbleMenu: function (sub) {
            var m = sub ? sub.querySelector('#cr-bubble-menu') : document.getElementById('cr-bubble-menu');
            if (m) m.remove();
        },

        /* ====== 重回（重新生成） ====== */
        regenReply: function (sub, charId, idx) {
            var self = this;
            var msgArea = sub.querySelector('#cr-messages');

            /* 弹出风格输入框 */
            var old = sub.querySelector('#cr-regen-panel');
            if (old) old.remove();

            var panel = document.createElement('div');
            panel.id = 'cr-regen-panel';
            panel.className = 'cr-regen-panel';
            panel.innerHTML =
                '<div class="cr-regen-title">' +
                '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
                ' 重新生成 · 期望风格（可选）</div>' +
                '<input id="cr-regen-input" type="text" class="cr-regen-input" placeholder="如：温柔一些、更简短、俏皮点……留空则直接重回" />' +
                '<div class="cr-regen-btns">' +
                '<button class="cr-regen-cancel">取消</button>' +
                '<button class="cr-regen-confirm">重新生成</button>' +
                '</div>';

            sub.appendChild(panel);
            setTimeout(function () {
                var inp = panel.querySelector('#cr-regen-input');
                if (inp) inp.focus();
            }, 100);

            panel.querySelector('.cr-regen-cancel').addEventListener('click', function () {
                panel.remove();
            });

            panel.querySelector('.cr-regen-confirm').addEventListener('click', function () {
                var inp = panel.querySelector('#cr-regen-input');
                self._regenStyle = inp ? inp.value.trim() : '';
                panel.remove();

                /* 找到本轮 char 回复的起止位置（连续的 char 消息） */
                var d = loadData();
                var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
                var start = idx, end = idx;
                while (start > 0 && msgs[start - 1] && msgs[start - 1].role === 'char' && !msgs[start - 1].recalled) start--;
                while (end < msgs.length - 1 && msgs[end + 1] && msgs[end + 1].role === 'char' && !msgs[end + 1].recalled) end++;

                /* 删除这些消息 */
                msgs.splice(start, end - start + 1);
                d.chatHistory[charId] = msgs;
                saveData(d);

                /* 重新渲染 */
                self.reRenderMessages(sub, charId);

                /* 触发重新生成 */
                setTimeout(function () {
                    self.triggerCharReply(sub, charId);
                }, 200);
            });
        },

        /* ====== 编辑消息 ====== */
        editMsg: function (sub, charId, idx) {
            var self = this;
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            var m = msgs[idx];
            if (!m) return;

            var newText = prompt('编辑消息', m.text);
            if (newText === null) return;
            newText = newText.trim();
            if (!newText) { self.toast('消息不能为空'); return; }

            msgs[idx].text = newText;
            d.chatHistory[charId] = msgs;
            saveData(d);

            /* 更新 DOM */
            var bubbleEl = sub.querySelector('[data-msg-idx="' + idx + '"]');
            if (bubbleEl) {
                var bubbleInner = bubbleEl.querySelector('.cr-msg-bubble');
                if (bubbleInner) bubbleInner.innerHTML = escHtml(newText);
            }
            self.toast('已编辑');
        },

        /* ====== 删除消息 ====== */
        deleteMsg: function (sub, charId, idx) {
            var self = this;
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            msgs.splice(idx, 1);
            d.chatHistory[charId] = msgs;
            saveData(d);

            self.reRenderMessages(sub, charId);
            self.toast('已删除');
        },

        /* ====== 撤回消息 ====== */
        recallMsg: function (sub, charId, idx) {
            var self = this;
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            if (!msgs[idx]) return;

            var who = msgs[idx].role === 'user' ? '你' : '对方';
            msgs[idx].recalled = true;
            d.chatHistory[charId] = msgs;
            saveData(d);

            /* 更新 DOM */
            var bubbleEl = sub.querySelector('[data-msg-idx="' + idx + '"]');
            if (bubbleEl) {
                bubbleEl.className = 'cr-msg-recalled';
                bubbleEl.innerHTML = '';
                bubbleEl.textContent = who + ' 撤回了一条消息';
                /* 移除点击事件 */
                var newEl = bubbleEl.cloneNode(true);
                bubbleEl.parentNode.replaceChild(newEl, bubbleEl);
            }
            self.toast('已撤回');
        },

        /* ====== 引用消息 ====== */
        quoteMsg: function (sub, charId, idx) {
            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            var m = msgs[idx];
            if (!m) return;

            var chars = d.characters || [];
            var charName = '对方';
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].id === charId) { charName = chars[i].nickname || chars[i].name || '对方'; break; }
            }

            var name = m.role === 'user' ? '我' : charName;
            this._quoteData = { name: name, text: m.text, idx: idx };

            var bar = sub.querySelector('#cr-quote-bar');
            var barText = sub.querySelector('#cr-quote-bar-text');
            if (bar && barText) {
                barText.textContent = name + '：' + m.text.substring(0, 60);
                bar.style.display = 'flex';
            }

            var inp = sub.querySelector('#cr-input');
            if (inp) inp.focus();
        },

        /* ====== 多选模式 ====== */
        enterMultiSelect: function (sub, charId, idx) {
            this._multiSelectMode = true;
            this._multiSelected = [idx];
            this._multiCharId = charId;

            var inputBar = sub.querySelector('.cr-inputbar');
            var multiBar = sub.querySelector('#cr-multi-bar');
            var quoteBar = sub.querySelector('#cr-quote-bar');
            if (inputBar) inputBar.style.display = 'none';
            if (quoteBar) quoteBar.style.display = 'none';
            if (multiBar) multiBar.style.display = 'flex';

            this.updateMultiSelectUI(sub, charId);
        },

        exitMultiSelect: function (sub) {
            this._multiSelectMode = false;
            this._multiSelected = [];

            var inputBar = sub.querySelector('.cr-inputbar');
            var multiBar = sub.querySelector('#cr-multi-bar');
            if (inputBar) inputBar.style.display = '';
            if (multiBar) multiBar.style.display = 'none';

            var selected = sub.querySelectorAll('.cr-msg.multi-selected');
            for (var i = 0; i < selected.length; i++) selected[i].classList.remove('multi-selected');
        },

        toggleMultiSelect: function (sub, charId, idx) {
            var pos = this._multiSelected.indexOf(idx);
            if (pos !== -1) this._multiSelected.splice(pos, 1);
            else this._multiSelected.push(idx);
            this.updateMultiSelectUI(sub, charId);
        },

        updateMultiSelectUI: function (sub, charId) {
            var info = sub.querySelector('#cr-multi-info');
            if (info) info.textContent = '已选 ' + this._multiSelected.length + ' 条';

            var allBubbles = sub.querySelectorAll('[data-msg-idx]');
            var selected = this._multiSelected;
            for (var i = 0; i < allBubbles.length; i++) {
                var idx = parseInt(allBubbles[i].getAttribute('data-msg-idx'));
                if (!isNaN(idx)) {
                    allBubbles[i].classList.toggle('multi-selected', selected.indexOf(idx) !== -1);
                }
            }
        },

        multiDeleteMsgs: function (sub, charId) {
            var self = this;
            if (!this._multiSelected.length) { self.toast('未选中任何消息'); return; }
            if (!confirm('确认删除 ' + this._multiSelected.length + ' 条消息？')) return;

            var d = loadData();
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            this._multiSelected.sort(function (a, b) { return b - a; });
            for (var i = 0; i < this._multiSelected.length; i++) {
                msgs.splice(this._multiSelected[i], 1);
            }
            d.chatHistory[charId] = msgs;
            saveData(d);

            this._multiSelectMode = false;
            this._multiSelected = [];
            var inputBar = sub.querySelector('.cr-inputbar');
            var multiBar = sub.querySelector('#cr-multi-bar');
            if (inputBar) inputBar.style.display = '';
            if (multiBar) multiBar.style.display = 'none';

            self.reRenderMessages(sub, charId);
            self.toast('已删除');
        },

        /* ====== 重新渲染消息列表 ====== */
        reRenderMessages: function (sub, charId) {
            var msgArea = sub.querySelector('#cr-messages');
            if (!msgArea) return;
            msgArea.innerHTML = '';
            this.loadChatHistory(sub, charId);
        },

        /* ====== 自动翻译 ====== */
        tryAutoTranslate: function (sub, charId, bubbleEl, text) {
            var self = this;

            /* 1. 检查该聊天室是否开启了翻译 */
            var d = loadData();
            var rc = (d.roomConfig && d.roomConfig[charId]) || {};
            if (!rc.translateEnabled) return;

            /* 2. 检测是否需要翻译
               策略：含日文假名 或 韩文 或 纯英文序列 则翻译
               关键：不能用"纯中文"来排除，因为日文中混有大量汉字 */
            var hasJapanese = /[\u3040-\u30FF\u30A0-\u30FF\uFF65-\uFF9F]/.test(text);
            var hasKorean = /[\uAC00-\uD7AF]/.test(text);
            var hasEnglish = /[a-zA-Z]{4,}/.test(text);
            /* 真正的纯中文：只有CJK统一汉字 + 标点 + 空白，且无假名无韩文无英文 */
            var isPureChinese = !hasJapanese && !hasKorean && !hasEnglish &&
                /^[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\uF900-\uFAFF\u2F800-\u2FA1F\u3000-\u303F\uFF00-\uFFEF\s\p{P}！？。，、；：""''（）【】《》—…·]+$/.test(text);

            if (isPureChinese) return;
            if (!hasJapanese && !hasKorean && !hasEnglish) return;

            /* 3. 检查缓存 */
            var idx = parseInt(bubbleEl.getAttribute('data-msg-idx'));
            var msgs = (d.chatHistory && d.chatHistory[charId]) || [];
            if (!isNaN(idx) && msgs[idx] && msgs[idx].translation) {
                self._renderTranslation(bubbleEl, msgs[idx].translation);
                return;
            }

            /* 4. 插入 loading */
            var loadingDiv = document.createElement('div');
            loadingDiv.className = 'cr-translation cr-translation-loading';
            loadingDiv.innerHTML =
                '<span class="cr-trans-dots"><span></span><span></span><span></span></span>' +
                '<span class="cr-trans-label">翻译中</span>';
            bubbleEl.appendChild(loadingDiv);
            /* 滚动到底部 */
            var msgArea = sub.querySelector('#cr-messages');
            if (msgArea) msgArea.scrollTop = msgArea.scrollHeight;

            /* 5. 调用 LLM —— 必须用 self.callLLM，不能用 window.ChatApp.callLLM */
            var translateMsgs = [
                {
                    role: 'system',
                    content: '你是专业翻译。请将以下文本翻译成简体中文。只输出译文，不要解释，不要加引号，保留颜文字和特殊符号，人名保留原文。'
                },
                {
                    role: 'user',
                    content: text
                }
            ];

            self.callLLM(translateMsgs, function (err, reply) {
                if (loadingDiv.parentNode) loadingDiv.remove();
                if (err || !reply || !reply.trim()) {
                    /* 翻译失败静默处理，不打扰用户 */
                    return;
                }

                var translated = reply.trim();

                /* 6. 缓存翻译结果 */
                var d2 = loadData();
                var msgs2 = (d2.chatHistory && d2.chatHistory[charId]) || [];
                var msgIdx2 = parseInt(bubbleEl.getAttribute('data-msg-idx'));
                if (!isNaN(msgIdx2) && msgs2[msgIdx2]) {
                    msgs2[msgIdx2].translation = translated;
                    d2.chatHistory[charId] = msgs2;
                    saveData(d2);
                }

                /* 7. 渲染 */
                self._renderTranslation(bubbleEl, translated);
                if (msgArea) msgArea.scrollTop = msgArea.scrollHeight;
            });
        },

        /* 渲染翻译气泡 */
        _renderTranslation: function (bubbleEl, translatedText) {
            /* 防止重复插入 */
            if (bubbleEl.querySelector('.cr-translation-done')) return;

            var transDiv = document.createElement('div');
            transDiv.className = 'cr-translation cr-translation-done';
            transDiv.innerHTML =
                '<div class="cr-trans-text">' + escHtml(translatedText) + '</div>' +
                '<div class="cr-trans-credit">' +
                '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>' +
                '<polyline points="22 4 12 14.01 9 11.01"/>' +
                '</svg>' +
                ' 由灵机提供翻译支持</div>';

            /* 动画插入 */
            transDiv.style.opacity = '0';
            transDiv.style.transform = 'translateY(-6px)';
            bubbleEl.appendChild(transDiv);

            requestAnimationFrame(function () {
                transDiv.style.transition = 'opacity .25s ease, transform .25s ease';
                transDiv.style.opacity = '1';
                transDiv.style.transform = 'translateY(0)';
            });
        },

        /* ====== 触发 char 回复 ====== */
        triggerCharReply: function (sub, charId) {
            var self = this;

            /* 找到角色信息 */
            var data = loadData();
            var chars = data.characters || [];
            var char = null;
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].id === charId) { char = chars[i]; break; }
            }
            if (!char) { self.toast('角色不存在'); return; }

            /* 获取聊天历史 */
            var history = (data.chatHistory && data.chatHistory[charId]) || [];
            if (history.length === 0) {
                self.toast('请先发送一条消息');
                return;
            }

            /* 获取房间配置 */
            var roomCfg = (data.roomConfig && data.roomConfig[charId]) || {};

            /* 获取 user 人设 —— 优先房间挂载 > 全局激活 */
            var userPersona = '';
            var activeUserCharId = roomCfg.mountedUserCharId || data.activeCharId || '';
            if (activeUserCharId) {
                for (var u = 0; u < chars.length; u++) {
                    if (chars[u].id === activeUserCharId && (!chars[u].type || chars[u].type === 'user')) {
                        userPersona = chars[u].detail || '';
                        break;
                    }
                }
            }

            /* 获取 user 名字 */
            var userName = '用户';
            var userNickname = '';
            if (activeUserCharId) {
                for (var un = 0; un < chars.length; un++) {
                    if (chars[un].id === activeUserCharId) {
                        userName = chars[un].name || '用户';
                        userNickname = chars[un].nickname || '';
                        break;
                    }
                }
            }
            var charName = char.name || '未知';

            /* 构建 system prompt —— 参照 DanShu Pro 的详细模板 */
            var sysPrompt = '';

            sysPrompt += '# 核心指令\n';
            sysPrompt += '你是「' + charName + '」，正在通过手机App与「' + userName + '」进行线上文字聊天。\n';
            sysPrompt += '【场景定性——极其重要】你们两人此刻不在同一物理空间，这是一次纯粹的线上聊天，就像现实中两个人用微信/短信互发消息一样。\n';
            sysPrompt += '你只能"发消息"——发文字、发表情。你没有身体在对方面前，你无法做出任何线下物理动作。\n';
            sysPrompt += '你必须始终以「' + charName + '」的身份说话。你不是AI，你不是语言模型，你就是这个角色本人。\n';
            sysPrompt += '绝对禁止跳出角色、绝对禁止以第三人称谈论自己、绝对禁止承认自己是AI。\n\n';

            sysPrompt += '# 角色完整档案\n';
            sysPrompt += '## 基本信息\n';
            sysPrompt += '- 角色全名：' + charName + '\n';
            if (char.nickname && char.nickname !== char.name) {
                sysPrompt += '- 小名/外号：' + char.nickname + '（这只是' + userName + '给你起的小名或外号，你的真实全名仍然是「' + charName + '」）\n';
            }

            if (char.gender === 'male') {
                sysPrompt += '- 性别：男性 ♂\n';
                sysPrompt += '- 性别认知强制要求：你是一名男性。你的自我认知、行为举止、语气措辞、自称代词必须完全符合男性角色。绝对禁止出现任何女性化的语气词、撒娇方式或自称。\n';
            } else if (char.gender === 'female') {
                sysPrompt += '- 性别：女性 ♀\n';
                sysPrompt += '- 性别认知强制要求：你是一名女性。你的自我认知、行为举止、语气措辞、自称代词必须完全符合女性角色。你的说话方式应自然体现女性特质。\n';
            } else {
                sysPrompt += '- 性别：' + (char.gender || '未指定') + '（请根据详细人设中的描述来判断）\n';
            }

            if (char.mood) sysPrompt += '- 当前心情：' + char.mood + '\n';

            if (char.detail) {
                sysPrompt += '\n## 详细人设（最重要，必须严格遵守）\n';
                sysPrompt += '以下是你的完整角色设定，包含你的性格、背景、喜好、说话方式、口癖、习惯等。你在对话中的每一句话、每一个反应都必须与以下设定完全一致：\n\n';
                sysPrompt += char.detail + '\n\n';
                sysPrompt += '【重要提醒】以上人设信息是你扮演这个角色的根本依据。你必须：\n';
                sysPrompt += '- 完全内化这些特征，而不只是表面模仿\n';
                sysPrompt += '- 如果设定中提到了特定的说话方式、口癖、语气词，你必须在回复中自然地使用它们\n';
                sysPrompt += '- 如果设定中提到了性格特征，你的回复情绪、态度必须与之一致\n';
                sysPrompt += '- 如果设定中提到了对' + userName + '的关系或态度，你必须在对话中体现出来\n';
                sysPrompt += '- 如果设定中有任何禁忌、不喜欢的事物，你遇到相关话题时必须表现出真实反应\n';
            } else {
                sysPrompt += '\n## 详细人设\n（该角色暂未设定详细信息，请根据角色名字和性别自由发挥一个合理的人格）\n';
            }

            sysPrompt += '\n# 你的对话对象\n';
            sysPrompt += '你正在和以下这个人聊天，请根据对方的信息来调整你的称呼和互动方式：\n\n';
            if (userPersona) {
                sysPrompt += '- 名字：' + userName + '\n';
                if (userNickname) sysPrompt += '- 昵称/别名：' + userNickname + '\n';
                sysPrompt += '- 对方的详细信息：\n' + userPersona + '\n';
            } else {
                sysPrompt += '- 名字：' + userName + '（对方未设置详细信息，请以自然友好的方式互动）\n';
            }

            sysPrompt += '\n# 回复格式要求\n';
            sysPrompt += '1. 始终保持角色扮演，不要跳出角色，不要用第三人称描述自己。\n';
            sysPrompt += '2. 根据你的性格和说话方式来回复，如果有口癖一定要体现。\n';
            sysPrompt += '3. 回复自然流畅，像真人在手机上聊天一样，避免过于书面化。\n';
            sysPrompt += '4. 如果想表达多个意思，可以用两个换行分成多段（每段会显示为独立的消息气泡，模拟真实聊天连发多条消息的效果）。\n';
            sysPrompt += '5. 不要加任何角色名前缀如"' + charName + '："，直接说内容。\n';
            sysPrompt += '6. 绝对不要使用markdown格式（不要用**加粗**、不要用*斜体*、不要用标题符号#、不要用列表符号-、不要用数字编号列表）。\n';
            sysPrompt += '7. 绝对不要输出任何元分析、角色分析、思考过程、检查清单等元内容。你只输出角色说的话，没有任何旁白或注释。\n';
            sysPrompt += '8. 称呼对方时请使用「' + (userNickname || userName) + '」或你们关系中合适的称呼，不要叫"用户"。\n';
            sysPrompt += '9. 注意聊天语境的连贯性，记住之前对话的内容，不要重复提问或遗忘已知信息。\n';
            sysPrompt += '10. 严格禁止使用括号描写动作或心理活动，例如禁止（微笑）、（歪头）、（心跳加速）等。\n';
            sysPrompt += '11. 回复长度应根据话题自然调节：闲聊可以简短（1-3句），深入话题可以稍长（3-8句），但避免过长的独白。\n';
            sysPrompt += '12. 要有真实的情感波动，不要每句话都很积极或中性，应根据话题内容表现出相应的情绪。\n';

            sysPrompt += '12. 要有真实的情感波动，不要每句话都很积极或中性，应根据话题内容表现出相应的情绪。\n';

            /* ── 表情包能力注入（与 triggerBgReply 保持一致） ── */
            var _sg = data.stickerGroups || [];
            var _rm = roomCfg.mountedStickers || [];
            var _avail = [];
            for (var _si = 0; _si < _sg.length; _si++) {
                if (_rm.indexOf(_sg[_si].id) !== -1) _avail.push(_sg[_si]);
            }
            if (_avail.length > 0) {
                sysPrompt += '\n# 表情包发送能力\n';
                sysPrompt += '你可以在聊天中主动发送表情包图片。以下是当前可用的表情包分组和图片列表：\n';
                for (var _ai = 0; _ai < _avail.length; _ai++) {
                    var _ag = _avail[_ai];
                    sysPrompt += '\n【' + _ag.name + '】分组：\n';
                    var _sts = _ag.stickers || [];
                    for (var _sti = 0; _sti < _sts.length; _sti++) {
                        var _st = _sts[_sti];
                        sysPrompt += '- ' + (_st.name || ('表情' + (_sti + 1))) + '：[表情包:' + _st.url + ']\n';
                    }
                }
                sysPrompt += '\n发送规则：\n';
                sysPrompt += '- 当你想发送表情包时，在回复中直接输出对应的 [表情包:URL] 格式标记，该标记会自动渲染为图片。\n';
                sysPrompt += '- [表情包:URL] 标记必须单独占一段（前后用空行隔开），不能混在文字句子里。\n';
                sysPrompt += '- 你可以先发文字再发表情包，也可以只发表情包，模拟真实聊天发图的感觉。\n';
                sysPrompt += '- 不要每条回复都发表情包，要在情绪到位时自然地使用，频率控制在合适范围。\n';
                sysPrompt += '- 绝对不要编造不在列表中的表情包URL，只能使用上方列表中提供的URL。\n';
            }

            /* 重回风格提示 */
            if (self._regenStyle) {
                sysPrompt += '\n# 本次回复特别要求（仅本次有效）\n';
                sysPrompt += '用户希望你的回复风格调整为：「' + self._regenStyle + '」\n';
                sysPrompt += '请在完全不OOC、严格贴合人设的前提下，将这个风格融入本次回复。\n';
                self._regenStyle = '';
            }

            /* 时间感知注入 */
            if (roomCfg.timeAware && roomCfg.timezone) {
                var now = new Date();
                var tzName = roomCfg.timezone;
                var timeStr = '';
                try {
                    timeStr = now.toLocaleString('zh-CN', { timeZone: tzName, hour12: false });
                } catch (e) {
                    timeStr = now.toISOString();
                }
                sysPrompt += '\n# 时间感知（角色必须遵守）\n';
                sysPrompt += '当前时间（' + tzName + '）：' + timeStr + '\n';
                sysPrompt += '你必须根据这个时间来调整回复内容。例如：深夜应该表现出困意、早上应该打招呼、中午可以提到午饭等。\n';
                sysPrompt += '如果时间是深夜，你可以催促对方去睡觉，或表现出自己也很困。\n';
            }

            /* 记忆总结注入 */
            if (roomCfg.memorySummary) {
                sysPrompt += '\n# 长期记忆摘要\n';
                sysPrompt += '以下是你和对方过去聊天的记忆总结，请在对话中自然地运用这些信息：\n';
                sysPrompt += roomCfg.memorySummary + '\n';
            }

            /* 构建 messages 数组 */
            var messages = [{ role: 'system', content: sysPrompt }];

            /* 最近 40 条历史 */
            var recentHistory = history.slice(-40);
            for (var h = 0; h < recentHistory.length; h++) {
                var msg = recentHistory[h];
                /* 表情包消息在历史记录中保持原始格式，让 LLM 能理解上下文 */
                var msgContent = msg.text;
                if (msg.recalled) {
                    msgContent = '[已撤回的消息]';
                }
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msgContent
                });
            }

            /* 显示思考中提示 */
            var msgArea = sub.querySelector('#cr-messages');
            var thinkingEl = document.createElement('div');
            thinkingEl.className = 'cr-msg cr-msg-char cr-msg-thinking';
            thinkingEl.innerHTML = '<div class="cr-msg-bubble cr-thinking-bubble"><span class="cr-dot"></span><span class="cr-dot"></span><span class="cr-dot"></span></div>';
            msgArea.appendChild(thinkingEl);
            msgArea.scrollTop = msgArea.scrollHeight;

            /* 禁用续写按钮 */
            var continueBtn = sub.querySelector('#cr-continue-btn');
            if (continueBtn) continueBtn.disabled = true;

            /* 调用 LLM */
            self.callLLM(messages, function (err, reply) {
                /* 移除思考动画 */
                if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);

                /* 恢复续写按钮 */
                if (continueBtn) continueBtn.disabled = false;

                if (err) {
                    self.toast('回复失败: ' + err.message);
                    return;
                }

                if (!reply || !reply.trim()) {
                    self.toast('回复为空');
                    return;
                }

                /* 按段落拆分为多条气泡 */
                var paragraphs = reply.split(/\n{2,}|\n(?=[「『（(])|(?<=[。！？!?」』）)])\n/);
                var filtered = [];
                for (var p = 0; p < paragraphs.length; p++) {
                    var t = paragraphs[p].trim();
                    if (t) filtered.push(t);
                }
                if (filtered.length === 0) {
                    filtered = [reply.trim()];
                }
                /* 二次拆分：把混在段落里的 [表情包:URL] 分离成独立条目 */
                filtered = self._splitStickerParagraphs(filtered);

                /* 逐条显示（模拟打字间隔） */
                var delay = 0;
                for (var fi = 0; fi < filtered.length; fi++) {
                    (function (text, idx) {
                        setTimeout(function () {
                            self.addChatMessage(sub, charId, 'char', text);
                        }, delay);
                    })(filtered[fi], fi);
                    delay += Math.min(300 + filtered[fi].length * 15, 1200);
                }
            });
        },

        /* ====== 调用 LLM API ====== */
        callLLM: function (messages, cb) {
            /* 读取 API 配置 —— 从 Settings 模块的存储中读取 api_current */
            var apiConfig = {};

            /* 方式1：通过 Settings 全局对象读取（最可靠） */
            if (window.Settings && typeof window.Settings.loadSetting === 'function') {
                var current = window.Settings.loadSetting('api_current');
                if (current && (current.key || current.apiKey)) {
                    apiConfig = current;
                }
            }

            /* 方式2：直接从 lingji_settings localStorage 读取 */
            if (!apiConfig.key && !apiConfig.apiKey) {
                try {
                    var settingsRaw = localStorage.getItem('lingji_settings');
                    if (settingsRaw) {
                        var settings = JSON.parse(settingsRaw);
                        /* api_current 是 settings-api.js 存储的 key */
                        var found = settings.api_current || settings.api || null;
                        if (found && (found.key || found.apiKey)) {
                            apiConfig = found;
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            /* 方式3：尝试独立 key lingji_settings_api_current */
            if (!apiConfig.key && !apiConfig.apiKey) {
                try {
                    var raw2 = localStorage.getItem('lingji_settings_api_current');
                    if (raw2) {
                        var parsed2 = JSON.parse(raw2);
                        if (parsed2 && (parsed2.key || parsed2.apiKey)) {
                            apiConfig = parsed2;
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            /* 方式4：从 lingji_chat 里找 */
            if (!apiConfig.key && !apiConfig.apiKey) {
                var chatData = loadData();
                if (chatData.apiConfig) apiConfig = chatData.apiConfig;
            }

            var apiKey = apiConfig.key || apiConfig.apiKey || '';
            var apiUrl = apiConfig.url || apiConfig.apiUrl || apiConfig.baseUrl || '';
            var model = apiConfig.model || 'gpt-4o-mini';
            var temperature = apiConfig.temperature != null ? parseFloat(apiConfig.temperature) : 0.8;

            if (!apiKey) {
                cb(new Error('未配置 API Key，请在设置中配置'));
                return;
            }

            if (!apiUrl) {
                cb(new Error('未配置 API URL，请在设置中配置'));
                return;
            }

            /* 智能拼接 URL —— 与 settings-api.js 中 buildApiUrl 逻辑一致 */
            var chatUrl = apiUrl.replace(/\/+$/, '');
            if (/\/v1$/i.test(chatUrl)) {
                chatUrl = chatUrl + '/chat/completions';
            } else if (chatUrl.indexOf('/chat/completions') === -1) {
                chatUrl = chatUrl + '/v1/chat/completions';
            }

            console.log('[Chat LLM] URL:', chatUrl, 'Model:', model);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', chatUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + apiKey);
            xhr.timeout = 60000;

            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        var content = '';
                        if (resp.choices && resp.choices.length > 0) {
                            content = resp.choices[0].message ? resp.choices[0].message.content : (resp.choices[0].text || '');
                        }
                        cb(null, content);
                    } catch (e) {
                        cb(new Error('解析响应失败'));
                    }
                } else {
                    var errMsg = '请求失败 (' + xhr.status + ')';
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        if (errResp.error && errResp.error.message) errMsg = errResp.error.message;
                    } catch (e) { /* ignore */ }
                    cb(new Error(errMsg));
                }
            };

            xhr.onerror = function () { cb(new Error('网络错误')); };
            xhr.ontimeout = function () { cb(new Error('请求超时')); };

            xhr.send(JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: 1024
            }));
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
