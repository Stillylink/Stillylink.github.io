
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    getDocs,
    serverTimestamp,
    limit,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
    getAuth,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import { getApps } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";


const app  = getApps()[0];
const db   = getFirestore(app);

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML.replace(/\n/g, '<br>');
}

function formatTime(ts) {
    if (!ts) return '';
    try {
        const date = typeof ts.toDate === 'function'
            ? ts.toDate()
            : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
        const now  = new Date();
        const diff = now - date;
        const mins  = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days  = Math.floor(diff / 86400000);
        if (mins  < 1)  return 'Только что';
        if (mins  < 60) return `${mins} мин. назад`;
        if (hours < 24) return `${hours} ч. назад`;
        if (days  < 7)  return `${days} дн. назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    } catch { return ''; }
}


export class QuestionsModule {

    constructor(container, profileOwnerUID, isOwner, currentUser, currentUserData) {
        this.container       = container;
        this.profileOwnerUID = profileOwnerUID;
        this.isOwner         = isOwner;
        this.currentUser     = currentUser;
        this.currentUserData = currentUserData;

        this.ownerTab = 'pending'; // 'pending' | 'answered'

        this._unsubPending  = null;
        this._unsubAnswered = null;

        this.render();
    }


    render() {
        this.container.innerHTML = '';
        if (this.isOwner) {
            this._renderOwnerView();
        } else {
            this._renderGuestView();
        }
    }

    _renderOwnerView() {
        this.container.innerHTML = `
            <div class="q-owner-tabs">
                <button class="q-owner-tab active" data-tab="pending">Новые</button>
                <button class="q-owner-tab" data-tab="answered">Ответы</button>
                <div class="q-owner-tabs-indicator"></div>
            </div>
            <div class="q-list" id="qList"></div>
        `;

        this._indicator = this.container.querySelector('.q-owner-tabs-indicator');
        this._qList     = this.container.querySelector('#qList');

        this.container.querySelectorAll('.q-owner-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab === this.ownerTab) return;
                this.ownerTab = tab;
                this.container.querySelectorAll('.q-owner-tab').forEach(b =>
                    b.classList.toggle('active', b.dataset.tab === tab)
                );
                this._updateOwnerIndicator();
                this._loadOwnerList();
            });
        });

        this._updateOwnerIndicator(false);
        this._loadOwnerList();
    }

    _updateOwnerIndicator(animate = true) {
        const activeBtn = this.container.querySelector(`.q-owner-tab[data-tab="${this.ownerTab}"]`);
        if (!activeBtn || !this._indicator) return;
        this._indicator.style.transition = animate
            ? 'left 250ms cubic-bezier(0.25,0.46,0.45,0.94), width 250ms cubic-bezier(0.25,0.46,0.45,0.94)'
            : 'none';
        this._indicator.style.left  = `${activeBtn.offsetLeft}px`;
        this._indicator.style.width = `${activeBtn.offsetWidth}px`;
    }

    _loadOwnerList() {
        if (this._unsubPending)  { this._unsubPending();  this._unsubPending  = null; }
        if (this._unsubAnswered) { this._unsubAnswered(); this._unsubAnswered = null; }

        this._qList.innerHTML = `<div class="q-loading"><div class="spinner"></div></div>`;

        const status = this.ownerTab;

        const q = query(
            collection(db, 'questions'),
            where('toUserId', '==', this.profileOwnerUID),
            where('status',   '==', status),
            orderBy('timestamp', 'desc')
        );

        const unsub = onSnapshot(q, snap => {
            this._qList.innerHTML = '';

            if (snap.empty) {
                this._qList.innerHTML = `
                    <div class="q-empty">
                        <div class="q-empty-icon">${status === 'pending' ? '📭' : '💬'}</div>
                        <div class="q-empty-text">${status === 'pending' ? 'Новых вопросов нет' : 'Отвеченных вопросов пока нет'}</div>
                    </div>`;
                return;
            }

            snap.forEach(docSnap => {
                this._qList.appendChild(
                    this._buildOwnerCard(docSnap.id, docSnap.data())
                );
            });
        }, err => {
            console.error('Ошибка загрузки вопросов:', err);
            this._qList.innerHTML = `<div class="q-empty"><div class="q-empty-text">Ошибка загрузки</div></div>`;
        });

        if (status === 'pending') this._unsubPending  = unsub;
        else                      this._unsubAnswered = unsub;
    }

    _buildOwnerCard(id, data) {
        const card = document.createElement('div');
        card.className = 'q-card';
        card.dataset.qid = id;

        const authorHtml = data.isAnonymous
            ? '<span class="q-author-anon">Анонимный вопрос</span>'
            : `<a href="/profile/?u=${escapeHtml(data.fromUserNameId || '')}" class="q-author-link">@${escapeHtml(data.fromUserName || 'Пользователь')}</a>`;

        const answeredBlock = data.status === 'answered' ? `
            <div class="q-answer-block">
                <div class="q-answer-label">Ваш ответ:</div>
                <div class="q-answer-text">${escapeHtml(data.answer || '')}</div>
            </div>` : '';

        const actionBlock = data.status === 'pending' ? `
            <div class="q-reply-area hidden" id="replyArea_${id}">
                <textarea class="q-reply-input" placeholder="Введите ответ..." rows="3"></textarea>
                <div class="q-reply-actions">
                    <button class="q-btn q-btn-cancel" data-action="cancel" data-qid="${id}">Отмена</button>
                    <button class="q-btn q-btn-send"   data-action="send"   data-qid="${id}">Ответить</button>
                </div>
            </div>
            <div class="q-card-actions">
                <button class="q-btn q-btn-reply"  data-action="reply"  data-qid="${id}">Ответить</button>
                <button class="q-btn q-btn-delete" data-action="delete" data-qid="${id}">Удалить</button>
            </div>` : `
            <div class="q-card-actions">
                <button class="q-btn q-btn-delete" data-action="delete" data-qid="${id}">Удалить</button>
            </div>`;

        card.innerHTML = `
            <div class="q-card-header">
                ${authorHtml}
                <span class="q-time">${formatTime(data.timestamp)}</span>
            </div>
            <div class="q-text">${escapeHtml(data.text)}</div>
            ${answeredBlock}
            ${actionBlock}
        `;

        card.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const qid    = btn.dataset.qid;

                if (action === 'reply') {
                    card.querySelector(`#replyArea_${qid}`)?.classList.remove('hidden');
                    card.querySelector('.q-card-actions')?.classList.add('hidden');
                    card.querySelector('textarea')?.focus();
                }

                if (action === 'cancel') {
                    card.querySelector(`#replyArea_${qid}`)?.classList.add('hidden');
                    card.querySelector('.q-card-actions')?.classList.remove('hidden');
                }

                if (action === 'send') {
                    const text = card.querySelector('textarea')?.value?.trim();
                    if (!text) return;
                    this._sendAnswer(qid, text, btn);
                }

                if (action === 'delete') {
                    this._deleteQuestion(qid);
                }
            });
        });

        return card;
    }

    async _sendAnswer(qid, answerText, btn) {
        btn.disabled    = true;
        btn.textContent = 'Отправка...';
        try {
            await updateDoc(doc(db, 'questions', qid), {
                answer:      answerText,
                status:      'answered',
                answeredAt:  serverTimestamp(),
            });
        } catch (e) {
            console.error('Ошибка отправки ответа:', e);
            alert('Не удалось отправить ответ');
            btn.disabled    = false;
            btn.textContent = 'Ответить';
        }
    }

    async _deleteQuestion(qid) {
        if (!confirm('Удалить вопрос?')) return;
        try {
            await deleteDoc(doc(db, 'questions', qid));
        } catch (e) {
            console.error('Ошибка удаления:', e);
            alert('Не удалось удалить вопрос');
        }
    }


    _renderGuestView() {
        const canAsk = !!this.currentUser;

        const formHtml = canAsk ? `
            <div class="q-form">
                <textarea class="q-form-input" id="qFormInput" placeholder="Задайте вопрос..." rows="3"></textarea>
                <div class="q-form-footer">
                    <label class="q-anon-label">
                        <input type="checkbox" id="qAnonCheck" class="q-anon-check">
                        <span>Задать анонимно</span>
                    </label>
                    <button class="q-btn q-btn-send" id="qSendBtn">Отправить</button>
                </div>
            </div>` : `
            <div class="q-auth-notice">
                <span>Чтобы задать вопрос, </span>
                <a href="/login/">войдите в аккаунт</a>
            </div>`;

        this.container.innerHTML = `
            ${formHtml}
            <div class="q-list" id="qList"></div>
        `;

        this._qList = this.container.querySelector('#qList');

        if (canAsk) {
            this.container.querySelector('#qSendBtn')
                ?.addEventListener('click', () => this._submitQuestion());
        }

        this._loadAnsweredList();
    }

    _loadAnsweredList() {
        this._qList.innerHTML = `<div class="q-loading"><div class="spinner"></div></div>`;

        const q = query(
            collection(db, 'questions'),
            where('toUserId', '==', this.profileOwnerUID),
            where('status',   '==', 'answered'),
            orderBy('timestamp', 'desc')
        );

        this._unsubAnswered = onSnapshot(q, snap => {
            this._qList.innerHTML = '';

            if (snap.empty) {
                this._qList.innerHTML = `
                    <div class="q-empty">
                        <div class="q-empty-icon">💬</div>
                        <div class="q-empty-text">Отвеченных вопросов пока нет</div>
                    </div>`;
                return;
            }

            snap.forEach(docSnap => {
                this._qList.appendChild(
                    this._buildGuestCard(docSnap.id, docSnap.data())
                );
            });
        }, err => {
            console.error('Ошибка загрузки ответов:', err);
        });
    }

    _buildGuestCard(id, data) {
        const card = document.createElement('div');
        card.className = 'q-card';
        card.dataset.qid = id;

        const authorHtml = data.isAnonymous
            ? '<span class="q-author-anon">Анонимный вопрос</span>'
            : `<a href="/profile/?u=${escapeHtml(data.fromUserNameId || '')}" class="q-author-link">@${escapeHtml(data.fromUserName || 'Пользователь')}</a>`;

        card.innerHTML = `
            <div class="q-card-header">
                ${authorHtml}
                <span class="q-time">${formatTime(data.timestamp)}</span>
            </div>
            <div class="q-text">${escapeHtml(data.text)}</div>
            <div class="q-answer-block">
                <div class="q-answer-label">Ответ:</div>
                <div class="q-answer-text">${escapeHtml(data.answer || '')}</div>
            </div>
        `;

        return card;
    }

    async _submitQuestion() {
        const input   = this.container.querySelector('#qFormInput');
        const anonChk = this.container.querySelector('#qAnonCheck');
        const sendBtn = this.container.querySelector('#qSendBtn');
        const text    = input?.value?.trim();

        if (!text) { input?.focus(); return; }
        if (!this.currentUser) return;

        sendBtn.disabled    = true;
        sendBtn.textContent = 'Проверка...';

        try {
            // Лимит: считаем ВСЕ вопросы от этого пользователя (любой статус)
            const limitQ = query(
                collection(db, 'questions'),
                where('toUserId',   '==', this.profileOwnerUID),
                where('fromUserId', '==', this.currentUser.uid),
                limit(6)
            );
            const limitSnap = await getDocs(limitQ);

            if (limitSnap.size >= 5) {
                alert('Вы уже задали 5 вопросов этому пользователю.');
                sendBtn.disabled    = false;
                sendBtn.textContent = 'Отправить';
                return;
            }

            const isAnon = anonChk?.checked ?? false;

            await addDoc(collection(db, 'questions'), {
                toUserId:       this.profileOwnerUID,
                fromUserId:     this.currentUser.uid,
                fromUserName:   isAnon ? null : (this.currentUserData?.usernameID || null),
                fromUserNameId: isAnon ? null : (this.currentUserData?.usernameID || null),
                text,
                isAnonymous:    isAnon,
                status:         'pending',
                answer:         null,
                timestamp:      serverTimestamp(),
            });

            input.value = '';
            if (anonChk) anonChk.checked = false;
            sendBtn.disabled    = false;
            sendBtn.textContent = 'Отправить';

        } catch (e) {
            console.error('Ошибка отправки вопроса:', e);
            alert('Не удалось отправить вопрос');
            sendBtn.disabled    = false;
            sendBtn.textContent = 'Отправить';
        }
    }

    // ========================
    // УНИЧТОЖЕНИЕ
    // ========================
    destroy() {
        if (this._unsubPending)  this._unsubPending();
        if (this._unsubAnswered) this._unsubAnswered();
    }
}
