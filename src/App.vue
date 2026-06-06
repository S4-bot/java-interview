<script setup>
import { reactive, ref } from 'vue'

const form = reactive({
  account: '',
  password: '',
  remember: false,
})

const message = ref('')

function handleLogin() {
  if (!form.account || !form.password) {
    message.value = '请填写账号和密码。'
    return
  }

  message.value = `欢迎回来，${form.account}`
}
</script>

<template>
  <main class="page">
    <section class="media" aria-label="餐馆环境照片">
      <div class="brand-mark">
        <div class="mark" aria-hidden="true">筷</div>
        <span>禾味餐馆</span>
      </div>
      <div class="media-content">
        <h1>欢迎回来</h1>
        <p>登录餐馆管理后台，查看今日预订、桌台状态、菜单更新与会员订单。</p>
      </div>
    </section>

    <section class="login-side">
      <div class="login-box">
        <p class="eyebrow">RESTAURANT PORTAL</p>
        <h2>餐馆账号登录</h2>
        <p class="subtext">请输入手机号或邮箱，继续管理门店营业信息。</p>

        <form @submit.prevent="handleLogin">
          <label for="account">
            手机号或邮箱
            <input
              id="account"
              v-model.trim="form.account"
              name="account"
              type="text"
              autocomplete="username"
              placeholder="例如 13800000000"
            >
          </label>

          <label for="password">
            登录密码
            <input
              id="password"
              v-model="form.password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="请输入密码"
            >
          </label>

          <div class="row">
            <label class="remember" for="remember">
              <input id="remember" v-model="form.remember" name="remember" type="checkbox">
              记住本机登录状态
            </label>
            <a href="#" @click.prevent>忘记密码？</a>
          </div>

          <button type="submit">登录</button>
          <p v-if="message" class="form-message" role="status">{{ message }}</p>
        </form>

        <div class="divider">或</div>

        <p class="register">还没有门店账号？ <a href="#" @click.prevent>申请入驻</a></p>

        <div class="notice">
          <div class="notice-icon" aria-hidden="true">桌</div>
          <div>营业高峰期建议使用门店管理员账号登录，以便同步桌台与订单权限。</div>
        </div>
      </div>
    </section>
  </main>
</template>

<style>
:root {
  --ink: #1f2933;
  --muted: #6b7280;
  --line: #d7dce2;
  --paper: #fffaf2;
  --panel: #ffffff;
  --accent: #b8452a;
  --accent-dark: #8f311e;
  --olive: #50623a;
  --focus: rgba(184, 69, 42, 0.22);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
  color: var(--ink);
  background: var(--paper);
}

button,
input {
  font: inherit;
}

a {
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}

a:hover {
  color: var(--accent-dark);
  text-decoration: underline;
}

.page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(360px, 1.05fr) minmax(360px, 0.95fr);
}

.media {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    linear-gradient(110deg, rgba(20, 24, 18, 0.72), rgba(20, 24, 18, 0.18)),
    url("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80") center / cover;
}

.media-content {
  position: absolute;
  inset: auto 48px 46px 48px;
  max-width: 560px;
  color: #fff;
}

.brand-mark {
  position: absolute;
  top: 40px;
  left: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0;
}

.mark {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.34);
  backdrop-filter: blur(10px);
  font-size: 23px;
}

.media h1 {
  margin: 0 0 14px;
  font-size: clamp(38px, 5vw, 72px);
  line-height: 1;
  letter-spacing: 0;
}

.media p {
  margin: 0;
  max-width: 480px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 18px;
  line-height: 1.7;
}

.login-side {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 250, 242, 0.9)),
    radial-gradient(circle at top right, rgba(80, 98, 58, 0.12), transparent 36%);
}

.login-box {
  width: min(100%, 440px);
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--olive);
  font-size: 14px;
  font-weight: 700;
}

.login-box h2 {
  margin: 0 0 12px;
  font-size: 34px;
  line-height: 1.15;
  letter-spacing: 0;
}

.subtext {
  margin: 0 0 32px;
  color: var(--muted);
  line-height: 1.7;
}

form {
  display: grid;
  gap: 18px;
}

label {
  display: grid;
  gap: 8px;
  color: #374151;
  font-size: 14px;
  font-weight: 700;
}

input {
  width: 100%;
  min-height: 50px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 15px;
  color: var(--ink);
  background: var(--panel);
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--focus);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 2px;
  font-size: 14px;
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-weight: 500;
}

.remember input {
  width: 16px;
  height: 16px;
  min-height: 0;
  accent-color: var(--accent);
}

button {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: var(--accent);
  font-weight: 800;
  cursor: pointer;
  transition: background 160ms ease, transform 160ms ease;
}

button:hover {
  background: var(--accent-dark);
  transform: translateY(-1px);
}

.form-message {
  margin: -4px 0 0;
  color: var(--olive);
  font-size: 14px;
  font-weight: 700;
}

.divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 28px 0;
  color: var(--muted);
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: "";
  height: 1px;
  flex: 1;
  background: var(--line);
}

.register {
  margin: 0;
  color: var(--muted);
  text-align: center;
  line-height: 1.6;
}

.notice {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: center;
  margin-top: 30px;
  padding: 14px;
  border: 1px solid rgba(80, 98, 58, 0.18);
  border-radius: 8px;
  background: rgba(80, 98, 58, 0.08);
  color: #465338;
  font-size: 13px;
  line-height: 1.5;
}

.notice-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(80, 98, 58, 0.13);
  font-size: 20px;
}

@media (max-width: 820px) {
  .page {
    grid-template-columns: 1fr;
  }

  .media {
    min-height: 34vh;
  }

  .brand-mark {
    top: 24px;
    left: 24px;
  }

  .media-content {
    inset: auto 24px 28px 24px;
  }

  .media h1 {
    font-size: 40px;
  }

  .media p {
    font-size: 15px;
  }

  .login-side {
    min-height: auto;
    padding: 34px 20px 40px;
    align-items: flex-start;
  }

  .login-box h2 {
    font-size: 29px;
  }
}

@media (max-width: 460px) {
  .row {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .notice {
    grid-template-columns: 1fr;
  }
}
</style>
