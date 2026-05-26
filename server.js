import { createServer } from "node:http"
import { parse } from "node:url"
import next from "next"

const dev = process.env.NODE_ENV !== "production"
const port = parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev, hostname: "localhost", port })
const handle = app.getRequestHandler()

await app.prepare()

createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true)
    await handle(req, res, parsedUrl)
  } catch (err) {
    console.error("Error occurred handling", req.url, err)
    res.statusCode = 500
    res.end("internal server error")
  }
}).listen(port, () => {
  console.log(`> Ready on http://localhost:${port}`)
})
