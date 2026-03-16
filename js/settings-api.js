(function () {
    'use strict';

    var ICONS_CHECK = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

    /* ====== 工具：智能拼接API路径 ====== */
    function buildApiUrl(base, endpoint) {
        // base: 用户输入的URL
        // endpoint: 如 '/v1/models' 或 '/v1/chat/completions'
        //
        // 兼容各种输入格式：
        //   https://api.openai.com          → + /v1/models
        //   https://api.openai.com/         → + /v1/models
        //   https://api.openai.com/v1       → + /models
        //   https://api.openai.com/v1/      → + /models
        //   https://xxx.com/api/v1          → + /models
        //   https://xxx.com/api/v1/         → + /models

        var url = base.replace(/\/+$/, ''); // 去尾部斜杠

        // 检查URL是否已经以 /v1 结尾
        if (/\/v1$/i.test(url)) {
            // 已有 /v1，只拼后半段
            return url + endpoint.replace(/^\/v1/, '');
        }

        // 没有 /v1，完整拼接
        return url + endpoint;
    }

    /* ========== API 设置模块 ========== */
    var ApiSettings = {

        /* 构建页面 HTML */
        buildPage: function () {
            var S = window.Settings;
            var saved = S.loadSetting('api_current') || {};
            var presets = S.loadSetting('api_presets') || [];
            var activeId = saved.activePresetId || '';

            var html = S.subHeader('API 设置') + '<div class="settings-body">';

            /* 已保存的预设列表 */
            if (presets.length > 0) {
                html += '<div class="sf-label">模型预设列表</div>';
                html += '<div class="sf-select-group" id="sf-api-preset-list">';
                for (var i = 0; i < presets.length; i++) {
                    var p = presets[i];
                    var act = (p.id === activeId) ? ' active' : '';
                    html += '<div class="sf-select-item sf-api-preset-item' + act + '" data-preset-id="' + p.id + '">' +
                        '<div class="sf-preset-info"><span class="sf-name">' + S.escapeHtml(p.name) + '</span>' +
                        '<span class="sf-preset-detail">' + S.escapeHtml(p.model || p.url || '') + '</span></div>' +
                        '<button class="sf-preset-del" data-del-id="' + p.id + '">' +
                        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                        '</button>' +
                        '<svg class="sf-check" viewBox="0 0 24 24">' + ICONS_CHECK + '</svg></div>';
                }
                html += '</div>';
            }

            /* 配置表单 */
            html += '<div class="sf-label">预设名称</div>';
            html += '<div class="sf-input-wrap"><input class="sf-input" id="sf-api-name" placeholder="例：GPT-4o 日常" value="' + S.escapeHtml(saved.name || '') + '"></div>';

            html += '<div class="sf-label">API URL</div>';
            html += '<div class="sf-input-wrap"><input class="sf-input" id="sf-api-url" placeholder="https://api.openai.com/v1" value="' + S.escapeHtml(saved.url || '') + '"></div>';
            html += '<div class="sf-hint">支持填写到 /v1 或不带 /v1 均可，会自动识别</div>';

            html += '<div class="sf-label">API Key</div>';
            html += '<div class="sf-input-wrap sf-input-row">' +
                '<input class="sf-input" id="sf-api-key" type="password" placeholder="sk-..." value="' + S.escapeHtml(saved.key || '') + '">' +
                '<button class="sf-icon-btn" id="sf-api-eye" aria-label="显示/隐藏">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>';

            /* 拉取模型 */
            html += '<div class="sf-label">模型选择</div>';
            html += '<div class="sf-input-wrap sf-input-row">' +
                '<select class="sf-input sf-select-native" id="sf-api-model-select"><option value="">-- 先拉取模型列表 --</option></select>' +
                '<button class="sf-fetch-btn" id="sf-api-fetch-models">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>' +
                '<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
                '<span>拉取</span></button></div>';

            /* 手动输入模型 */
            html += '<div class="sf-input-wrap" style="margin-top:4px"><input class="sf-input" id="sf-api-model-manual" placeholder="或手动输入模型名称" value="' + S.escapeHtml(saved.model || '') + '"></div>';

            /* 温度 */
            html += '<div class="sf-label">温度 <span class="sf-label-hint" id="sf-temp-val">' + (saved.temperature != null ? saved.temperature : 0.7) + '</span></div>';
            html += '<div class="sf-slider-wrap">' +
                '<span class="sf-slider-label">保守</span>' +
                '<input type="range" class="sf-slider" id="sf-api-temp" min="0" max="2" step="0.1" value="' + (saved.temperature != null ? saved.temperature : 0.7) + '">' +
                '<span class="sf-slider-label">创意</span></div>';
            html += '<div class="sf-hint">数值越低回答越保守稳定，越高越有创意和随机性</div>';

            /* 测试连接 */
            html += '<button class="sf-action-btn" id="sf-api-test">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>' +
                '<span>测试连接</span></button>';

            /* 连接状态 */
            html += '<div class="sf-status" id="sf-api-status"></div>';

            /* 保存按钮 */
            html += '<button class="sf-save-btn" id="sf-api-save">保存为预设</button>';

            html += '</div>';
            return html;
        },

        /* 初始化页面逻辑 */
        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            /* 密码显示/隐藏 */
            var eyeBtn = sub.querySelector('#sf-api-eye');
            var keyInput = sub.querySelector('#sf-api-key');
            if (eyeBtn && keyInput) {
                eyeBtn.addEventListener('click', function () {
                    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
                });
            }

            /* 温度滑块实时显示 */
            var tempSlider = sub.querySelector('#sf-api-temp');
            var tempVal = sub.querySelector('#sf-temp-val');
            if (tempSlider && tempVal) {
                tempSlider.addEventListener('input', function () {
                    tempVal.textContent = tempSlider.value;
                });
            }

            /* 拉取模型列表 */
            var fetchBtn = sub.querySelector('#sf-api-fetch-models');
            if (fetchBtn) {
                fetchBtn.addEventListener('click', function () {
                    self.fetchModels(sub);
                });
            }

            /* 模型下拉选择同步到手动输入框 */
            var modelSelect = sub.querySelector('#sf-api-model-select');
            var modelManual = sub.querySelector('#sf-api-model-manual');
            if (modelSelect && modelManual) {
                modelSelect.addEventListener('change', function () {
                    if (modelSelect.value) {
                        modelManual.value = modelSelect.value;
                    }
                });
            }

            /* 测试连接 */
            var testBtn = sub.querySelector('#sf-api-test');
            if (testBtn) {
                testBtn.addEventListener('click', function () {
                    self.testConnection(sub);
                });
            }

            /* 预设列表点击切换 */
            var presetItems = sub.querySelectorAll('.sf-api-preset-item');
            for (var i = 0; i < presetItems.length; i++) {
                (function (item) {
                    item.addEventListener('click', function (e) {
                        if (e.target.closest('.sf-preset-del')) return;
                        self.loadPreset(sub, item.getAttribute('data-preset-id'));
                        for (var k = 0; k < presetItems.length; k++) presetItems[k].classList.remove('active');
                        item.classList.add('active');
                    });
                })(presetItems[i]);
            }

            /* 预设删除 */
            var delBtns = sub.querySelectorAll('.sf-preset-del');
            for (var j = 0; j < delBtns.length; j++) {
                (function (btn) {
                    btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        var delId = btn.getAttribute('data-del-id');
                        self.deletePreset(delId);
                        var row = btn.closest('.sf-api-preset-item');
                        if (row) row.style.display = 'none';
                        S.toast('已删除预设');
                    });
                })(delBtns[j]);
            }

            /* 保存预设 */
            var saveBtn = sub.querySelector('#sf-api-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    self.savePreset(sub);
                });
            }

            /* 恢复已保存的模型到下拉框 */
            var savedCfg = S.loadSetting('api_current') || {};
            if (savedCfg.model && modelSelect) {
                var opt = document.createElement('option');
                opt.value = savedCfg.model;
                opt.textContent = savedCfg.model;
                opt.selected = true;
                modelSelect.appendChild(opt);
            }
        },

        /* ====== 拉取模型列表（已修复路径） ====== */
        fetchModels: function (sub) {
            var S = window.Settings;
            var url = sub.querySelector('#sf-api-url').value.trim();
            var key = sub.querySelector('#sf-api-key').value.trim();
            var select = sub.querySelector('#sf-api-model-select');
            var status = sub.querySelector('#sf-api-status');

            if (!url || !key) {
                S.toast('请先填写 API URL 和 Key');
                return;
            }

            /* 使用智能路径拼接 */
            var modelsUrl = buildApiUrl(url, '/v1/models');

            status.textContent = '正在拉取模型列表...';
            status.className = 'sf-status sf-status-loading';

            /* 显示实际请求地址方便调试 */
            console.log('[API设置] 拉取模型:', modelsUrl);

            fetch(modelsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + key
                }
            }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status + ' (' + modelsUrl + ')');
                return res.json();
            }).then(function (data) {
                var models = data.data || data.models || [];

                /* 兼容某些API直接返回数组 */
                if (!Array.isArray(models) && Array.isArray(data)) {
                    models = data;
                }

                if (!Array.isArray(models) || models.length === 0) {
                    status.textContent = '未获取到模型，请检查接口';
                    status.className = 'sf-status sf-status-error';
                    return;
                }

                /* 排序 */
                models.sort(function (a, b) {
                    var idA = (typeof a === 'string') ? a : (a.id || a.name || '');
                    var idB = (typeof b === 'string') ? b : (b.id || b.name || '');
                    return idA.localeCompare(idB);
                });

                /* 填充下拉框 */
                select.innerHTML = '<option value="">-- 请选择模型 --</option>';
                for (var i = 0; i < models.length; i++) {
                    var mid = (typeof models[i] === 'string') ? models[i] : (models[i].id || models[i].name);
                    if (typeof mid !== 'string' || !mid) continue;
                    var opt = document.createElement('option');
                    opt.value = mid;
                    opt.textContent = mid;
                    select.appendChild(opt);
                }

                status.textContent = '已拉取 ' + models.length + ' 个模型';
                status.className = 'sf-status sf-status-success';
            }).catch(function (err) {
                status.textContent = '拉取失败: ' + err.message;
                status.className = 'sf-status sf-status-error';
            });
        },

        /* ====== 测试连接（已修复路径） ====== */
        testConnection: function (sub) {
            var S = window.Settings;
            var url = sub.querySelector('#sf-api-url').value.trim();
            var key = sub.querySelector('#sf-api-key').value.trim();
            var model = sub.querySelector('#sf-api-model-manual').value.trim();
            var status = sub.querySelector('#sf-api-status');

            if (!url || !key) {
                S.toast('请先填写 API URL 和 Key');
                return;
            }

            /* 使用智能路径拼接 */
            var chatUrl = buildApiUrl(url, '/v1/chat/completions');

            status.textContent = '正在测试连接...';
            status.className = 'sf-status sf-status-loading';

            console.log('[API设置] 测试连接:', chatUrl, '模型:', model || '(默认)');

            var body = {
                model: model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Hi, just testing. Reply with "OK".' }],
                max_tokens: 10
            };

            fetch(chatUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status + ' (' + chatUrl + ')');
                return res.json();
            }).then(function (data) {
                var reply = '';
                if (data.choices && data.choices[0]) {
                    reply = data.choices[0].message ? data.choices[0].message.content : '';
                }
                status.textContent = '连接成功' + (reply ? ' — 回复: ' + reply.substring(0, 30) : '');
                status.className = 'sf-status sf-status-success';
            }).catch(function (err) {
                status.textContent = '连接失败: ' + err.message;
                status.className = 'sf-status sf-status-error';
            });
        },

        /* 保存为预设 */
        savePreset: function (sub) {
            var S = window.Settings;
            var name = sub.querySelector('#sf-api-name').value.trim();
            var url = sub.querySelector('#sf-api-url').value.trim();
            var key = sub.querySelector('#sf-api-key').value.trim();
            var model = sub.querySelector('#sf-api-model-manual').value.trim();
            var temp = parseFloat(sub.querySelector('#sf-api-temp').value);

            if (!name) {
                S.toast('请填写预设名称');
                return;
            }
            if (!url || !key) {
                S.toast('请填写 API URL 和 Key');
                return;
            }

            var presetId = 'preset_' + Date.now();
            var preset = {
                id: presetId,
                name: name,
                url: url,
                key: key,
                model: model,
                temperature: temp
            };

            var presets = S.loadSetting('api_presets') || [];
            presets.push(preset);
            S.saveSetting('api_presets', presets);

            var current = {
                activePresetId: presetId,
                name: name,
                url: url,
                key: key,
                model: model,
                temperature: temp
            };
            S.saveSetting('api_current', current);

            S.toast('预设 "' + name + '" 已保存');

            S.closeSub();
            setTimeout(function () {
                S.openSub('api');
            }, 350);
        },

        /* 加载预设 */
        loadPreset: function (sub, presetId) {
            var S = window.Settings;
            var presets = S.loadSetting('api_presets') || [];
            var preset = null;
            for (var i = 0; i < presets.length; i++) {
                if (presets[i].id === presetId) {
                    preset = presets[i];
                    break;
                }
            }
            if (!preset) return;

            sub.querySelector('#sf-api-name').value = preset.name || '';
            sub.querySelector('#sf-api-url').value = preset.url || '';
            sub.querySelector('#sf-api-key').value = preset.key || '';
            sub.querySelector('#sf-api-model-manual').value = preset.model || '';
            sub.querySelector('#sf-api-temp').value = preset.temperature != null ? preset.temperature : 0.7;
            var tempVal = sub.querySelector('#sf-temp-val');
            if (tempVal) tempVal.textContent = preset.temperature != null ? preset.temperature : 0.7;

            var current = {
                activePresetId: presetId,
                name: preset.name,
                url: preset.url,
                key: preset.key,
                model: preset.model,
                temperature: preset.temperature
            };
            S.saveSetting('api_current', current);
            S.toast('已切换到 "' + preset.name + '"');
        },

        /* 删除预设 */
        deletePreset: function (presetId) {
            var S = window.Settings;
            var presets = S.loadSetting('api_presets') || [];
            var filtered = [];
            for (var i = 0; i < presets.length; i++) {
                if (presets[i].id !== presetId) filtered.push(presets[i]);
            }
            S.saveSetting('api_presets', filtered);

            var current = S.loadSetting('api_current') || {};
            if (current.activePresetId === presetId) {
                current.activePresetId = '';
                S.saveSetting('api_current', current);
            }
        }
    };

    window.ApiSettings = ApiSettings;
})();
