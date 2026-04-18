export {}

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>
      scanFiles: (path: string) => Promise<string[]>
    }
  }
}