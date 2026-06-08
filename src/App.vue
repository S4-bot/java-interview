<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

const modes = [
  { key: 'quick', label: '30 秒' },
  { key: 'standard', label: '标准' },
  { key: 'deep', label: '深入' },
]

const samples = [
  'Spring Bean 的生命周期是什么？',
  'Redis 缓存穿透、击穿、雪崩分别怎么解决？',
  'MySQL 索引失效的场景有哪些？',
  '线程池的核心参数和拒绝策略怎么理解？',
  'JVM 发生 Full GC 你会怎么排查？',
]

const knowledge = [
  {
    name: 'Spring',
    keys: ['spring', 'bean', 'ioc', 'aop', '事务', '循环依赖'],
    answer:
      'Spring 类问题建议按“容器做什么、关键生命周期、扩展点、项目里怎么用”回答。比如 Bean 生命周期可以从实例化、属性填充、Aware 回调、初始化前后置处理器、初始化方法、可用状态、销毁方法展开。重点补充 BeanPostProcessor、InitializingBean、init-method，以及这些扩展点在日志、代理、事务、配置注入中的作用。',
    follow: ['BeanPostProcessor 和 BeanFactoryPostProcessor 区别？', 'Spring 如何解决循环依赖？', '事务为什么会失效？'],
  },
  {
    name: 'Redis',
    keys: ['redis', '缓存', '穿透', '击穿', '雪崩', '分布式锁'],
    answer:
      'Redis 类问题要先区分场景。缓存穿透是请求不存在的数据，可以用布隆过滤器、空值缓存和参数校验；缓存击穿是热点 Key 过期后大量请求打到数据库，可以用互斥锁、逻辑过期或热点预热；缓存雪崩是大量 Key 同时失效或 Redis 故障，可以用过期时间随机化、多级缓存、限流降级和高可用集群。最后要补一致性、监控和降级。',
    follow: ['缓存和数据库双写怎么保证一致？', 'Redis 分布式锁如何避免误删？', '热 Key 怎么发现和治理？'],
  },
  {
    name: 'MySQL',
    keys: ['mysql', '索引', 'innodb', 'mvcc', '事务', '锁', 'sql'],
    answer:
      'MySQL 类问题建议按“执行计划、索引结构、事务锁、优化手段”回答。索引失效常见原因包括不满足最左前缀、对索引列做函数或表达式、隐式类型转换、like 前置通配符、or 条件不合理、范围查询后续列利用不足、统计信息偏差。工程上要用 EXPLAIN 看 type、key、rows、Extra，再结合慢 SQL、数据分布和业务查询模式优化。',
    follow: ['覆盖索引和回表是什么？', 'MVCC 解决了什么问题？', '间隙锁什么时候出现？'],
  },
  {
    name: '并发',
    keys: ['线程', '线程池', '并发', '锁', 'volatile', 'synchronized', 'juc'],
    answer:
      '并发类问题要体现边界意识。线程池核心参数包括 corePoolSize、maximumPoolSize、keepAliveTime、workQueue、threadFactory、handler。回答时要说明任务进入流程：核心线程、队列、最大线程、拒绝策略。参数不能拍脑袋，要结合 CPU 密集或 IO 密集、响应时间、下游承载能力、队列堆积、异常监控来定。',
    follow: ['线程池队列为什么不能无界？', 'volatile 能不能保证原子性？', 'AQS 的核心思想是什么？'],
  },
  {
    name: 'JVM',
    keys: ['jvm', 'gc', 'full gc', '垃圾回收', '类加载', '内存'],
    answer:
      'JVM 类问题要从运行时内存、对象生命周期、GC 算法和排查工具讲。Full GC 排查可以先看现象和指标，再看 GC 日志、堆 dump、对象增长、老年代占用、元空间、直接内存和代码变更。常用工具包括 jstat、jmap、jstack、arthas、MAT。回答时要强调先定位是内存泄漏、分配过快、晋升失败，还是参数配置不合理。',
    follow: ['G1 和 CMS 的区别？', '对象什么时候进入老年代？', '如何判断内存泄漏？'],
  },
]

const state = reactive({
  question: samples[0],
  transcript: '',
  answer: '',
  mode: 'standard',
  status: '待生成',
  error: '',
})

const listening = ref(false)
const recognitionSupported = ref(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))
let recognition

const isDesktop = computed(() => Boolean(window.assistantAPI?.isDesktop))
const profile = computed(() => findProfile(state.question))
const followUps = computed(() => profile.value.follow)

function findProfile(question) {
  const text = question.toLowerCase()
  return knowledge.find((item) => item.keys.some((key) => text.includes(key))) || {
    name: 'Java 后端综合',
    answer:
      '这类问题建议先明确概念边界，再讲核心流程，最后讲项目落地和取舍。标准回答不要只背定义，要说明它解决什么问题、关键机制是什么、在项目里怎么用、有什么风险、如何排查或优化。',
    follow: ['这个方案的缺点是什么？', '线上出现问题怎么排查？', '有没有更适合高并发的做法？'],
  }
}

function startListening() {
  state.error = ''

  if (!recognitionSupported.value) {
    state.error = '当前运行环境不支持内置语音识别。可以先粘贴模拟面试转写文本，或后续接入 Whisper/讯飞等识别服务。'
    return
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onstart = () => {
    listening.value = true
    state.status = '正在识别练习音频'
  }

  recognition.onresult = (event) => {
    let finalText = ''
    let interimText = ''

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      if (result.isFinal) finalText += result[0].transcript
      else interimText += result[0].transcript
    }

    state.transcript = `${state.transcript}${finalText}`
    const current = `${state.transcript}${interimText}`.trim()
    if (current) state.question = extractQuestion(current)
  }

  recognition.onerror = (event) => {
    state.error = `语音识别失败：${event.error}`
    listening.value = false
  }

  recognition.onend = () => {
    listening.value = false
    state.status = '识别已停止'
  }

  recognition.start()
}

function stopListening() {
  recognition?.stop()
}

function extractQuestion(text) {
  const pieces = text
    .split(/[\n。？！?]/)
    .map((item) => item.trim())
    .filter(Boolean)
  const questionLike = [...pieces].reverse().find((item) => /什么|怎么|如何|为什么|区别|哪些|是否|能不能/.test(item))
  return questionLike || pieces.at(-1) || text
}

async function generateAnswer() {
  state.error = ''
  state.status = '正在生成标准答案'

  const desktopApi = window.assistantAPI
  if (desktopApi?.generateAnswer) {
    const result = await desktopApi.generateAnswer({ question: state.question, mode: state.mode })
    if (result.ok) {
      state.answer = result.answer
      state.status = 'AI 答案已生成'
      return
    }

    state.error = result.error
  }

  state.answer = buildLocalAnswer(state.question, profile.value, state.mode)
  state.status = '本地兜底答案已生成'
}

function buildLocalAnswer(question, item, mode) {
  const brief = [
    `问题：${question}`,
    `标准回答：${item.answer}`,
    `项目落地：我会结合真实业务补充使用场景、监控指标、失败兜底和取舍，避免只背概念。`,
  ]

  if (mode === 'quick') return brief.join('\n\n')

  const standard = [
    ...brief,
    `追问准备：${item.follow.join('；')}`,
    '容易扣分：概念说得太散、没有讲清边界、没有结合项目、没有说明风险和替代方案。',
  ]

  if (mode === 'deep') {
    standard.push('深入补充：可以继续从源码入口、核心数据结构、线程/网络/存储模型、线上排查链路和压测验证几个角度展开。')
  }

  return standard.join('\n\n')
}

function useSample(sample) {
  state.question = sample
  state.transcript = sample
  state.answer = ''
  state.error = ''
}

onBeforeUnmount(() => {
  recognition?.stop()
})
</script>

<template>
  <main class="shell">
    <header class="titlebar">
      <div>
        <p>Practice Popup</p>
        <h1>Java 后端面试训练弹窗</h1>
      </div>
      <div class="badges">
        <span>{{ isDesktop ? '桌面模式' : '浏览器预览' }}</span>
        <span>{{ profile.name }}</span>
        <span>{{ state.status }}</span>
      </div>
    </header>

    <section class="popup">
      <aside class="pane question-pane">
        <div class="pane-head">
          <div>
            <p>左侧弹窗</p>
            <h2>问题识别</h2>
          </div>
          <button class="record" :class="{ active: listening }" type="button" @click="listening ? stopListening() : startListening()">
            {{ listening ? '停止' : '识别' }}
          </button>
        </div>

        <textarea
          v-model="state.question"
          aria-label="识别到的问题"
          placeholder="点击“识别”进行模拟练习语音转写，或粘贴转写后的面试问题。"
        />

        <div class="controls">
          <button
            v-for="mode in modes"
            :key="mode.key"
            :class="{ selected: state.mode === mode.key }"
            type="button"
            @click="state.mode = mode.key"
          >
            {{ mode.label }}
          </button>
        </div>

        <div class="transcript">
          <strong>转写片段</strong>
          <p>{{ state.transcript || '等待练习语音输入。' }}</p>
        </div>

        <div class="samples">
          <button v-for="sample in samples" :key="sample" type="button" @click="useSample(sample)">
            {{ sample }}
          </button>
        </div>
      </aside>

      <section class="pane answer-pane">
        <div class="pane-head">
          <div>
            <p>右侧弹窗</p>
            <h2>标准答案生成</h2>
          </div>
          <button class="generate" type="button" @click="generateAnswer">生成答案</button>
        </div>

        <div v-if="state.error" class="error">{{ state.error }}</div>

        <article class="answer">
          <pre>{{ state.answer || '点击“生成答案”，会根据左侧问题生成可口述的标准答案。配置 OPENAI_API_KEY 后会使用 AI 生成；未配置时使用本地 Java 后端知识库兜底。' }}</pre>
        </article>

        <footer class="followups">
          <div>
            <strong>追问预测</strong>
            <span>{{ profile.name }}</span>
          </div>
          <ol>
            <li v-for="item in followUps" :key="item">{{ item }}</li>
          </ol>
        </footer>
      </section>
    </section>
  </main>
</template>

<style>
:root {
  --bg: #f3efe4;
  --ink: #181b1f;
  --muted: #68706c;
  --line: #d3c8b6;
  --panel: #fffdf7;
  --green: #176b55;
  --red: #bb3f34;
  --blue: #275c94;
  --yellow: #f2c84b;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: var(--bg);
  font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
}

button,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.shell {
  min-height: 100vh;
  padding: 22px;
  background:
    linear-gradient(90deg, rgba(24, 27, 31, 0.05) 1px, transparent 1px),
    linear-gradient(rgba(24, 27, 31, 0.045) 1px, transparent 1px),
    var(--bg);
  background-size: 26px 26px;
}

.titlebar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin: 0 auto 16px;
  max-width: 1320px;
}

.titlebar p,
.pane-head p {
  margin: 0 0 7px;
  color: var(--red);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-family: Georgia, "Microsoft YaHei", serif;
  font-size: clamp(30px, 4vw, 52px);
  line-height: 1;
}

h2 {
  font-size: 22px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.badges span {
  border: 1px solid var(--ink);
  border-radius: 999px;
  padding: 7px 11px;
  background: var(--yellow);
  font-size: 13px;
  font-weight: 900;
  box-shadow: 3px 3px 0 var(--ink);
}

.badges span:nth-child(2) {
  background: #dce9c2;
}

.badges span:nth-child(3) {
  background: #d9e8f7;
}

.popup {
  display: grid;
  grid-template-columns: minmax(340px, 0.9fr) minmax(440px, 1.1fr);
  gap: 16px;
  max-width: 1320px;
  margin: 0 auto;
}

.pane {
  min-height: calc(100vh - 132px);
  border: 2px solid var(--ink);
  border-radius: 8px;
  padding: 18px;
  background: rgba(255, 253, 247, 0.96);
  box-shadow: 7px 7px 0 var(--ink), 0 20px 64px rgba(28, 26, 20, 0.13);
}

.answer-pane {
  display: grid;
  grid-template-rows: auto auto minmax(280px, 1fr) auto;
  gap: 12px;
}

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.record,
.generate,
.controls button,
.samples button {
  border: 2px solid var(--ink);
  border-radius: 8px;
  color: var(--ink);
  background: #fff;
  font-weight: 900;
  transition: transform 130ms ease, box-shadow 130ms ease, background 130ms ease;
}

.record,
.generate {
  min-width: 92px;
  min-height: 42px;
  background: var(--yellow);
}

.record.active {
  color: #fff;
  background: var(--red);
}

.generate {
  color: #fff;
  background: var(--green);
}

button:hover {
  transform: translateY(-1px);
  box-shadow: 3px 3px 0 var(--ink);
}

textarea {
  width: 100%;
  min-height: 210px;
  margin-top: 16px;
  resize: vertical;
  border: 2px solid var(--ink);
  border-radius: 8px;
  padding: 15px;
  color: var(--ink);
  background: #fff;
  outline: none;
  line-height: 1.7;
}

textarea:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px rgba(39, 92, 148, 0.16);
}

.controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 12px 0;
}

.controls button {
  min-height: 40px;
}

.controls .selected {
  color: #fff;
  background: var(--blue);
}

.transcript,
.followups,
.error {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 13px;
  background: #fff8e8;
}

.transcript strong,
.followups strong {
  display: block;
  margin-bottom: 6px;
}

.transcript p {
  min-height: 46px;
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.samples {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.samples button {
  min-height: 42px;
  padding: 9px 11px;
  text-align: left;
}

.error {
  color: #8d2e24;
  background: #ffece8;
  font-weight: 800;
  line-height: 1.5;
}

.answer {
  overflow: auto;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(23, 107, 85, 0.08), transparent 38%),
    #fff;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 20px;
  font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.78;
}

.followups > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.followups span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

ol {
  margin: 8px 0 0;
  padding-left: 22px;
  line-height: 1.7;
}

@media (max-width: 980px) {
  .titlebar {
    align-items: flex-start;
    flex-direction: column;
  }

  .badges {
    justify-content: flex-start;
  }

  .popup {
    grid-template-columns: 1fr;
  }

  .pane {
    min-height: auto;
  }
}
</style>
