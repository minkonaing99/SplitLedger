export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDataStore } = await import("./lib/server/json-db")
    await initDataStore()
  }
}
