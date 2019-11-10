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
//
// Note that the asynchronous process will hold a reference to the DOM
// node.  If the DOM node is removed from the document and the process
// keeps running, this is likely a resource leak.  Weak references are
// coming to browsers soon...
//
export let spawn = (name, start, args) => {
  let self = html`<process name=${name}/>`

  start({
    ...args,
    draw: node => {
      while (self.hasChildNodes())
        self.removeChild(self.lastChild)
      try {
        self.appendChild(node)
      } catch (e) {
        console.error(name, start, self, node)
        throw e
      }
    }
  })

  return self
}

export let channel = () => {
  let subscriber = () => {}
  return ({
    pull: f => subscriber = f,
    push: x => subscriber(x)
  })
}

export let next =
  channel => new Promise((ok, _) => channel.pull(ok))

export let choose =
  async choices => Promise.race(choices)

export let label =
  async (x, k) => { await x; return k }

export let sleep =
  s => new Promise((ok, _) => setTimeout(ok, 1000 * s))
