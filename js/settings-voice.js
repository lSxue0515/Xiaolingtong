(function () {
    'use strict';

    var ICONS_CHECK = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

    /* ========== MiniMax TTS 模型列表 ========== */
    var TTS_MODELS = [
        { id: 'speech-02-hd', name: 'Speech-02-HD', endpoint: 't2a_v2' },
        { id: 'speech-02', name: 'Speech-02', endpoint: 't2a_v2' },
        { id: 'speech-01-hd', name: 'Speech-01-HD', endpoint: 't2a_pro' },
        { id: 'speech-01', name: 'Speech-01', endpoint: 't2a_pro' }
    ];

    /* ========== 语言选项 ========== */
    var LANGUAGES = [
        { id: '', name: '自动识别（默认）' },
        { id: 'zh', name: '中文' },
        { id: 'en', name: 'English' },
        { id: 'ja', name: '日本語' },
        { id: 'ko', name: '한국어' },
        { id: 'es', name: 'Español' },
        { id: 'fr', name: 'Français' },
        { id: 'de', name: 'Deutsch' },
        { id: 'it', name: 'Italiano' },
        { id: 'pt', name: 'Português' },
        { id: 'ru', name: 'Русский' },
        { id: 'ar', name: 'العربية' },
        { id: 'th', name: 'ไทย' },
        { id: 'vi', name: 'Tiếng Việt' }
    ];

    /* 根据模型ID查找对应端点 */
    function getEndpoint(modelId) {
        for (var i = 0; i < TTS_MODELS.length; i++) {
            if (TTS_MODELS[i].id === modelId) return TTS_MODELS[i].endpoint;
        }
        return 't2a_v2';
    }

    /* ====== 十六进制字符串转 base64 ====== */
    function hexToBase64(hexStr) {
        /* 每两个hex字符转为一个字节 */
        var bytes = [];
        for (var i = 0; i < hexStr.length; i += 2) {
            bytes.push(parseInt(hexStr.substr(i, 2), 16));
        }
        /* 转为二进制字符串 */
        var binary = '';
        for (var j = 0; j < bytes.length; j++) {
            binary += String.fromCharCode(bytes[j]);
        }
        return btoa(binary);
    }

    /* ====== 判断字符串是hex还是base64 ====== */
    function isHexString(str) {
        /* hex字符串只含 0-9 a-f A-F，且长度为偶数 */
        if (str.length % 2 !== 0) return false;
        return /^[0-9a-fA-F]+$/.test(str.substring(0, 100));
    }

    /* ====== 将音频数据（hex或base64）转为可播放的data URL ====== */
    function audioDataToUrl(rawData) {
        var b64;
        if (isHexString(rawData)) {
            b64 = hexToBase64(rawData);
        } else {
            b64 = rawData;
        }
        return 'data:audio/mp3;base64,' + b64;
    }

    /* ====== 从API响应中提取音频数据 ====== */
    function extractAudioData(data, endpoint) {
        /*
         * t2a_v2 (speech-02 系列) 返回结构：
         *   { data: { audio: { data: "hex字符串", ... } }, base_resp: {...} }
         *   或部分情况：
         *   { audio_file: "hex字符串", ... }
         *
         * t2a_pro (speech-01 系列) 返回结构：
         *   { audio_file: "hex字符串", base_resp: {...} }
         *   或：
         *   { data: { audio: "hex字符串" } }
         */

        /* 路径1：t2a_v2 标准路径 data.data.audio.data */
        if (data.data && data.data.audio) {
            if (typeof data.data.audio === 'object' && data.data.audio.data) {
                return data.data.audio.data;
            }
            if (typeof data.data.audio === 'string') {
                return data.data.audio;
            }
        }

        /* 路径2：audio_file 直接字段 */
        if (data.audio_file && typeof data.audio_file === 'string') {
            return data.audio_file;
        }

        /* 路径3：data.audio 直接字段 */
        if (data.audio && typeof data.audio === 'string') {
            return data.audio;
        }

        return null;
    }

    /* ========== 语音设置模块 ========== */
    var VoiceSettings = {

        buildPage: function () {
            var S = window.Settings;
            var saved = S.loadSetting('voice_minimax') || {};

            var html = S.subHeader('语音设置') + '<div class="settings-body">';

            /* MiniMax 板块标题 */
            html += '<div class="sf-section-title">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>' +
                '<path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' +
                '<span>MiniMax 语音</span></div>';

            /* API Key */
            html += '<div class="sf-label">API Key</div>';
            html += '<div class="sf-input-wrap sf-input-row">' +
                '<input class="sf-input" id="sf-voice-apikey" type="password" placeholder="输入 MiniMax API Key" value="' + S.escapeHtml(saved.apiKey || '') + '">' +
                '<button class="sf-icon-btn" id="sf-voice-eye" aria-label="显示/隐藏">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>';

            /* Group ID */
            html += '<div class="sf-label">Group ID</div>';
            html += '<div class="sf-input-wrap"><input class="sf-input" id="sf-voice-groupid" placeholder="输入 Group ID" value="' + S.escapeHtml(saved.groupId || '') + '"></div>';

            /* TTS 模型选择 */
            html += '<div class="sf-label">TTS 模型</div>';
            html += '<div class="sf-select-group" id="sf-voice-model-group">';
            for (var i = 0; i < TTS_MODELS.length; i++) {
                var m = TTS_MODELS[i];
                var act = (saved.model === m.id) ? ' active' : ((!saved.model && i === 0) ? ' active' : '');
                html += '<div class="sf-select-item' + act + '" data-voice-model="' + m.id + '">' +
                    '<span class="sf-name">' + m.name + '</span>' +
                    '<span class="sf-item-tag">' + m.endpoint + '</span>' +
                    '<svg class="sf-check" viewBox="0 0 24 24">' + ICONS_CHECK + '</svg></div>';
            }
            html += '</div>';
            html += '<div class="sf-hint">Speech-02 系列使用 t2a_v2 接口，Speech-01 系列使用 t2a_pro 接口，会自动匹配</div>';

            /* Voice ID 输入 */
            html += '<div class="sf-label">Voice ID</div>';
            html += '<div class="sf-input-wrap"><input class="sf-input" id="sf-voice-voiceid" placeholder="例：male-qn-qingse" value="' + S.escapeHtml(saved.voiceId || '') + '"></div>';
            html += '<div class="sf-hint">填写 MiniMax 音色ID，可在官方文档查看全部可用音色</div>';

            /* 语言指定 */
            html += '<div class="sf-label">语言指定</div>';
            html += '<div class="sf-select-group" id="sf-voice-lang-group">';
            for (var j = 0; j < LANGUAGES.length; j++) {
                var lang = LANGUAGES[j];
                var langAct = (saved.language === lang.id) ? ' active' : ((!saved.language && j === 0) ? ' active' : '');
                html += '<div class="sf-select-item' + langAct + '" data-voice-lang="' + lang.id + '">' +
                    '<span class="sf-name">' + lang.name + '</span>' +
                    '<svg class="sf-check" viewBox="0 0 24 24">' + ICONS_CHECK + '</svg></div>';
            }
            html += '</div>';
            html += '<div class="sf-hint">指定语言可优化对应语种的发音效果，选择"自动识别"则由引擎自行判断</div>';

            /* 语速调整 */
            html += '<div class="sf-label">语速 <span class="sf-label-hint" id="sf-speed-val">' + (saved.speed != null ? saved.speed : 1.0) + 'x</span></div>';
            html += '<div class="sf-slider-wrap">' +
                '<span class="sf-slider-label">慢</span>' +
                '<input type="range" class="sf-slider" id="sf-voice-speed" min="0.5" max="2.0" step="0.1" value="' + (saved.speed != null ? saved.speed : 1.0) + '">' +
                '<span class="sf-slider-label">快</span></div>';

            /* 音调调整 */
            html += '<div class="sf-label">音调 <span class="sf-label-hint" id="sf-pitch-val">' + (saved.pitch != null ? saved.pitch : 0) + '</span></div>';
            html += '<div class="sf-slider-wrap">' +
                '<span class="sf-slider-label">低沉</span>' +
                '<input type="range" class="sf-slider" id="sf-voice-pitch" min="-12" max="12" step="1" value="' + (saved.pitch != null ? saved.pitch : 0) + '">' +
                '<span class="sf-slider-label">尖锐</span></div>';

            /* 试听文本输入 */
            html += '<div class="sf-label">试听文本</div>';
            html += '<div class="sf-input-wrap"><textarea class="sf-input sf-textarea" id="sf-voice-preview-text" rows="3" placeholder="输入想要试听的文本内容...">' + S.escapeHtml(saved.previewText || '你好，这是一段语音试听测试。') + '</textarea></div>';
            html += '<div class="sf-hint">自定义试听内容，点击下方按钮即可播放</div>';

            /* 试听按钮 */
            html += '<button class="sf-action-btn" id="sf-voice-preview">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                '<span>试听语音</span></button>';

            /* 停止按钮（试听时显示） */
            html += '<button class="sf-action-btn" id="sf-voice-stop" style="display:none;margin-top:4px">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>' +
                '<span>停止播放</span></button>';

            /* 试听状态 */
            html += '<div class="sf-status" id="sf-voice-status"></div>';

            /* 保存按钮 */
            html += '<button class="sf-save-btn" id="sf-voice-save">保存设置</button>';

            html += '</div>';
            return html;
        },

        /* 当前播放的 Audio 实例 */
        _currentAudio: null,

        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            /* 密码显示/隐藏 */
            var eyeBtn = sub.querySelector('#sf-voice-eye');
            var keyInput = sub.querySelector('#sf-voice-apikey');
            if (eyeBtn && keyInput) {
                eyeBtn.addEventListener('click', function () {
                    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
                });
            }

            /* TTS模型选择 */
            S.bindSelectGroup(sub, 'data-voice-model');

            /* 语言选择 */
            S.bindSelectGroup(sub, 'data-voice-lang');

            /* 语速滑块 */
            var speedSlider = sub.querySelector('#sf-voice-speed');
            var speedVal = sub.querySelector('#sf-speed-val');
            if (speedSlider && speedVal) {
                speedSlider.addEventListener('input', function () {
                    speedVal.textContent = speedSlider.value + 'x';
                });
            }

            /* 音调滑块 */
            var pitchSlider = sub.querySelector('#sf-voice-pitch');
            var pitchVal = sub.querySelector('#sf-pitch-val');
            if (pitchSlider && pitchVal) {
                pitchSlider.addEventListener('input', function () {
                    pitchVal.textContent = pitchSlider.value;
                });
            }

            /* 试听 */
            var previewBtn = sub.querySelector('#sf-voice-preview');
            if (previewBtn) {
                previewBtn.addEventListener('click', function () {
                    self.previewVoice(sub);
                });
            }

            /* 停止 */
            var stopBtn = sub.querySelector('#sf-voice-stop');
            if (stopBtn) {
                stopBtn.addEventListener('click', function () {
                    self.stopPlayback(sub);
                });
            }

            /* 保存 */
            var saveBtn = sub.querySelector('#sf-voice-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    self.saveVoice(sub);
                });
            }
        },

        /* 停止播放 */
        stopPlayback: function (sub) {
            if (this._currentAudio) {
                this._currentAudio.pause();
                this._currentAudio.currentTime = 0;
                this._currentAudio = null;
            }
            var stopBtn = sub.querySelector('#sf-voice-stop');
            if (stopBtn) stopBtn.style.display = 'none';
            var status = sub.querySelector('#sf-voice-status');
            if (status) {
                status.textContent = '已停止';
                status.className = 'sf-status';
            }
        },

        /* 试听语音 */
        previewVoice: function (sub) {
            var S = window.Settings;
            var self = this;
            var apiKey = sub.querySelector('#sf-voice-apikey').value.trim();
            var groupId = sub.querySelector('#sf-voice-groupid').value.trim();
            var status = sub.querySelector('#sf-voice-status');
            var stopBtn = sub.querySelector('#sf-voice-stop');

            /* 如果正在播放，先停止 */
            this.stopPlayback(sub);

            if (!apiKey || !groupId) {
                S.toast('请先填写 API Key 和 Group ID');
                return;
            }

            var voiceId = sub.querySelector('#sf-voice-voiceid').value.trim();
            if (!voiceId) {
                S.toast('请填写 Voice ID');
                return;
            }

            var previewText = sub.querySelector('#sf-voice-preview-text').value.trim();
            if (!previewText) {
                S.toast('请输入试听文本');
                return;
            }

            var modelEl = sub.querySelector('[data-voice-model].active');
            var modelId = modelEl ? modelEl.getAttribute('data-voice-model') : 'speech-02';
            var speed = parseFloat(sub.querySelector('#sf-voice-speed').value) || 1.0;
            var pitch = parseInt(sub.querySelector('#sf-voice-pitch').value) || 0;

            var langEl = sub.querySelector('[data-voice-lang].active');
            var language = langEl ? langEl.getAttribute('data-voice-lang') : '';

            var endpoint = getEndpoint(modelId);

            status.textContent = '正在生成语音...';
            status.className = 'sf-status sf-status-loading';

            var ttsUrl = 'https://api.minimax.chat/v1/' + endpoint + '?GroupId=' + encodeURIComponent(groupId);

            console.log('[语音设置] 请求:', ttsUrl, '模型:', modelId, '端点:', endpoint, '语言:', language || '自动');

            /* 构建请求体 */
            var body;

            if (endpoint === 't2a_v2') {
                body = {
                    model: modelId,
                    text: previewText,
                    stream: false,
                    voice_setting: {
                        voice_id: voiceId,
                        speed: speed,
                        pitch: pitch
                    }
                };
                if (language) {
                    body.language_boost = language;
                }
            } else {
                body = {
                    model: modelId,
                    text: previewText,
                    stream: false,
                    voice_setting: {
                        voice_id: voiceId,
                        speed: speed,
                        pitch: pitch
                    }
                };
                if (language) {
                    body.audio_setting = {
                        language: language
                    };
                }
            }

            fetch(ttsUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }).then(function (res) {
                if (!res.ok) {
                    return res.text().then(function (text) {
                        var msg = 'HTTP ' + res.status;
                        try {
                            var errData = JSON.parse(text);
                            if (errData.base_resp && errData.base_resp.status_msg) {
                                msg = errData.base_resp.status_msg;
                            }
                        } catch (e) { /* 非JSON响应 */ }
                        throw new Error(msg);
                    });
                }
                return res.json();
            }).then(function (data) {
                console.log('[语音设置] API响应结构:', JSON.stringify(Object.keys(data)));

                /* 检查业务层错误 */
                if (data.base_resp && data.base_resp.status_code !== 0) {
                    throw new Error(data.base_resp.status_msg || '接口返回错误 code:' + data.base_resp.status_code);
                }

                /* 提取音频数据 */
                var audioRaw = extractAudioData(data, endpoint);

                if (!audioRaw) {
                    console.error('[语音设置] 无法提取音频，完整响应:', JSON.stringify(data).substring(0, 500));
                    throw new Error('未获取到音频数据，请检查控制台日志');
                }

                console.log('[语音设置] 音频数据长度:', audioRaw.length, '前20字符:', audioRaw.substring(0, 20));

                /* 转换为可播放的 data URL */
                var audioUrl;
                try {
                    audioUrl = audioDataToUrl(audioRaw);
                } catch (convErr) {
                    console.error('[语音设置] 音频转换失败:', convErr);
                    throw new Error('音频数据格式转换失败');
                }

                var audio = new Audio();

                /* 先绑定事件再设置 src */
                audio.oncanplaythrough = function () {
                    audio.play().then(function () {
                        status.textContent = '播放中...';
                        status.className = 'sf-status sf-status-success';
                        if (stopBtn) stopBtn.style.display = '';
                    }).catch(function (playErr) {
                        console.error('[语音设置] 播放失败:', playErr);
                        status.textContent = '播放被阻止，请点击页面后重试';
                        status.className = 'sf-status sf-status-error';
                    });
                };

                audio.onended = function () {
                    status.textContent = '试听完成';
                    if (stopBtn) stopBtn.style.display = 'none';
                    self._currentAudio = null;
                };

                audio.onerror = function (e) {
                    console.error('[语音设置] Audio元素错误:', audio.error);
                    /* 如果 mp3 格式失败，尝试其他格式 */
                    var currentSrc = audio.src || '';
                    if (currentSrc.indexOf('audio/mp3') !== -1) {
                        console.log('[语音设置] mp3格式失败，尝试pcm/wav格式...');
                        tryAlternativeFormat(audioRaw, audio, status, stopBtn, self);
                    } else {
                        status.textContent = '音频播放失败，格式不支持';
                        status.className = 'sf-status sf-status-error';
                    }
                };

                audio.src = audioUrl;
                audio.load();
                self._currentAudio = audio;

            }).catch(function (err) {
                status.textContent = '试听失败: ' + err.message;
                status.className = 'sf-status sf-status-error';
            });
        },

        saveVoice: function (sub) {
            var S = window.Settings;
            var modelEl = sub.querySelector('[data-voice-model].active');
            var langEl = sub.querySelector('[data-voice-lang].active');

            var cfg = {
                apiKey: sub.querySelector('#sf-voice-apikey').value.trim(),
                groupId: sub.querySelector('#sf-voice-groupid').value.trim(),
                model: modelEl ? modelEl.getAttribute('data-voice-model') : 'speech-02',
                speed: parseFloat(sub.querySelector('#sf-voice-speed').value) || 1.0,
                pitch: parseInt(sub.querySelector('#sf-voice-pitch').value) || 0,
                voiceId: sub.querySelector('#sf-voice-voiceid').value.trim(),
                language: langEl ? langEl.getAttribute('data-voice-lang') : '',
                previewText: sub.querySelector('#sf-voice-preview-text').value.trim()
            };

            S.saveSetting('voice_minimax', cfg);
            S.toast('语音设置已保存');
        }
    };

    /* ====== 尝试备用音频格式 ====== */
    function tryAlternativeFormat(audioRaw, audio, status, stopBtn, self) {
        var b64;
        if (isHexString(audioRaw)) {
            b64 = hexToBase64(audioRaw);
        } else {
            b64 = audioRaw;
        }

        /* 尝试 wav 格式 */
        var formats = [
            'data:audio/wav;base64,',
            'data:audio/mpeg;base64,',
            'data:audio/ogg;base64,',
            'data:audio/aac;base64,'
        ];

        var tryIdx = 0;

        function tryNext() {
            if (tryIdx >= formats.length) {
                /* 最终方案：用 Blob 方式播放 */
                tryBlobPlayback(audioRaw, status, stopBtn, self);
                return;
            }
            var url = formats[tryIdx] + b64;
            tryIdx++;

            audio.onerror = function () {
                tryNext();
            };
            audio.oncanplaythrough = function () {
                audio.play().then(function () {
                    status.textContent = '播放中...';
                    status.className = 'sf-status sf-status-success';
                    if (stopBtn) stopBtn.style.display = '';
                }).catch(function () {
                    tryNext();
                });
            };
            audio.src = url;
            audio.load();
        }

        tryNext();
    }

    /* ====== 用 Blob 方式播放（最终兜底） ====== */
    function tryBlobPlayback(audioRaw, status, stopBtn, self) {
        try {
            var bytes;
            if (isHexString(audioRaw)) {
                bytes = new Uint8Array(audioRaw.length / 2);
                for (var i = 0; i < audioRaw.length; i += 2) {
                    bytes[i / 2] = parseInt(audioRaw.substr(i, 2), 16);
                }
            } else {
                /* base64 转 bytes */
                var bin = atob(audioRaw);
                bytes = new Uint8Array(bin.length);
                for (var j = 0; j < bin.length; j++) {
                    bytes[j] = bin.charCodeAt(j);
                }
            }

            var blob = new Blob([bytes], { type: 'audio/mp3' });
            var blobUrl = URL.createObjectURL(blob);

            var audio = new Audio();
            audio.oncanplaythrough = function () {
                audio.play().then(function () {
                    status.textContent = '播放中...';
                    status.className = 'sf-status sf-status-success';
                    if (stopBtn) stopBtn.style.display = '';
                }).catch(function (e) {
                    status.textContent = '播放被浏览器阻止';
                    status.className = 'sf-status sf-status-error';
                });
            };
            audio.onended = function () {
                status.textContent = '试听完成';
                if (stopBtn) stopBtn.style.display = 'none';
                URL.revokeObjectURL(blobUrl);
                self._currentAudio = null;
            };
            audio.onerror = function () {
                status.textContent = '所有播放方式均失败，可能是音频格式不支持';
                status.className = 'sf-status sf-status-error';
                URL.revokeObjectURL(blobUrl);
            };
            audio.src = blobUrl;
            audio.load();
            self._currentAudio = audio;

        } catch (e) {
            console.error('[语音设置] Blob播放失败:', e);
            status.textContent = '音频处理异常: ' + e.message;
            status.className = 'sf-status sf-status-error';
        }
    }

    window.VoiceSettings = VoiceSettings;
})();
