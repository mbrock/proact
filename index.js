import { 
  html, spawn, supervise, 
  channel, next, preemptive, select, label, 
  sleep 
} from './proact.js'

let button = ({ text, value = text }) => {
  let click = channel()
  return {
    click, 
    node: spawn({
      name: `Button (${text})`,
      start: async self => {
        self.draw(html`
         <button onclick=${() => click.push(value)}>
           ${text}
         </button>
       `)
        await next(self.quit)
      }
    })
  }
}

let Clock = async (self, { start, pause }) => {
  await next(start)

  let i = 0
  while (true) {
    if (i > 20)
      throw new Error("Crash!")
    
    self.draw(html`<span>${(i / 10.0).toString()}</span>`)
    switch (await select([
      label(sleep(0.1), "slept"),
      label(next(pause), "paused"),
    ])) {
    case "slept": 
      ++i; continue
    case "paused":
      await next(start); continue
    }
  }
}

let Stopwatch = async self => {
  let start = button({ text: "Start" })
  let pause = button({ text: "Pause" })

  let running = false
  let clock = spawn({
    name: "clock", 
    start: Clock,
    link: self,
    args: { 
      start: start.click,
      pause: pause.click,
    }
  })
  
  while (true) {
    self.draw(html`
      <stopwatch>
        ${clock}
        ${start.node}
        ${pause.node}
      </stopwatch>
    `)
    await preemptive(self, [sleep(60)])
  }
}

let Modal = async (self, { title, actions }) => {
  let buttons = Object.entries(actions).map(
    ([k, v]) => button({ text: k, value: v })
  )

  self.draw(html`
    <dialog open>
      <h1>${title}</h1>
      <nav>
        ${buttons.map(x => x.node)}
      </nav>
    </dialog>
  `)
  
  return await select(buttons.map(x => next(x.click)))
}

let YesOrNo = async (self, { question }) =>
  await Modal(self, { 
    title: question, 
    actions: { Yes: true, No: false } 
  })
  
let Flash = async (self, { text }) => {
  self.draw(html`<p>${text}</p>`)
  await sleep(0.5)
}

let Game = async self => {
  await Flash(self, { text: "One!" })
  await Flash(self, { text: "Two!" })
  await Flash(self, { text: "Three!" })
  
  if (await YesOrNo(self, { question: "Show some stopwatches?" })) {
    let w1 = supervise({ name: "Watch 1", start: Stopwatch })
    let w2 = supervise({ name: "Watch 2", start: Stopwatch })
    self.draw(html`
     <div>
       <section>
         <header>Watch 1</header>
         ${w1}
       </section>
       <section>
         <header>Watch 2</header>
         ${w2}
       </section>
     </div>
    `)
  } else
    self.draw(html`<p>Fine.</p>`)

  await sleep(600)
  self.draw(html`<p>Time's up!</p>`)
}

document.body.appendChild(
  spawn({ name: "Game", start: Game })
)
