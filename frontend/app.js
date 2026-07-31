import { listUsers, sendMessage } from "./api.js";
import { loadSession, clearSession, initialScreen } from "./storage.js";
import { completeRegistration } from "./register.js";

export function getAppTitle() {
  return "PWA Push Messenger";
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

        <section t-if="state.screen === 'compose'" class="screen">
          <h1>Сообщение</h1>
          <p class="compose-to">Кому: <t t-esc="state.recipient.name"/></p>
          <div class="send-row">
            <textarea t-model="state.text" placeholder="Текст сообщения"></textarea>
            <button class="plane" title="Отправить" t-on-click="onSend" t-att-disabled="state.busy">✈</button>
          </div>
          <div class="actions">
            <button class="secondary" t-on-click="backToUsers">К списку</button>
          </div>
          <p t-if="state.status" class="status" t-esc="state.status"/>
          <p t-if="state.error" class="error" t-esc="state.error"/>
        </section>
      </div>
    `;

    setup() {
      const session = loadSession();
      const install = getInstallEventHolder();
      this.state = useState({
        screen: initialScreen(session),
        session,
        name: "",
        users: [],
        recipient: null,
        text: "",
        error: "",
        status: "",
        busy: false,
        deferredInstall: install.event,
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

    selectUser(user) {
      if (!this.state.session || user.id === this.state.session.userId) {
        this.state.error = "Выберите другого пользователя";
        return;
      }
      this.state.error = "";
      this.state.recipient = user;
      this.state.text = "";
      this.state.status = "";
      this.state.screen = "compose";
    }

    backToUsers() {
      this.state.screen = "users";
      this.state.recipient = null;
      this.refreshUsers();
    }

    logout() {
      clearSession();
      this.state.session = null;
      this.state.screen = "register";
      this.state.users = [];
      this.state.error = "";
    }

    async onSend() {
      this.state.error = "";
      this.state.status = "";
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
        this.state.status = `Отправлено (${message.push_status})`;
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
