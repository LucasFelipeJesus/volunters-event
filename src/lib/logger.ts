const isDev = typeof import.meta !== 'undefined' ? Boolean((import.meta as ImportMeta).env?.DEV) : process.env.NODE_ENV !== 'production'

const debug = (...args: unknown[]) => {
    if (isDev) console.debug(...args)
}

const info = (...args: unknown[]) => {
    console.info(...args)
}

const warn = (...args: unknown[]) => {
    console.warn(...args)
}

const error = (...args: unknown[]) => {
    console.error(...args)
}

export default { debug, info, warn, error }
