import {
  listUsers,
  sendMessage,
  getMessage,
  listMessages,
  listStaleUsers,
  purgeStaleUsers,
  deleteUser,
} from "./api.js";
import { loadSession, clearSession, initialScreen } from "./storage.js";
import { completeRegistration } from "./register.js";

export const MESSAGE_PAGE_SIZE = 10;

export function getAppTitle() {
  return "PWA Push Messenger";
}

export function formatPushStatus(status, pushError = "") {
  switch (status) {
    case "pending":
      return "Отправляется…";
    case "sent":
      return "Отправлено push-сервису, ждём доставку получателю…";
    case "delivered":
      return "Доставлено получателю";
    case "failed": {
      const detail = String(pushError || "").trim();
      if (/unsubscribed or expired|unexpected response code|410/i.test(detail)) {
        return "Не удалось отправить: у получателя устарела push-подписка — пусть перерегистрируется";
      }
      return detail ? `Не удалось отправить: ${detail}` : "Не удалось отправить";
    }
    default:
      return status ? String(status) : "";
  }
}

export function formatPushStatusShort(status) {
  switch (status) {
    case "pending":
      return "отправка";
    case "sent":
      return "в пути";
    case "delivered":
      return "доставлено";
    case "failed":
      return "ошибка";
    default:
      return status ? String(status) : "";
  }
}

export function getInstallEventHolder(win = globalThis) {
  if (!win.__pwaInstall) {
    win.__pwaInstall = { event: null };
    if (typeof win.addEventListener === "function") {
      win.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        win.__pwaInstall.event = event;
      });
    }
  }
  return win.__pwaInstall;
}

export function createAppComponent(owlApi = globalThis.owl) {
  if (!owlApi) {
    throw new Error("OWL library is not loaded");
  }
  const { Component, xml, useState } = owlApi;

  class App extends Component {
    static template = xml`
      <div class="shell">
        <div class="topbar">
          <div class="brand">PWA Push Messenger</div>
          <button t-if="state.deferredInstall" class="secondary" t-on-click="installApp">
            Установить
          </button>
        </div>

        <section t-if="state.screen === 'register'" class="screen">
          <h1>Как вас зовут?</h1>
          <p class="hint">Имя должно быть уникальным. Мы запросим разрешение на push.</p>
          <label for="name">Имя</label>
          <input id="name" t-model="state.name" placeholder="Например, Алиса" />
          <div class="actions">
            <button t-on-click="onRegister" t-att-disabled="state.busy">Продолжить</button>
          </div>
          <p t-if="state.error" class="error" t-esc="state.error"/>
        </section>

        <section t-if="state.screen === 'users'" class="screen">
          <h1>Кому написать?</h1>
          <p class="hint">Вы: <t t-esc="state.session.userName"/>. Список обновляется вручную.</p>
          <div class="actions">
            <button class="secondary" t-on-click="refreshUsers" t-att-disabled="state.busy">Обновить</button>
            <button class="secondary" t-on-click="openService" t-att-disabled="state.busy">Сервис</button>
            <button class="secondary" t-on-click="logout">Сменить имя</button>
          </div>
          <ul class="user-list">
            <li t-foreach="state.users" t-as="user" t-key="user.id">
              <button class="user" t-att-class="{ me: user.id === state.session.userId }"
                      t-on-click="() => this.selectUser(user)">
                <t t-esc="user.name"/>
                <t t-if="user.id === state.session.userId"> (вы)</t>
              </button>
            </li>
          </ul>
          <p t-if="state.error" class="error" t-esc="state.error"/>
        </section>

        <section t-if="state.screen === 'service'" class="screen">
          <h1>Сервис</h1>
          <p class="hint">
            Удаляет пользователей с протухшей push-подпиской и все их сообщения.
            Ваш аккаунт не трогаем.
          </p>
          <div class="actions">
            <button class="secondary" t-on-click="refreshStale" t-att-disabled="state.busy">Обновить список</button>
            <button t-on-click="onPurgeStale" t-att-disabled="state.busy || !state.staleUsers.length">
              Удалить протухшие
            </button>
          </div>
          <ul class="user-list stale-list">
            <li t-foreach="state.staleUsers" t-as="user" t-key="user.id" class="stale-row">
              <div class="stale-info">
                <strong t-esc="user.name"/>
                <span class="hint">ошибок push: <t t-esc="user.failed_count"/></span>
              </div>
              <button class="secondary danger" t-on-click="() => this.onDeleteUser(user)"
                      t-att-disabled="state.busy">
                Удалить
              </button>
            </li>
          </ul>
          <p t-if="!state.staleUsers.length" class="hint">Протухших пользователей нет.</p>
          <p t-if="state.status" class="status ok" t-esc="state.status"/>
          <div class="actions">
            <button class="secondary" t-on-click="backToUsers">К списку</button>
          </div>
          <p t-if="state.error" class="error" t-esc="state.error"/>
        </section>

        <section t-if="state.screen === 'compose'" class="screen">
          <h1>Диалог</h1>
          <p class="compose-to">С: <t t-esc="state.recipient.name"/></p>

          <div class="thread-toolbar">
            <button class="secondary" t-on-click="refreshThread" t-att-disabled="state.busy">
              Обновить статусы
            </button>
            <span class="thread-meta" t-esc="threadMeta()"/>
          </div>

          <ul class="thread">
            <li t-foreach="state.messages" t-as="msg" t-key="msg.id"
                t-att-class="{
                  mine: msg.from_user_id === state.session.userId,
                  theirs: msg.from_user_id !== state.session.userId,
                }">
              <div class="bubble-text" t-esc="msg.text"/>
              <div class="bubble-meta">
                <span t-esc="directionLabel(msg)"/>
                <span t-att-class="{
                  'push-tag': true,
                  ok: msg.push_status === 'delivered',
                  bad: msg.push_status === 'failed',
                  wait: msg.push_status === 'sent' || msg.push_status === 'pending',
                }" t-esc="statusShort(msg.push_status)"/>
              </div>
            </li>
          </ul>
          <p t-if="!state.messages.length" class="hint">Пока нет сообщений в этой переписке.</p>

          <div class="pager" t-if="state.messagesTotal > state.messagesLimit">
            <button class="secondary"
                    t-on-click="prevPage"
                    t-att-disabled="state.busy || !canNewer()">
              Новее
            </button>
            <button class="secondary"
                    t-on-click="nextPage"
                    t-att-disabled="state.busy || !hasOlder()">
              Старее
            </button>
          </div>

          <div class="send-row">
            <textarea t-model="state.text" placeholder="Текст сообщения"></textarea>
            <button class="plane" title="Отправить" t-on-click="onSend" t-att-disabled="state.busy">✈</button>
          </div>
          <div class="actions">
            <button class="secondary" t-on-click="backToUsers">К списку</button>
          </div>
          <p t-if="state.status" class="status" t-att-class="{
            ok: state.pushStatus === 'delivered',
            bad: state.pushStatus === 'failed',
          }" t-esc="state.status"/>
          <p t-if="state.error" class="error" t-esc="state.error"/>
        </section>
      </div>
    `;

    setup() {
      const session = loadSession();
      const install = getInstallEventHolder();
      this._deliveryPollId = null;
      this.state = useState({
        screen: initialScreen(session),
        session,
        name: "",
        users: [],
        recipient: null,
        text: "",
        error: "",
        status: "",
        pushStatus: "",
        busy: false,
        deferredInstall: install.event,
        messages: [],
        messagesTotal: 0,
        messagesLimit: MESSAGE_PAGE_SIZE,
        messagesOffset: 0,
        staleUsers: [],
      });

      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        install.event = event;
        this.state.deferredInstall = event;
      });

      if (this.state.screen === "users") {
        this.refreshUsers();
      }
    }

    statusShort(status) {
      return formatPushStatusShort(status);
    }

    directionLabel(msg) {
      return msg.from_user_id === this.state.session.userId ? "вы →" : "← им";
    }

    threadMeta() {
      const { messagesTotal, messagesOffset, messagesLimit, messages } = this.state;
      if (!messagesTotal) {
        return "0 сообщений";
      }
      const from = messagesOffset + 1;
      const to = messagesOffset + messages.length;
      return `${from}–${to} из ${messagesTotal}`;
    }

    hasOlder() {
      return this.state.messagesOffset + this.state.messages.length < this.state.messagesTotal;
    }

    canNewer() {
      return this.state.messagesOffset > 0;
    }

    stopDeliveryPoll() {
      this._deliveryPollId = null;
    }

    async watchDelivery(messageId) {
      this._deliveryPollId = messageId;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        if (this._deliveryPollId !== messageId) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (this._deliveryPollId !== messageId) {
          return;
        }
        try {
          const message = await getMessage(fetch, window.location.origin, messageId);
          this.state.pushStatus = message.push_status;
          this.state.status = formatPushStatus(message.push_status, message.push_error);
          const idx = this.state.messages.findIndex((item) => item.id === messageId);
          if (idx >= 0) {
            this.state.messages[idx] = {
              ...this.state.messages[idx],
              push_status: message.push_status,
              updated_at: message.updated_at,
            };
          }
          if (message.push_status === "delivered" || message.push_status === "failed") {
            return;
          }
        } catch {
          // сеть могла моргнуть — продолжаем ждать ack
        }
      }
      if (this._deliveryPollId === messageId && this.state.pushStatus === "sent") {
        this.state.status =
          "Отправлено push-сервису, но подтверждение от получателя пока не пришло";
      }
    }

    async loadThread({ offset = this.state.messagesOffset } = {}) {
      if (!this.state.session || !this.state.recipient) {
        return;
      }
      const data = await listMessages(fetch, window.location.origin, {
        userId: this.state.session.userId,
        peerId: this.state.recipient.id,
        limit: this.state.messagesLimit,
        offset,
      });
      this.state.messages = data.items || [];
      this.state.messagesTotal = data.total || 0;
      this.state.messagesOffset = data.offset ?? offset;
      this.state.messagesLimit = data.limit || this.state.messagesLimit;
    }

    async refreshThread() {
      this.state.error = "";
      this.state.busy = true;
      try {
        await this.loadThread({ offset: this.state.messagesOffset });
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async nextPage() {
      if (!this.hasOlder()) {
        return;
      }
      this.state.error = "";
      this.state.busy = true;
      try {
        await this.loadThread({
          offset: this.state.messagesOffset + this.state.messagesLimit,
        });
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async prevPage() {
      if (this.state.messagesOffset <= 0) {
        return;
      }
      this.state.error = "";
      this.state.busy = true;
      try {
        await this.loadThread({
          offset: Math.max(0, this.state.messagesOffset - this.state.messagesLimit),
        });
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async installApp() {
      const install = getInstallEventHolder();
      if (!install.event) return;
      install.event.prompt();
      await install.event.userChoice;
      install.event = null;
      this.state.deferredInstall = null;
    }

    async onRegister() {
      this.state.error = "";
      this.state.busy = true;
      try {
        const user = await completeRegistration({ name: this.state.name });
        this.state.session = loadSession();
        this.state.screen = "users";
        this.state.name = user.name;
        await this.refreshUsers();
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async refreshUsers() {
      this.state.error = "";
      this.state.busy = true;
      try {
        this.state.users = await listUsers(fetch, window.location.origin);
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async openService() {
      this.state.error = "";
      this.state.status = "";
      this.state.screen = "service";
      await this.refreshStale();
    }

    async refreshStale() {
      if (!this.state.session) {
        return;
      }
      this.state.error = "";
      this.state.busy = true;
      try {
        const data = await listStaleUsers(
          fetch,
          window.location.origin,
          this.state.session.userId,
        );
        this.state.staleUsers = data.items || [];
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async onPurgeStale() {
      if (!this.state.session) {
        return;
      }
      if (
        !window.confirm(
          "Удалить всех пользователей с протухшей подпиской и их сообщения?",
        )
      ) {
        return;
      }
      this.state.error = "";
      this.state.status = "";
      this.state.busy = true;
      try {
        const result = await purgeStaleUsers(
          fetch,
          window.location.origin,
          this.state.session.userId,
        );
        this.state.status = `Удалено пользователей: ${result.deleted_user_count}, сообщений: ${result.deleted_message_count}`;
        this.state.staleUsers = [];
        await this.refreshStale();
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async onDeleteUser(user) {
      if (!this.state.session) {
        return;
      }
      if (!window.confirm(`Удалить «${user.name}» и все связанные сообщения?`)) {
        return;
      }
      this.state.error = "";
      this.state.status = "";
      this.state.busy = true;
      try {
        const result = await deleteUser(
          fetch,
          window.location.origin,
          user.id,
          this.state.session.userId,
        );
        this.state.status = `Удалён «${user.name}», сообщений: ${result.deleted_message_count}`;
        await this.refreshStale();
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    async selectUser(user) {
      if (!this.state.session || user.id === this.state.session.userId) {
        this.state.error = "Выберите другого пользователя";
        return;
      }
      this.stopDeliveryPoll();
      this.state.error = "";
      this.state.recipient = user;
      this.state.text = "";
      this.state.status = "";
      this.state.pushStatus = "";
      this.state.messages = [];
      this.state.messagesTotal = 0;
      this.state.messagesOffset = 0;
      this.state.screen = "compose";
      this.state.busy = true;
      try {
        await this.loadThread({ offset: 0 });
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }

    backToUsers() {
      this.stopDeliveryPoll();
      this.state.screen = "users";
      this.state.recipient = null;
      this.state.messages = [];
      this.refreshUsers();
    }

    logout() {
      this.stopDeliveryPoll();
      clearSession();
      this.state.session = null;
      this.state.screen = "register";
      this.state.users = [];
      this.state.messages = [];
      this.state.error = "";
    }

    async onSend() {
      this.state.error = "";
      this.state.status = "";
      this.state.pushStatus = "";
      const text = this.state.text.trim();
      if (!text) {
        this.state.error = "Введите текст";
        return;
      }
      this.state.busy = true;
      try {
        const message = await sendMessage(fetch, window.location.origin, {
          from_user_id: this.state.session.userId,
          to_user_id: this.state.recipient.id,
          text,
        });
        this.state.text = "";
        this.state.pushStatus = message.push_status;
        this.state.status = formatPushStatus(message.push_status, message.push_error);
        this.state.messagesOffset = 0;
        await this.loadThread({ offset: 0 });
        if (message.push_status === "sent") {
          this.watchDelivery(message.id);
        }
      } catch (err) {
        this.state.error = err.message || String(err);
      } finally {
        this.state.busy = false;
      }
    }
  }

  return App;
}

if (typeof document !== "undefined" && globalThis.owl) {
  const App = createAppComponent();
  globalThis.owl.mount(App, document.getElementById("app"));
}
