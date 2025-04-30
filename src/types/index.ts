export type Result<T = unknown, E = unknown> = Ok<T> | Err<E>

export class Ok<T> {
  readonly ok = true
  constructor(public val: T) { }
}

export class Err<E> {
  readonly ok = false
  constructor(public val: E) { }
}
