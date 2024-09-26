const enabled = process.env.TEST_LOGS === 'true'

export function log(...args: any[]) {
  if (enabled) console.log(...args)
}
