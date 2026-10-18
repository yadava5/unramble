export type Flag = boolean

declare module 'claude-code' {
  interface PluginState {
    'prompt-refine': { hasDraft: Flag; isBusy: Flag; isRefined: Flag; original: string; rewrite: string }
  }
}
