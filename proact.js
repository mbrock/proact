import htm from 'https://unpkg.com/htm?module'

// This is a "Hyperscript" callback for the htm module.
// It just creates DOM elements directly, no "VDOM."
let h = (type, attrs, ...children) => {
  let element = document.createElement(type)

  for (let [k, v] of Object.entries(attrs || {})) {
    if (typeof v == "function")
      // E.g. "onclick".
      element[k] = v
    else
      // E.g. "checked".
      element.setAttribute(k, v)
  }

  for (let x of children) {
    try {
      if (typeof x == "string")
        element.appendChild(document.createTextNode(x))
      else if (Array.isArray(x))
        x.forEach(y => element.appendChild(y))
      else
        element.appendChild(x)
    } catch (e) {
      console.error(type, x, e)
      throw e
    }
  }

  return element
}

// See https://github.com/developit/htm for usage.
export let html = htm.bind(h)

// spawn() just creates a mutable DOM element, let's call it a
// "process element," and runs the given start callback with a draw
// function that mutates the process element.
//
// The idea is that the start callback will be an asynchronous process
// (async/await) that continually updates the process element with
// new content.
export let spawn = ({
  name, start, link, args = {}
}) => {
  let self = html`<process name=${name}/>`
  let quit = channel()
  let exit = channel()

  let draw = node => {
    while (self.hasChildNodes())
      self.removeChild(self.lastChild)
    try {
      self.appendChild(node)
    } catch (e) {
      console.error(name, start, self, node)
      throw e
    }
  }

  self.quit = quit
  self.exit = exit
  self.draw = draw

  let run = async () => {
    try {
      let x = await start(self, args)
      console.log(`${name}: returned`)
      exit.push(x)
    } catch (e) {
      console.log(`${name}: crash ${e}`)
      if (link) {
        console.log(`${name}: quitting link`)
        link.quit.push(e)
      }
      exit.push(e)
    } finally {
      console.log(`${name}: clearing`)
      while (self.hasChildNodes())
        self.removeChild(self.lastChild)
    }
  }

  run()

  return self
}

export let supervise = ({ 
  name, start, args = {} 
}) => {

  let supervisor = async self => {
    loop: while (true) {
      console.log(`supervisor ${name}: starting`)
      let child = spawn({ name, start, args })
      self.draw(child)

      switch (await choose([
        label(next(self.quit), "quit self"),
        label(next(child.exit), "exit child"),
      ])) {
      case "quit self":
        console.log("quit self")
        child.quit.push("quit")
        await next(child.exit)
        break loop
      case "exit child":
        console.log("exit child")
        await sleep(1)
        continue loop
      default:
        console.log("uh")
      }
    }
  }

  return spawn({ 
    name: "Supervisor: ${name}", 
    start: supervisor
  })
}

export let channel = () => {
  let subscriber = () => {}
  return ({
    pull: f => {
      subscriber = f
    },
    push: x => {
      console.log("push", x)
      subscriber(x)
    }
  })
}

export let preemptive = async (self, xs) => {
  let fail = Symbol("fail")
  let x = await choose([
    label(next(self.quit), fail),
    ...xs
  ])
  
  if (x === fail)
    throw new Error("quit")
  else
    return x
}

export let next =
  channel => new Promise((ok, _) => channel.pull(ok))

export let choose =
  async choices => Promise.race(choices)

export let label =
  async (x, k) => { await x; return k }

export let sleep =
  s => new Promise((ok, _) => setTimeout(ok, 1000 * s))
