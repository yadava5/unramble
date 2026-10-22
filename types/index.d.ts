export type Flag = boolean

declare module 'claude-code' {
  interface PluginState {
    unramble: {
      hasDraft: Flag
      isBusy: Flag
      isRefined: Flag
      isKeyBound: Flag
      original: string
      rewrite: string
      pastes: Record<string, string>
    }
  }
}
