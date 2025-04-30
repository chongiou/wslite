export const NODE_ENV = process.env.NODE_ENV  === 'development'
  ? 'development'
  : 'production'

export const RUNTIME = typeof __zdjl !== 'undefined'
  ? 'zdjl'
  : 'node'
