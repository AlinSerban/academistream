export const REDIS = Symbol('REDIS')

export type RedisClient = {
  incr(key: string): Promise<number>
  pexpire(key: string, milliseconds: number): Promise<number>
  quit(): Promise<string>
}
