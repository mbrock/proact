import { 
  html, spawn, supervise, 
  channel, next, preemptive, choose, label, 
  sleep 
} from './proact.js'

let button = ({ text, value = text }) => {
  let click = channel()
  return {
    click, 
    node: spawn({
      name: text,
      start: async ({ draw, quit }) => {
        draw(html`
         <button onclick=${() => click.push(value)}>
           ${text}
         </button>
       `)
        await next(quit)
      }
    })
  }
}

let Clock = async ({ draw, start, pause }) => {
  await next(start)

  let i = 0
  while (true) {
    if (i > 20)
      throw new Error("Crash!")
    
    draw(html`<span>${(i / 10.0).toString()}</span>`)
    switch (await choose([
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

let Stopwatch = async ({ draw, self }) => {
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
    draw(html`
      <stopwatch>
        ${clock}
        ${start.node}
        ${pause.node}
      </stopwatch>
    `)
    await preemptive(self, [sleep(60)])
  }
}

let Modal = async ({ draw, title, actions }) => {
  let buttons = Object.entries(actions).map(
    ([k, v]) => button({ text: k, value: v })
  )

  draw(html`
    <dialog open>
      <h1>${title}</h1>
      <nav>
        ${buttons.map(x => x.node)}
      </nav>
    </dialog>
  `)
  
  return await choose(buttons.map(x => next(x.click)))
}

let YesOrNo = async ({ draw, question }) =>
  await Modal({ 
    draw, 
    title: question, 
    actions: { Yes: true, No: false } 
  })
  
let Flash = async ({ draw, text }) => {
  draw(html`<p>${text}</p>`)
  await sleep(0.5)
}

let Game = async ({ draw }) => {
  await Flash({ draw, text: "One!" })
  await Flash({ draw, text: "Two!" })
  await Flash({ draw, text: "Three!" })
  
  if (await YesOrNo({ draw, question: "Show some stopwatches?" })) {
    let w1 = supervise({ name: "Watch 1", start: Stopwatch })
    let w2 = supervise({ name: "Watch 2", start: Stopwatch })
    draw(html`
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
    draw(html`<p>Fine.</p>`)

  await sleep(600)
  draw(html`<p>Time's up!</p>`)
}

document.body.appendChild(
  spawn({ name: "Game", start: Game })
)
